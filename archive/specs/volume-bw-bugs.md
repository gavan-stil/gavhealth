# Bodyweight Volume/Load Bug Register — 2026-07-08
_Audit of every volume/load calculation in the system after the SessionPickerSheet "0 kg volume" bug.
Each fix has a premortem: what could regress, and the mitigation baked in._

**Bug class:** the app has one canonical load definition — `reps × (bodyweight_at_session if is_bodyweight else 0 + weight_kg)` —
but some code paths compute load ignoring bodyweight. Pure-BW sessions (most of Gav's training) then read 0,
and `bw+` sessions undercount (added kg only). A related trap: JSONB `bw` sets carry a **stale `kg` value**
(leftover `DEFAULT_SET.kg = 20` UI state) that must never be trusted.

---

## Audit results — every load calculation

| Surface | Formula | Verdict |
|---|---|---|
| `GET /api/strength/sessions` (Trends charts, DayDetailSheet) | SQL, BW-inclusive | ✅ correct |
| `GET /api/strength/sessions/last-by-split/{split}` (StrengthCard compare) | SQL, BW-inclusive | ✅ correct |
| `GET /api/strength/exercise/{id}/history` → `session_volume_kg` | SQL, BW-inclusive | ✅ correct |
| `GET /api/strength/exercise/{id}/history` → `estimated_1rm` | `COALESCE(weight_kg,0)` only | ❌ **BUG 1** — fixed |
| `GET /api/strength/exercise/{id}/history` → `top_weight_kg` | external weight only | ⚠️ intended for PB guards; effective-load variant added (**BUG 2**) |
| `GET /api/log/strength/recent/{split}` (SessionPickerSheet) | JSONB, skipped `bw` | ❌ fixed 2026-07-08 (`4e35589`) |
| `StrengthCard.computeCurrentStats` (live logging) | BW-inclusive via `/api/weight?limit=1`, `~` when unknown | ✅ correct |
| `ExerciseProgressCard` TOP / EST 1RM / sparkline | consumed broken `estimated_1rm` + external-only `top_weight_kg` | ❌ **BUG 2** — fixed |
| `GET /api/strength/prs` (data.py) | `WHERE weight_kg IS NOT NULL` — BW PBs invisible | ⚠️ **no frontend consumer** — documented, not fixed |
| Bridge paths (`new_endpoints.py` builder save, `logging.py` NLP save) | snapshot `bodyweight_at_session` (exact date → 7-record rolling avg) | ✅ correct |
| Historical data | 57/57 sessions have non-zero load (curl-verified 2026-07-08) | ✅ no backfill needed |

**Weight-sync hypothesis disproved:** `bodyweight_at_session` was populated for all sessions.
The lookup falls back to the average of the last 7 weight readings, so a stale sync still yields a value —
it returns NULL only if `weight_logs` is empty before the session date.

---

## BUG 1 — `estimated_1rm` is 0 for bodyweight sessions

**Bug:** Epley formula used `COALESCE(st.weight_kg, 0)` — `bw` sets (weight NULL) → 1RM 0.0;
`bw+` sets → 1RM from added kg only (e.g. 24kg "1RM" for +20kg pull-ups).
Trends exercise cards showed "EST 1RM 0.0kg" for most exercises.

**Fix:** compute Epley on effective load: `(bodyweight_at_session if is_bodyweight else 0) + weight_kg`.

**Premortem:**
- *Consumers:* `estimated_1rm` is read only by `ExerciseProgressCard`. For kg-only exercises the value is
  unchanged (`is_bodyweight = false` → same formula). No other surface can regress.
- *Values jump at deploy* (0 → ~90kg for pull-ups): a correction, not a regression; no comparisons are stored.
- *Epley accuracy above ~10 reps is poor:* inherent to the formula, unchanged for kg exercises — out of scope.

## BUG 2 — ExerciseProgressCard TOP/sparkline show external weight only

**Bug:** sparkline + TOP + 4-week-change badge used `top_weight_kg`, which is external weight only.
For BW exercises this flip-flops 0↔20 depending on whether any set was `bw+` — meaningless as a progress line.

**Fix:** backend adds `top_effective_kg` (max per-set effective load) to the history response;
`ExerciseProgressCard` uses `top_effective_kg ?? top_weight_kg` for sparkline/TOP/change badge.

**Premortem — why NOT change `top_weight_kg` itself:**
- `DayDetailSheet`, `ActivityDetailSheet`, `ActivityFeed` compute weight-PB flags from `top_weight_kg`
  guarded by `!uses_bodyweight`; `StrengthCard`'s history modal hides the TOP column when all zeros.
  Changing its semantics could raise false PB flames and un-hide columns. **Additive field instead.**
- *Deploy-order coupling:* Vercel + Railway deploy independently from the same push. If the frontend lands
  first, `top_effective_kg` is `undefined` → `?? top_weight_kg` falls back to old behaviour. Baked in.
- *Response stripping:* endpoint returns plain dicts (no Pydantic `response_model`) → new field passes through.
  (Contrast MOMENTUM schema trap in MEMORY.md.)
- *BW fluctuation noise in the sparkline:* effective load moves with bodyweight (~±0.5kg) — acceptable;
  it IS the load being lifted, and bodyweight gain is a stated goal.
- *NULL `bodyweight_at_session`:* COALESCE→0 keeps today's behaviour; verified zero such rows exist.

## Documented, deliberately not fixed

1. **`GET /api/strength/prs`** — ignores bodyweight entirely (`WHERE weight_kg IS NOT NULL`). No frontend
   consumer today. Fix when a PR surface is built; use effective load and the `uses_bodyweight` display split.
2. **SessionPicker per-exercise PB weight check** compares `bw+` added-kg against `kg` full-weight for the
   same exercise name. Exercises rarely mix load types; reps-PB still catches these. Revisit if flames look wrong.
3. **Stale `kg` on `bw` sets in JSONB** — harmless today because every reader ignores `kg` when
   `load_type === 'bw'`. Any NEW consumer of `raw_exercises`/`msl.exercises` must keep ignoring it.
