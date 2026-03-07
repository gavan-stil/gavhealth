# T12 — Strength Session Lifecycle: Bridge + Delete + Unlink

> **Status:** READY TO BUILD
> **Created:** 2026-03-07
> **Prereq:** Save endpoint fixed ✅ (commit `03138ef` deployed, confirmed 200)

---

## Problem

Two completely separate strength logging systems exist with no data bridge:

| | System 1 (normalised) | System 2 (JSONB blob) |
|--|--|--|
| **Tables** | `strength_sessions` + `strength_sets` + `exercises` | `manual_strength_logs` |
| **Write endpoint** | `POST /api/log/strength/confirm` (logging.py:115) | `POST /api/log/strength/save` (new_endpoints.py:179) |
| **Feeds Trends?** | YES — volume charts, 1RM, exercise history | NO — never queried by Trends |
| **Used by frontend?** | NEVER called by any component | Both Builder + Brain Dump modes use this |

**Result:** Every strength session logged from the app goes to `manual_strength_logs` and never appears in Trends. Verified in prod: 9+ manual sessions exist, 0 show in `/api/strength/sessions`.

**Additional gaps:**
- No DELETE for sessions (can't remove bad data)
- No UNLINK (can't detach session from workout activity)
- No way to fix mistakes without DB access
- Exercise categories all default to "other" — no body-part tracking

---

## Decisions

1. **Bridge** the two systems — on save, also write normalised rows to `strength_sessions`/`strength_sets`/`exercises`
2. **CRUD scope:** Create + Delete + Unlink (no inline editing — delete and re-log if wrong)
3. On delete, remove from BOTH tables (CASCADE handles strength_sets)
4. On unlink, clear activity link in BOTH tables
5. **Exercise name matching:** case-insensitive (use `func.lower()` on lookup)
6. **Exercise categories:** Smart keyword mapping to 6 body-part categories (see below)
7. **Backfill** existing manual_strength_logs → bridge them into strength_sessions

---

## Exercise Category System

**Categories** (replaces old `upper_push/upper_pull/lower/core/carry/full_body/other`):

| Category | Examples |
|---|---|
| `chest` | Bench Press, Incline Press, DB Press, Cable Fly, Push Up, Pec Deck, Chest Fly |
| `back` | Row, Pull Up, Chin Up, Lat Pulldown, Seated Row, Deadlift, Back Extension, T-Bar Row |
| `shoulders` | Overhead Press, Lateral Raise, Front Raise, Face Pull, Arnold Press, Shoulder Press, Shrug, Rear Delt |
| `arms` | Bicep Curl, Hammer Curl, Tricep Extension, Tricep Pushdown, Skull Crusher, Preacher Curl, EZ Bar Curl, Dip |
| `legs` | Squat, Leg Press, Lunge, Leg Extension, Leg Curl, Calf Raise, Hip Thrust, Romanian Deadlift, Bulgarian Split Squat, Goblet Squat, Step Up, Hack Squat |
| `core` | Plank, Crunch, Sit Up, Russian Twist, Leg Raise, Ab Wheel, Cable Crunch, Hanging Leg Raise, Woodchop, Dead Bug |

**Implementation:** Keyword-based matching function `_infer_category(name: str) -> str`:
- Lowercase the exercise name
- Check against keyword patterns (ordered specific → general):
  - "bench", "chest", "pec", "push up", "cable fly" → `chest`
  - "row", "pull up", "chin up", "pulldown", "lat ", "deadlift", "back ext" → `back`
  - "overhead", "shoulder", "lateral raise", "front raise", "face pull", "arnold", "shrug", "rear delt", "military" → `shoulders`
  - "curl", "tricep", "skull", "pushdown", "dip", "extension" (without "leg") → `arms`
  - "squat", "leg ", "lunge", "calf", "hip thrust", "hamstring", "glute", "step up", "hack" → `legs`
  - "plank", "crunch", "sit up", "ab ", "core", "twist", "woodchop", "dead bug" → `core`
  - fallback → `other`

**Note:** "Dip" could be arms or chest — defaulting to `arms`. "Deadlift" defaults to `back`. These are the standard categorizations. Exercises only categorized once on first create — category persists for all future sessions.

**Schema change:** `exercises.category` is VARCHAR(20) with no CHECK constraint. New values work immediately. Update existing exercises during backfill.

---

## Data Format Mapping

**Frontend sends** (via `POST /api/log/strength/save`):
```json
{
  "workout_split": "push",
  "exercises": [
    {
      "name": "Bench Press",
      "superset": false,
      "sets": [
        { "load_type": "kg", "kg": 60, "reps": 10 },
        { "load_type": "bw", "kg": 0, "reps": 12 },
        { "load_type": "bw+", "kg": 10, "reps": 8 }
      ]
    }
  ],
  "start_time": "2026-03-07T10:00:00",
  "duration_minutes": 45,
  "notes": null
}
```

**Maps to `strength_sets` columns:**

| JSONB field | → Column | Notes |
|---|---|---|
| exercise.name | → exercises.name (find/create) → exercise_id | Case-insensitive match |
| exercise.name | → exercises.category (via `_infer_category`) | Only on CREATE, not update |
| set index (1-based) | → set_number | Enumerate globally across all exercises |
| set.reps | → reps | Direct |
| load_type='kg', set.kg | → is_bodyweight=false, weight_kg=kg | Standard weighted |
| load_type='bw' | → is_bodyweight=true, weight_kg=null | Pure bodyweight |
| load_type='bw+', set.kg | → is_bodyweight=true, weight_kg=kg | BW + extra weight |
| (not tracked) | → rpe=null | Builder doesn't capture RPE |
| (auto from weight_logs) | → bodyweight_at_session | Same pattern as logging.py:131-158 |

---

## Build Steps

### Step 1: Schema — add `bridged_session_id` column

**File:** `backend/app/main.py` — add to lifespan ALTER TABLE list

```sql
ALTER TABLE manual_strength_logs ADD COLUMN IF NOT EXISTS bridged_session_id INTEGER
```

Links each manual log to its bridged `strength_sessions.id`.

---

### Step 2: Exercise category helper + bodyweight helper

**File:** `backend/app/routers/new_endpoints.py` — add helper functions before save endpoint

```python
def _infer_category(name: str) -> str:
    """Map exercise name → body-part category via keyword matching."""
    n = name.lower()
    # Chest
    if any(k in n for k in ("bench", "chest", "pec", "push up", "push-up", "cable fly", "chest fly", "incline press", "decline press", "db press")):
        return "chest"
    # Back (before arms, since "row" is common)
    if any(k in n for k in ("row", "pull up", "pull-up", "chin up", "chin-up", "pulldown", "lat ", "deadlift", "back ext", "t-bar")):
        return "back"
    # Shoulders
    if any(k in n for k in ("overhead", "shoulder", "lateral raise", "front raise", "face pull", "arnold", "shrug", "rear delt", "military", "ohp")):
        return "shoulders"
    # Legs (before arms, since "leg extension" contains "extension")
    if any(k in n for k in ("squat", "leg ", "lunge", "calf", "hip thrust", "hamstring", "glute", "step up", "step-up", "hack", "rdl", "romanian")):
        return "legs"
    # Arms
    if any(k in n for k in ("curl", "tricep", "skull", "pushdown", "dip", "extension", "kickback", "hammer")):
        return "arms"
    # Core
    if any(k in n for k in ("plank", "crunch", "sit up", "sit-up", "ab ", "abs", "core", "twist", "woodchop", "dead bug", "leg raise", "hanging")):
        return "core"
    return "other"


async def _lookup_bodyweight(db: AsyncSession, session_date) -> float | None:
    """Get bodyweight for bridge: exact date match, else 7-day rolling avg."""
    bw_result = await db.execute(
        text("SELECT weight_kg FROM weight_logs WHERE recorded_at::date = :d ORDER BY recorded_at DESC LIMIT 1"),
        {"d": session_date},
    )
    row = bw_result.mappings().first()
    if row:
        return float(row["weight_kg"])
    rolling = await db.execute(
        text("""SELECT AVG(weight_kg) AS avg FROM (
            SELECT weight_kg FROM weight_logs
            WHERE recorded_at::date < :d
            ORDER BY recorded_at DESC LIMIT 7
        ) sub"""),
        {"d": session_date},
    )
    r = rolling.mappings().first()
    return float(r["avg"]) if r and r["avg"] else None
```

---

### Step 3: Bridge logic in save endpoint

**File:** `backend/app/routers/new_endpoints.py` — inside `save_strength_log()`, after INSERT into manual_strength_logs, before COMMIT

**Add imports at top of file:**
```python
from datetime import datetime, date, timezone
from sqlalchemy import select, func
from app.models.health import StrengthSession, StrengthSet, Exercise
```

**Bridge code** (after existing INSERT, before `await db.commit()`):

```python
# --- Bridge to normalised tables (feeds Trends) ---
bridged_session_id = None
if body.exercises and len(body.exercises) > 0:
    session = StrengthSession(
        session_datetime=start_ts or datetime.now(timezone.utc),
        session_label=body.workout_split,
        source="manual",
        activity_log_id=matched_activity_id,
    )
    db.add(session)
    await db.flush()  # get session.id
    bridged_session_id = session.id

    # Bodyweight lookup
    session_date = start_ts.date() if start_ts else date.today()
    bodyweight_kg = await _lookup_bodyweight(db, session_date)

    set_number_global = 0
    for ex_data in body.exercises:
        ex_name = (ex_data.get("name") or "").strip()
        if not ex_name:
            continue

        # Case-insensitive find or create Exercise
        exercise = (
            await db.execute(
                select(Exercise).where(func.lower(Exercise.name) == ex_name.lower())
            )
        ).scalar_one_or_none()
        if not exercise:
            exercise = Exercise(name=ex_name, category=_infer_category(ex_name))
            db.add(exercise)
            await db.flush()

        for set_data in ex_data.get("sets", []):
            set_number_global += 1
            load_type = set_data.get("load_type", "kg")
            is_bw = load_type in ("bw", "bw+")
            weight = set_data.get("kg") if load_type != "bw" else None

            strength_set = StrengthSet(
                session_id=session.id,
                exercise_id=exercise.id,
                set_number=set_number_global,
                reps=set_data.get("reps", 0),
                weight_kg=weight,
                is_bodyweight=is_bw,
                bodyweight_at_session=bodyweight_kg,
                rpe=None,
            )
            db.add(strength_set)

    # Link bridged session back to manual log
    await db.execute(
        text("UPDATE manual_strength_logs SET bridged_session_id = :sid WHERE id = :lid"),
        {"sid": bridged_session_id, "lid": log_id},
    )
```

**Transaction safety:** Everything happens before the single `await db.commit()`. If bridge fails, entire save rolls back.

---

### Step 4: DELETE endpoint

**File:** `backend/app/routers/new_endpoints.py` — add after relink endpoint

```python
@router.delete("/log/strength/{id}")
async def delete_strength_log(id: int, db: AsyncSession = Depends(get_db)):
    row = await db.execute(
        text("SELECT id, bridged_session_id FROM manual_strength_logs WHERE id = :id"),
        {"id": id},
    )
    log = row.mappings().first()
    if not log:
        raise HTTPException(status_code=404, detail="Strength log not found")

    # Delete bridged strength_session (CASCADE deletes strength_sets)
    if log["bridged_session_id"]:
        await db.execute(
            text("DELETE FROM strength_sessions WHERE id = :sid"),
            {"sid": log["bridged_session_id"]},
        )

    # Delete manual log
    await db.execute(
        text("DELETE FROM manual_strength_logs WHERE id = :id"),
        {"id": id},
    )

    await db.commit()
    return {"ok": True}
```

---

### Step 5: UNLINK endpoint

**File:** `backend/app/routers/new_endpoints.py` — add after relink endpoint

```python
@router.patch("/log/strength/{id}/unlink")
async def unlink_strength(id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            UPDATE manual_strength_logs
            SET matched_activity_id = NULL, match_confirmed = false
            WHERE id = :id
            RETURNING id, bridged_session_id
        """),
        {"id": id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Strength log not found")

    if row["bridged_session_id"]:
        await db.execute(
            text("UPDATE strength_sessions SET activity_log_id = NULL WHERE id = :sid"),
            {"sid": row["bridged_session_id"]},
        )

    await db.commit()
    return {"ok": True, "id": id}
```

---

### Step 6: Frontend — ActivityFeed delete + unlink buttons

**File:** `src/components/log/ActivityFeed.tsx`

**New state:**
```ts
const [deletingId, setDeletingId] = useState<number | null>(null);
```

**Linked session row** (currently shows `[Split] · N exercises · Xmin [Re-log →]`):
- Add "Unlink" text button (muted, right side)
- On tap: `PATCH /api/log/strength/{linkedSession.id}/unlink`
- After success: refetch strength sessions, session moves to "unlinked" pool
- Use existing `linkDoneFor` pattern for 3s feedback

**Unlinked sessions in link picker** (each row):
- Add small "×" delete button (red, left of "Link" button)
- On tap: `window.confirm("Delete this session?")` (simple native confirm)
- If confirmed: `DELETE /api/log/strength/{sessionId}`
- After success: refetch, session disappears from list

**No changes to StrengthCard.tsx** — save payload stays identical, bridge is backend-only.

---

### Step 7: Backfill existing manual logs + cleanup

**Temporary admin endpoint** in `new_endpoints.py`:
```
POST /api/admin/backfill-strength-bridge
```

Loop through `manual_strength_logs WHERE bridged_session_id IS NULL AND exercises != '[]'`:
- Run same bridge logic (create StrengthSession, find/create Exercises with `_infer_category`, create StrengthSets)
- Update existing exercises with proper categories (replace "other" with inferred category)

**Cleanup:** Delete garbage test rows (session ids 8, 15).

After running, verify `GET /api/strength/sessions?days=90` returns backfilled data. Then remove the admin endpoint.

---

### Step 8: Build + deploy + verify

1. `npm run build` — must pass
2. Push to GitHub → Railway auto-deploys
3. Run verification checklist (below)

---

## Files Changed

| File | Changes |
|---|---|
| `backend/app/main.py` | +1 ALTER TABLE for bridged_session_id |
| `backend/app/routers/new_endpoints.py` | `_infer_category()` + `_lookup_bodyweight()` helpers, bridge in save, DELETE endpoint, UNLINK endpoint, backfill admin endpoint. New imports: StrengthSession, StrengthSet, Exercise, select, func |
| `src/components/log/ActivityFeed.tsx` | Delete button on unlinked sessions, Unlink button on linked sessions |

## Files NOT Changed

| File | Why |
|---|---|
| `StrengthCard.tsx` | Save payload unchanged — bridge is backend-only |
| `LogCards.tsx` | Renders StrengthCard standalone, no changes |
| `TrendsPage.tsx` | Already queries `strength_sessions` — works once bridge populates |
| `logging.py` | System 1 confirm endpoint stays as reference, not modified |
| `models/health.py` | ORM models already correct, CASCADE already defined. Category is VARCHAR(20) with no CHECK — new values work immediately |

---

## Verification Checklist

### Backend
- [ ] `POST /api/log/strength/save` → 200, creates rows in BOTH manual_strength_logs AND strength_sessions/sets
- [ ] New session appears in `GET /api/log/strength/sessions` (manual list)
- [ ] Same session ALSO appears in `GET /api/strength/sessions` (Trends endpoint) with correct exercise names, set counts, load totals
- [ ] Exercise created with correct category (e.g. "Bench Press" → "chest")
- [ ] `DELETE /api/log/strength/{id}` → 200, session gone from BOTH endpoints
- [ ] `PATCH /api/log/strength/{id}/unlink` → 200, matched_activity_id = null in both tables
- [ ] `PATCH /api/log/strength/{id}/relink` still works (existing functionality)
- [ ] Backfill bridges existing sessions → all appear in Trends with correct categories

### Frontend
- [ ] `npm run build` passes
- [ ] ActivityFeed: expand workout with linked session → see "Unlink" button
- [ ] Tap Unlink → session detaches, moves to unlinked pool
- [ ] ActivityFeed: open link picker → see "×" delete on each unlinked session
- [ ] Tap delete → confirm dialog → session removed from list
- [ ] Trends page: WorkoutVolumeChart shows newly logged sessions
- [ ] Brain Dump mode: parse → confirm → session appears in Trends

### Edge Cases
- [ ] Save with empty exercises array → no bridge created, no crash
- [ ] Save without start_time → bridge uses current time
- [ ] Delete non-bridged session (old pre-bridge data) → only deletes manual log, no crash
- [ ] Exercise name "bench press" matches existing "Bench Press" (case-insensitive)
- [ ] Leg exercise in push session → categorized as "legs" (not "chest")

---

## Prod Data State (2026-03-07)

| Table | Row count | Notes |
|---|---|---|
| manual_strength_logs | ~15 | 9 real sessions + test garbage (ids 8, 15) |
| strength_sessions | 2 | Old System 1 data (Squat, Leg Press from confirm endpoint) |
| strength_sets | 7 | Linked to the 2 strength_sessions above |
| exercises | ~3 | Squat, Leg Press, possibly others — all category="other" |

After backfill: strength_sessions should have ~11 rows (2 old + 9 bridged), exercises updated with proper categories.

---

## Risk Notes

1. **ORM + raw SQL mixing** — save uses `text()` for manual_strength_logs (no ORM model) but ORM for bridge tables. Same `db` session/transaction — works fine.
2. **CASCADE delete** — confirmed: `StrengthSet.session_id` has `ondelete="CASCADE"` (models/health.py:228). Deleting StrengthSession auto-deletes its sets.
3. **Backfill is one-time** — remove admin endpoint after running.
4. **No FK constraint** on `manual_strength_logs.bridged_session_id` — just an INTEGER. Stale reference possible if strength_session deleted independently. Acceptable for single-user.
5. **Category keyword conflicts** — "leg extension" matches "legs" (correct). "Tricep extension" matches "arms" (legs check uses `"leg "` with trailing space to avoid this). Test edge cases.
6. **Existing exercises** (Squat, Leg Press) have category="other". Backfill step should UPDATE these to correct categories.
