"""New endpoints: activity effort, activity feed, manual strength logging, food & nutrition."""

from datetime import timedelta, datetime, date, timezone
from zoneinfo import ZoneInfo

BRISBANE_TZ = ZoneInfo("Australia/Brisbane")

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator
from sqlalchemy import text, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import verify_api_key
from app.database import get_db
from app.models.health import StrengthSession, StrengthSet, Exercise, MuscleGroup, ExerciseMuscle
from app.schemas.health import (
    MuscleGroupCreate, MuscleGroupResponse,
    ExerciseUpdateRequest, ExerciseMuscleEntry,
)

router = APIRouter(prefix="/api", tags=["activities"], dependencies=[Depends(verify_api_key)])


# ---------------------------------------------------------------------------
# T12 helpers — exercise category inference + bodyweight lookup
# ---------------------------------------------------------------------------
def _infer_category(name: str) -> str:
    """Map exercise name → body-part category.

    Checks explicit ' - Body part' suffix first (e.g. 'L sit chin up - Back and arms'),
    then falls back to keyword matching on the full name.
    """
    # Suffix-first: extract everything after the first ' - '
    if " - " in name:
        suffix = name.split(" - ", 1)[1].lower().strip()
        if any(k in suffix for k in ("back", "lats", "traps")):
            return "back"
        if any(k in suffix for k in ("chest", "pec")):
            return "chest"
        if "shoulder" in suffix:
            return "shoulders"
        if any(k in suffix for k in ("leg", "quad", "hamstring", "glute", "calf")):
            return "legs"
        if any(k in suffix for k in ("arm", "bicep", "tricep")):
            return "arms"
        if any(k in suffix for k in ("abs", "core", "ab")):
            return "core"

    # Keyword matching on full name (fallback)
    n = name.lower()
    if any(k in n for k in ("bench", "chest", "pec", "push up", "push-up", "cable fly", "chest fly", "incline press", "decline press", "db press")):
        return "chest"
    if any(k in n for k in ("row", "pull up", "pull-up", "chin up", "chin-up", "pulldown", "lat ", "deadlift", "back ext", "t-bar")):
        return "back"
    if any(k in n for k in ("overhead", "shoulder", "lateral raise", "front raise", "face pull", "arnold", "shrug", "rear delt", "military", "ohp")):
        return "shoulders"
    # Legs before arms: "leg extension" must → legs, not arms
    if any(k in n for k in ("squat", "leg ", "lunge", "calf", "hip thrust", "hamstring", "glute", "step up", "step-up", "hack", "rdl", "romanian")):
        return "legs"
    if any(k in n for k in ("curl", "tricep", "skull", "pushdown", "dip", "extension", "kickback", "hammer")):
        return "arms"
    if any(k in n for k in ("plank", "crunch", "sit up", "sit-up", "ab ", "abs", "core", "twist", "woodchop", "dead bug", "leg raise", "hanging")):
        return "core"
    return "other"


def _session_category(categories: list[str], session_label: str | None = None) -> str:
    """Map a list of exercise DB categories → scatter colour group.

    DB categories: chest, back, shoulders, arms, legs, core, other
    Scatter groups: push, pull, legs, abs, mixed
    Falls back to session_label when exercise categories are ambiguous.
    """
    MACRO = {
        "chest": "push", "shoulders": "push", "arms": "push",
        "back": "pull",
        "legs": "legs",
        "core": "abs",
        "other": "mixed",
    }
    cats = {MACRO.get(c, "mixed") for c in (categories or []) if c}
    cats.discard("mixed")          # ignore unknowns when deciding
    if not cats:
        LABEL_MAP = {"push": "push", "pull": "pull", "legs": "legs", "abs": "abs"}
        if session_label and session_label.lower() in LABEL_MAP:
            return LABEL_MAP[session_label.lower()]
        return "mixed"
    if len(cats) == 1:
        return cats.pop()
    return "mixed"


async def _lookup_bodyweight(db: AsyncSession, session_date) -> float | None:
    """Get bodyweight: exact date match, else 7-day rolling avg."""
    bw_result = await db.execute(
        text("SELECT weight_kg FROM weight_logs WHERE (recorded_at AT TIME ZONE 'Australia/Brisbane')::date = :d ORDER BY recorded_at DESC LIMIT 1"),
        {"d": session_date},
    )
    row = bw_result.mappings().first()
    if row:
        return float(row["weight_kg"])
    rolling = await db.execute(
        text("""SELECT AVG(weight_kg) AS avg FROM (
            SELECT weight_kg FROM weight_logs
            WHERE (recorded_at AT TIME ZONE 'Australia/Brisbane')::date < :d
            ORDER BY recorded_at DESC LIMIT 7
        ) sub"""),
        {"d": session_date},
    )
    r = rolling.mappings().first()
    return float(r["avg"]) if r and r["avg"] else None


# ---------------------------------------------------------------------------
# Debug — list tables + columns (useful for diagnosing missing tables/columns)
# ---------------------------------------------------------------------------
@router.get("/debug/tables")
async def debug_tables(db: AsyncSession = Depends(get_db)):
    tables_result = await db.execute(
        text("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name
        """)
    )
    tables = [r[0] for r in tables_result.fetchall()]

    # Get columns for saved_meals specifically
    cols_result = await db.execute(
        text("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'saved_meals'
            ORDER BY ordinal_position
        """)
    )
    saved_meals_cols = [{"col": r[0], "type": r[1]} for r in cols_result.fetchall()]

    return {"tables": tables, "saved_meals_columns": saved_meals_cols}


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class EffortUpdate(BaseModel):
    effort: str

    @field_validator("effort")
    @classmethod
    def validate_effort(cls, v):
        if v not in ("basic", "mid", "lets_go"):
            raise ValueError("effort must be one of: basic, mid, lets_go")
        return v


class StrengthLogCreate(BaseModel):
    workout_split: str
    exercises: list
    start_time: str | None = None
    duration_minutes: int
    notes: str | None = None


class RelinkBody(BaseModel):
    activity_id: int


class SavedMealCreate(BaseModel):
    name: str
    calories_kcal: int
    protein_g: float
    carbs_g: float
    fat_g: float


class FoodItemLog(BaseModel):
    name: str
    calories_kcal: int
    protein_g: float
    carbs_g: float
    fat_g: float
    log_date: str | None = None  # YYYY-MM-DD; defaults to today if omitted


# ---------------------------------------------------------------------------
# 1. PATCH /api/activities/{id}/effort
# effort + effort_manually_set columns added via main.py lifespan ALTER TABLE
# ---------------------------------------------------------------------------
@router.patch("/activities/{id}/effort")
async def update_effort(id: int, body: EffortUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            UPDATE activity_logs
            SET effort = :effort, effort_manually_set = true
            WHERE id = :id
            RETURNING *
        """),
        {"effort": body.effort, "id": id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Activity not found")
    await db.commit()
    return dict(row)


# ---------------------------------------------------------------------------
# 2. GET /api/activities/feed
# Actual DB columns: id, activity_date, activity_type, duration_mins, avg_hr
# effort / effort_manually_set added via ALTER TABLE in main.py lifespan
# Use (:days * INTERVAL '1 day') to avoid asyncpg integer type inference issue
# ---------------------------------------------------------------------------
@router.get("/activities/feed")
async def activities_feed(days: int = Query(default=14), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            SELECT id,
                   activity_type                          AS type,
                   activity_date                          AS date,
                   started_at,
                   duration_mins                          AS duration_minutes,
                   avg_hr                                 AS avg_bpm,
                   min_hr,
                   max_hr,
                   distance_km,
                   avg_pace_secs,
                   calories_burned,
                   COALESCE(effort, 'basic')              AS effort,
                   COALESCE(effort_manually_set, false)   AS effort_manually_set
            FROM activity_logs
            WHERE activity_date >= CURRENT_DATE - (:days * INTERVAL '1 day')
            ORDER BY activity_date DESC
        """),
        {"days": days},
    )
    rows = result.mappings().all()
    return [
        {
            "id": r["id"],
            "type": r["type"],
            "date": r["date"].isoformat() if r["date"] else None,
            "start_time": r["started_at"].isoformat() if r["started_at"] else None,
            "duration_minutes": r["duration_minutes"],
            "avg_bpm": r["avg_bpm"],
            "min_hr": r["min_hr"],
            "max_hr": r["max_hr"],
            "distance_km": float(r["distance_km"]) if r["distance_km"] is not None else None,
            "avg_pace_secs": r["avg_pace_secs"],
            "calories_burned": r["calories_burned"],
            "effort": r["effort"],
            "effort_manually_set": r["effort_manually_set"],
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# 7. GET /api/habits
# ---------------------------------------------------------------------------
@router.get("/habits")
async def get_habits_history(days: int = Query(default=14), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            SELECT id, habit_date, did_breathing, did_devotions, notes
            FROM daily_habits
            WHERE habit_date >= CURRENT_DATE - (:days * INTERVAL '1 day')
            ORDER BY habit_date DESC
        """),
        {"days": days},
    )
    rows = result.mappings().all()
    return [
        {
            "id": r["id"],
            "habit_date": r["habit_date"].isoformat() if r["habit_date"] else None,
            "did_breathing": r["did_breathing"],
            "did_devotions": r["did_devotions"],
            "notes": r["notes"],
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# 3. POST /api/log/strength/save
# manual_strength_logs table created via main.py lifespan
# ---------------------------------------------------------------------------
@router.post("/log/strength/save")
async def save_strength_log(body: StrengthLogCreate, db: AsyncSession = Depends(get_db)):
    import json

    exercises_json = json.dumps(body.exercises) if not isinstance(body.exercises, str) else body.exercises
    start_ts = None
    ref_date = None
    if body.start_time:
        dt = datetime.fromisoformat(body.start_time)
        # Compute Brisbane local date BEFORE stripping tzinfo (used for activity_log matching).
        if dt.tzinfo:
            ref_date = dt.astimezone(BRISBANE_TZ).date()
        else:
            ref_date = dt.date()
        # asyncpg requires naive UTC for TIMESTAMPTZ params in text() queries.
        start_ts = dt.astimezone(timezone.utc).replace(tzinfo=None) if dt.tzinfo else dt

    result = await db.execute(
        text("""
            INSERT INTO manual_strength_logs
                (workout_split, exercises, start_time, duration_minutes, notes)
            VALUES (:workout_split, CAST(:exercises AS JSONB), :start_time, :duration_minutes, :notes)
            RETURNING id, start_time
        """),
        {
            "workout_split": body.workout_split,
            "exercises": exercises_json,
            "start_time": start_ts,
            "duration_minutes": body.duration_minutes,
            "notes": body.notes,
        },
    )
    inserted = result.mappings().first()
    log_id = inserted["id"]

    matched_activity_id = None
    match_confirmed = False

    match_row = None
    if ref_date:
        try:
            match_result = await db.execute(
                text("""
                    SELECT id FROM activity_logs
                    WHERE activity_type = 'workout'
                      AND activity_date = :ref_date
                      AND id NOT IN (
                          SELECT activity_log_id FROM strength_sessions
                          WHERE activity_log_id IS NOT NULL
                      )
                    ORDER BY id DESC
                    LIMIT 1
                """),
                {"ref_date": ref_date},
            )
            match_row = match_result.mappings().first()
        except Exception:
            match_row = None

    if match_row:
        matched_activity_id = match_row["id"]
        await db.execute(
            text("""
                UPDATE manual_strength_logs
                SET matched_activity_id = :aid
                WHERE id = :lid
            """),
            {"aid": matched_activity_id, "lid": log_id},
        )

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

        session_date = ref_date if ref_date else date.today()
        bodyweight_kg = await _lookup_bodyweight(db, session_date)

        set_number_global = 0
        for ex_data in body.exercises:
            ex_name = (ex_data.get("name") or "").strip()
            if not ex_name:
                continue

            exercise = (
                await db.execute(
                    select(Exercise).where(func.lower(Exercise.name) == ex_name.lower())
                )
            ).scalar_one_or_none()
            if not exercise:
                inferred_cat = _infer_category(ex_name)
                exercise = Exercise(name=ex_name, category=inferred_cat)
                db.add(exercise)
                await db.flush()
                # Create default exercise_muscles link from inferred category
                mg = (await db.execute(
                    select(MuscleGroup).where(func.lower(MuscleGroup.name) == inferred_cat.lower())
                )).scalar_one_or_none()
                if mg:
                    db.add(ExerciseMuscle(exercise_id=exercise.id, muscle_group_id=mg.id, is_primary=True))

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

        await db.execute(
            text("UPDATE manual_strength_logs SET bridged_session_id = :sid WHERE id = :lid"),
            {"sid": bridged_session_id, "lid": log_id},
        )

    await db.commit()
    return {
        "id": log_id,
        "matched_activity_id": matched_activity_id,
        "match_confirmed": match_confirmed,
    }


# ---------------------------------------------------------------------------
# 4. GET /api/log/strength/last/{split}
# ---------------------------------------------------------------------------
@router.get("/log/strength/last/{split}")
async def last_strength_log(split: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            SELECT (created_at AT TIME ZONE 'Australia/Brisbane')::date AS date, exercises
            FROM manual_strength_logs
            WHERE workout_split = :split
            ORDER BY created_at DESC
            LIMIT 1
        """),
        {"split": split},
    )
    row = result.mappings().first()
    if not row:
        return None
    return dict(row)


# ---------------------------------------------------------------------------
# T17-2. GET /api/log/strength/recent/{split}?limit=5
# Returns up to `limit` recent sessions for the given split with computed stats.
# Used by SessionPickerSheet to let the user load a past session as a template.
# ---------------------------------------------------------------------------
@router.get("/log/strength/recent/{split}")
async def recent_strength_sessions(
    split: str,
    limit: int = Query(default=5, ge=1, le=10),
    db: AsyncSession = Depends(get_db),
):
    import json as _json
    from collections import Counter

    VALID_SPLITS = ("push", "pull", "legs", "abs")
    if split not in VALID_SPLITS:
        raise HTTPException(status_code=400, detail=f"split must be one of: {', '.join(VALID_SPLITS)}")

    # Fetch all sessions for this split (all rows needed for PB + most_loaded computation)
    result = await db.execute(
        text("""
            SELECT id,
                   (created_at AT TIME ZONE 'Australia/Brisbane')::date AS local_date,
                   (start_time AT TIME ZONE 'Australia/Brisbane')       AS local_start,
                   exercises
            FROM manual_strength_logs
            WHERE workout_split = :split
            ORDER BY created_at DESC
        """),
        {"split": split},
    )
    rows = result.mappings().all()
    if not rows:
        return []

    def _parse_exs(raw) -> list:
        if raw is None:
            return []
        if isinstance(raw, str):
            try:
                return _json.loads(raw)
            except Exception:
                return []
        return raw  # asyncpg returns JSONB as Python list already

    sessions_parsed = [(row, _parse_exs(row["exercises"])) for row in rows]

    # ---- All-time max weight + reps per exercise name (across all sessions in this split) ----
    all_time_max_weight: dict[str, float] = {}
    all_time_max_reps:   dict[str, int]   = {}
    name_sets_per_session: list[frozenset] = []

    for (_row, exs) in sessions_parsed:
        name_set = frozenset(e.get("name", "").lower().strip() for e in exs if e.get("name"))
        name_sets_per_session.append(name_set)
        for ex in exs:
            n = ex.get("name", "").lower().strip()
            if not n:
                continue
            for s in ex.get("sets", []):
                lt   = s.get("load_type", "kg")
                kg   = s.get("kg")
                reps = int(s.get("reps", 0) or 0)
                if lt != "bw" and kg is not None:
                    all_time_max_weight[n] = max(all_time_max_weight.get(n, 0.0), float(kg))
                if reps:
                    all_time_max_reps[n] = max(all_time_max_reps.get(n, 0), reps)

    # ---- most_loaded: exercise name-set that appears most frequently ----
    name_set_counts = Counter(name_sets_per_session)
    max_count = max(name_set_counts.values()) if name_set_counts else 0
    most_loaded_target: frozenset | None = None
    for ns in name_sets_per_session:  # ordered newest-first; first hit wins tie
        if name_set_counts[ns] == max_count:
            most_loaded_target = ns
            break

    # ---- Build result sessions ----
    result_sessions = []
    most_loaded_assigned = False

    for i, (row, exs) in enumerate(sessions_parsed):
        name_set       = name_sets_per_session[i]
        total_sets_all = 0
        total_reps_all = 0
        total_volume   = 0.0
        session_is_pb  = False
        ex_list: list[dict] = []

        for ex in exs:
            ex_name = ex.get("name", "")
            n_lower = ex_name.lower().strip()
            sets    = ex.get("sets", [])
            num_sets = len(sets)
            total_sets_all += num_sets

            reps_list = [int(s.get("reps", 0) or 0) for s in sets]
            ex_reps   = sum(reps_list)
            total_reps_all += ex_reps
            avg_reps = round(ex_reps / num_sets, 1) if num_sets > 0 else 0.0

            top_w: float | None = None
            for s in sets:
                lt = s.get("load_type", "kg")
                kg = s.get("kg")
                if lt != "bw" and kg is not None:
                    kg_f = float(kg)
                    if top_w is None or kg_f > top_w:
                        top_w = kg_f
                    total_volume += int(s.get("reps", 0) or 0) * kg_f

            atm_w = all_time_max_weight.get(n_lower)
            atm_r = all_time_max_reps.get(n_lower, 0)
            ex_pb = bool(
                (atm_w is not None and top_w is not None and top_w >= atm_w)
                or (reps_list and max(reps_list) >= atm_r and atm_r > 0)
            )
            if ex_pb:
                session_is_pb = True

            ex_list.append({
                "name":          ex_name,
                "sets":          num_sets,
                "avg_reps":      avg_reps,
                "top_weight_kg": top_w,
                "is_pb":         ex_pb,
            })

        avg_rps = round(total_reps_all / total_sets_all, 1) if total_sets_all > 0 else 0.0

        is_most_loaded = (
            not most_loaded_assigned
            and most_loaded_target is not None
            and name_set == most_loaded_target
            and name_set_counts[name_set] == max_count
        )
        if is_most_loaded:
            most_loaded_assigned = True

        start_time_str = None
        local_start = row.get("local_start")
        if local_start is not None and hasattr(local_start, "hour"):
            start_time_str = f"{local_start.hour:02d}:{local_start.minute:02d}"

        result_sessions.append({
            "id":               row["id"],
            "date":             row["local_date"].isoformat() if row["local_date"] else None,
            "start_time":       start_time_str,
            "exercise_count":   len(exs),
            "total_sets":       total_sets_all,
            "avg_reps_per_set": avg_rps,
            "total_volume_kg":  round(total_volume),
            "is_pb":            session_is_pb,
            "most_loaded":      is_most_loaded,
            "exercises":        ex_list,
            "raw_exercises":    exs,   # WorkoutExercise[] — passed to onLoad in SessionPickerSheet
        })

    # Sort: PBs first (already newest-first), then most_loaded, then remaining chrono desc
    pb_sessions = [s for s in result_sessions if s["is_pb"]]
    ml_sessions = [s for s in result_sessions if s["most_loaded"] and not s["is_pb"]]
    rest        = [s for s in result_sessions if not s["is_pb"] and not s["most_loaded"]]
    return (pb_sessions + ml_sessions + rest)[:limit]


# ---------------------------------------------------------------------------
# 5. PATCH /api/log/strength/{id}/relink
# ---------------------------------------------------------------------------
@router.patch("/log/strength/{id}/relink")
async def relink_strength(id: int, body: RelinkBody, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            UPDATE manual_strength_logs
            SET matched_activity_id = :aid, match_confirmed = true
            WHERE id = :id
            RETURNING *
        """),
        {"aid": body.activity_id, "id": id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Strength log not found")

    # Also update the bridged strength_session so feed and trends reflect the new link
    if row["bridged_session_id"]:
        await db.execute(
            text("UPDATE strength_sessions SET activity_log_id = :aid WHERE id = :sid"),
            {"aid": body.activity_id, "sid": row["bridged_session_id"]},
        )

    await db.commit()
    return dict(row)


# ---------------------------------------------------------------------------
# 5b. DELETE /api/log/strength/{id}
# ---------------------------------------------------------------------------
@router.delete("/log/strength/{id}")
async def delete_strength_log(id: int, db: AsyncSession = Depends(get_db)):
    row = await db.execute(
        text("SELECT id, bridged_session_id FROM manual_strength_logs WHERE id = :id"),
        {"id": id},
    )
    log = row.mappings().first()
    if not log:
        raise HTTPException(status_code=404, detail="Strength log not found")

    if log["bridged_session_id"]:
        await db.execute(
            text("DELETE FROM strength_sessions WHERE id = :sid"),
            {"sid": log["bridged_session_id"]},
        )

    await db.execute(
        text("DELETE FROM manual_strength_logs WHERE id = :id"),
        {"id": id},
    )
    await db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# 5c. PATCH /api/log/strength/{id}/unlink
# ---------------------------------------------------------------------------
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


# ---------------------------------------------------------------------------
# 6. GET /api/log/strength/sessions
# ---------------------------------------------------------------------------
@router.get("/log/strength/sessions")
async def list_strength_sessions(days: int = Query(default=14), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            SELECT id, (created_at AT TIME ZONE 'Australia/Brisbane')::date AS log_date,
                   workout_split, duration_minutes,
                   jsonb_array_length(exercises) AS exercise_count,
                   matched_activity_id, match_confirmed, bridged_session_id
            FROM manual_strength_logs
            WHERE (created_at AT TIME ZONE 'Australia/Brisbane')::date >= CURRENT_DATE - (:days * INTERVAL '1 day')
            ORDER BY created_at DESC
        """),
        {"days": days},
    )
    rows = result.mappings().all()
    return [
        {
            "id": r["id"],
            "log_date": r["log_date"].isoformat() if r["log_date"] else None,
            "workout_split": r["workout_split"],
            "duration_minutes": r["duration_minutes"],
            "exercise_count": r["exercise_count"],
            "matched_activity_id": r["matched_activity_id"],
            "match_confirmed": r["match_confirmed"],
            "bridged_session_id": r["bridged_session_id"],
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# 7. GET /api/activities/linkable
# ---------------------------------------------------------------------------
@router.get("/activities/linkable")
async def linkable_activities(days: int = Query(default=14), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            SELECT id,
                   activity_type AS type,
                   activity_date AS date,
                   duration_mins AS duration_minutes
            FROM activity_logs
            WHERE activity_date >= CURRENT_DATE - (:days * INTERVAL '1 day')
            ORDER BY activity_date DESC
        """),
        {"days": days},
    )
    rows = result.mappings().all()
    return [
        {
            "id": r["id"],
            "type": r["type"],
            "date": r["date"].isoformat() if r["date"] else None,
            "duration_minutes": r["duration_minutes"],
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Food & Nutrition
# saved_meals created via main.py lifespan (CREATE TABLE IF NOT EXISTS)
# ---------------------------------------------------------------------------

def _meal_row(r: dict) -> dict:
    """Serialize a saved_meals row — NUMERIC columns come back as Decimal."""
    return {
        "id": r["id"],
        "name": r["name"],
        "calories_kcal": r["calories_kcal"],
        "protein_g": float(r["protein_g"]) if r["protein_g"] is not None else 0.0,
        "carbs_g":   float(r["carbs_g"])   if r["carbs_g"]   is not None else 0.0,
        "fat_g":     float(r["fat_g"])     if r["fat_g"]     is not None else 0.0,
    }


# 8. GET /api/saved-meals
@router.get("/saved-meals")
async def list_saved_meals(db: AsyncSession = Depends(get_db)):
    # ORDER BY id (not created_at) — table may have been created without that column
    result = await db.execute(
        text("SELECT id, name, calories_kcal, protein_g, carbs_g, fat_g FROM saved_meals ORDER BY id ASC")
    )
    return [_meal_row(dict(r)) for r in result.mappings().all()]


# 9. POST /api/saved-meals
@router.post("/saved-meals")
async def create_saved_meal(body: SavedMealCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            INSERT INTO saved_meals (name, calories_kcal, protein_g, carbs_g, fat_g)
            VALUES (:name, :calories_kcal, :protein_g, :carbs_g, :fat_g)
            RETURNING id, name, calories_kcal, protein_g, carbs_g, fat_g
        """),
        {
            "name": body.name,
            "calories_kcal": body.calories_kcal,
            "protein_g": body.protein_g,
            "carbs_g": body.carbs_g,
            "fat_g": body.fat_g,
        },
    )
    row = result.mappings().first()
    await db.commit()
    return _meal_row(dict(row))


# 10. DELETE /api/saved-meals/{id}
@router.delete("/saved-meals/{id}")
async def delete_saved_meal(id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("DELETE FROM saved_meals WHERE id = :id RETURNING id"),
        {"id": id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Saved meal not found")
    await db.commit()
    return {"ok": True}


# 11. POST /api/log/food/item  — direct log, macros already known (no AI)
# meal_label='snack' satisfies CHECK ('breakfast','lunch','dinner','snack','post-workout')
@router.post("/log/food/item")
async def log_food_item(body: FoodItemLog, db: AsyncSession = Depends(get_db)):
    # Resolve log_date before query to avoid asyncpg NULL-cast bug
    from datetime import date as date_type
    log_date_val = date_type.fromisoformat(body.log_date) if body.log_date else date_type.today()
    result = await db.execute(
        text("""
            INSERT INTO food_logs
                (description_raw, meal_label, log_date,
                 protein_g, carbs_g, fat_g, calories_kcal, confidence, source)
            VALUES
                (:name, 'snack', :log_date,
                 :protein_g, :carbs_g, :fat_g, :calories_kcal, 'high', 'manual')
            RETURNING id, description_raw, log_date, calories_kcal,
                      protein_g, carbs_g, fat_g
        """),
        {
            "name": body.name,
            "log_date": log_date_val,
            "protein_g": body.protein_g,
            "carbs_g": body.carbs_g,
            "fat_g": body.fat_g,
            "calories_kcal": body.calories_kcal,
        },
    )
    row = result.mappings().first()
    await db.commit()
    r = dict(row)
    return {
        "id": r["id"],
        "description_raw": r["description_raw"],
        "log_date": r["log_date"].isoformat() if r["log_date"] else None,
        "calories_kcal": r["calories_kcal"],
        "protein_g": float(r["protein_g"]) if r["protein_g"] is not None else 0.0,
        "carbs_g": float(r["carbs_g"]) if r["carbs_g"] is not None else 0.0,
        "fat_g": float(r["fat_g"]) if r["fat_g"] is not None else 0.0,
    }


# 12. DELETE /api/log/food/item/{id}
@router.delete("/log/food/item/{id}")
async def delete_food_log_item(id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("DELETE FROM food_logs WHERE id = :id RETURNING id"),
        {"id": id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Food log entry not found")
    await db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# A3. GET /api/strength/sessions?days=N
# Returns per-session aggregates for the Workout Volume chart.
# activity_logs columns: activity_date, activity_type, duration_mins, avg_hr, calories_burned
# ---------------------------------------------------------------------------
@router.get("/strength/sessions")
async def strength_sessions(days: int = Query(default=90), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            SELECT
                ss.id,
                (ss.session_datetime AT TIME ZONE 'Australia/Brisbane')::date AS session_date,
                ss.session_datetime                    AS session_datetime,
                ss.activity_log_id,
                ss.session_label,
                COALESCE(al.duration_mins, msl.duration_minutes) AS duration_mins,
                al.avg_hr,
                al.calories_burned                     AS calories,
                COUNT(st.id)                           AS total_sets,
                COALESCE(SUM(st.reps), 0)              AS total_reps,
                COALESCE(SUM(
                    (CASE WHEN st.is_bodyweight THEN COALESCE(st.bodyweight_at_session, 0) ELSE 0 END + COALESCE(st.weight_kg, 0))
                    * st.reps
                ), 0)                                  AS total_load_kg,
                CASE WHEN COUNT(st.id) > 0 THEN
                    COALESCE(SUM(
                        (CASE WHEN st.is_bodyweight THEN COALESCE(st.bodyweight_at_session, 0) ELSE 0 END + COALESCE(st.weight_kg, 0))
                        * st.reps
                    ), 0) / COUNT(st.id)
                ELSE 0 END                             AS avg_load_per_set_kg,
                ARRAY_AGG(DISTINCT e.name)             AS exercises,
                ARRAY_AGG(DISTINCT e.category)         AS categories
            FROM strength_sessions ss
            LEFT JOIN strength_sets st ON st.session_id = ss.id
            LEFT JOIN exercises e ON e.id = st.exercise_id
            LEFT JOIN activity_logs al ON al.id = ss.activity_log_id
            LEFT JOIN manual_strength_logs msl ON msl.bridged_session_id = ss.id
            WHERE ss.session_datetime >= CURRENT_TIMESTAMP - (:days * INTERVAL '1 day')
            GROUP BY ss.id, ss.session_datetime, ss.session_label, ss.activity_log_id,
                     al.duration_mins, al.avg_hr, al.calories_burned, msl.duration_minutes
            ORDER BY ss.session_datetime DESC
        """),
        {"days": days},
    )
    rows = result.mappings().all()
    return [
        {
            "id": r["id"],
            "date": r["session_date"].isoformat() if r["session_date"] else None,
            "session_date": r["session_date"].isoformat() if r["session_date"] else None,
            "session_datetime": r["session_datetime"].isoformat() if r["session_datetime"] else None,
            "activity_log_id": r["activity_log_id"],
            "session_label": r["session_label"],
            "duration_mins": float(r["duration_mins"]) if r["duration_mins"] is not None else None,
            "avg_hr": r["avg_hr"],
            "calories": r["calories"],
            "total_sets": r["total_sets"],
            "total_reps": r["total_reps"],
            "total_load_kg": float(r["total_load_kg"]),
            "avg_load_per_set_kg": float(r["avg_load_per_set_kg"]),
            "exercises": [e for e in (r["exercises"] or []) if e is not None],
            "category": _session_category(
                [c for c in (r["categories"] or []) if c is not None],
                r["session_label"],
            ),
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# A3b. PATCH /api/strength/sessions/{id}/unlink
# Removes the activity_log link from a strength session.
# ---------------------------------------------------------------------------
@router.patch("/strength/sessions/{id}/unlink")
async def unlink_strength_session(id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            UPDATE strength_sessions
            SET activity_log_id = NULL
            WHERE id = :id
            RETURNING id
        """),
        {"id": id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.commit()
    return {"ok": True, "id": id}


# ---------------------------------------------------------------------------
# A3c. PATCH /api/strength/sessions/{id}/link
# Sets the activity_log_id on a strength session.
# ---------------------------------------------------------------------------
class LinkBody(BaseModel):
    activity_id: int

@router.patch("/strength/sessions/{id}/link")
async def link_strength_session(id: int, body: LinkBody, db: AsyncSession = Depends(get_db)):
    # Prevent linking to a workout that already belongs to another session
    conflict = await db.execute(
        text("""
            SELECT id FROM strength_sessions
            WHERE activity_log_id = :aid AND id != :id
        """),
        {"aid": body.activity_id, "id": id},
    )
    if conflict.mappings().first():
        raise HTTPException(status_code=409, detail="That workout is already linked to another session")

    result = await db.execute(
        text("""
            UPDATE strength_sessions
            SET activity_log_id = :aid
            WHERE id = :id
            RETURNING id
        """),
        {"aid": body.activity_id, "id": id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.commit()
    return {"ok": True, "id": id}


# ---------------------------------------------------------------------------
# A3d2. PATCH /api/strength/sessions/{id}
# Edit session_datetime (date+time), session_label (split), and duration on
# manual_strength_logs via bridged_session_id.
# ---------------------------------------------------------------------------
class StrengthSessionUpdate(BaseModel):
    session_datetime: str | None = None   # ISO with +10:00 offset
    session_label: str | None = None      # "push" | "pull" | "legs" | "abs"
    duration_minutes: int | None = None


@router.patch("/strength/sessions/{id}")
async def update_strength_session(id: int, body: StrengthSessionUpdate, db: AsyncSession = Depends(get_db)):
    if body.session_datetime is not None:
        new_dt = datetime.fromisoformat(body.session_datetime)
        if new_dt.tzinfo is not None:
            new_dt = new_dt.astimezone(timezone.utc)
        await db.execute(
            text("UPDATE strength_sessions SET session_datetime = :dt WHERE id = :id"),
            {"dt": new_dt, "id": id},
        )

    if body.session_label is not None:
        await db.execute(
            text("UPDATE strength_sessions SET session_label = :label WHERE id = :id"),
            {"label": body.session_label, "id": id},
        )

    if body.duration_minutes is not None:
        await db.execute(
            text("UPDATE manual_strength_logs SET duration_minutes = :dur WHERE bridged_session_id = :id"),
            {"dur": body.duration_minutes, "id": id},
        )
        # For NLP-confirmed sessions (no manual_strength_logs row), also update the linked activity_log
        await db.execute(
            text("""
                UPDATE activity_logs SET duration_mins = :dur
                WHERE id = (
                    SELECT activity_log_id FROM strength_sessions
                    WHERE id = :id AND activity_log_id IS NOT NULL
                )
            """),
            {"dur": body.duration_minutes, "id": id},
        )

    await db.commit()
    return {"ok": True, "id": id}


# ---------------------------------------------------------------------------
# A3d. DELETE /api/strength/sessions/{id}
# Deletes a strength session and its related manual_strength_logs entry.
# ---------------------------------------------------------------------------
@router.delete("/strength/sessions/{id}")
async def delete_strength_session(id: int, db: AsyncSession = Depends(get_db)):
    # Check session exists
    row = await db.execute(
        text("SELECT id FROM strength_sessions WHERE id = :id"),
        {"id": id},
    )
    if not row.mappings().first():
        raise HTTPException(status_code=404, detail="Session not found")

    # Delete related manual_strength_logs (via bridged_session_id)
    await db.execute(
        text("DELETE FROM manual_strength_logs WHERE bridged_session_id = :id"),
        {"id": id},
    )
    # Delete the session itself
    await db.execute(
        text("DELETE FROM strength_sessions WHERE id = :id"),
        {"id": id},
    )
    await db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# A4. GET /api/strength/exercise/{exercise_id}/history?days=N
# Returns per-session history for one exercise (sparkline data).
# Epley 1RM formula: weight × (1 + reps/30)
# ---------------------------------------------------------------------------
@router.get("/strength/exercise/{exercise_id}/history")
async def exercise_history(
    exercise_id: int,
    days: int = Query(default=90),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text("""
            SELECT
                ss.id                                  AS session_id,
                (ss.session_datetime AT TIME ZONE 'Australia/Brisbane')::date AS session_date,
                COUNT(st.id)                           AS sets,
                SUM(st.reps)                           AS total_reps,
                MAX(st.reps)                           AS max_reps_in_set,
                MAX(COALESCE(st.weight_kg, 0))         AS top_weight_kg,
                SUM(st.reps * (CASE WHEN st.is_bodyweight THEN COALESCE(st.bodyweight_at_session, 0) ELSE 0 END + COALESCE(st.weight_kg, 0))) AS session_volume_kg,
                MAX(COALESCE(st.weight_kg, 0) * (1.0 + st.reps / 30.0)) AS estimated_1rm
            FROM strength_sessions ss
            JOIN strength_sets st ON st.session_id = ss.id
            WHERE st.exercise_id = :exercise_id
              AND ss.session_datetime >= CURRENT_TIMESTAMP - (:days * INTERVAL '1 day')
            GROUP BY ss.id, ss.session_datetime
            ORDER BY ss.session_datetime ASC
        """),
        {"exercise_id": exercise_id, "days": days},
    )
    rows = result.mappings().all()
    return [
        {
            "session_id": r["session_id"],
            "session_date": r["session_date"].isoformat() if r["session_date"] else None,
            "sets": r["sets"],
            "total_reps": r["total_reps"],
            "max_reps_in_set": int(r["max_reps_in_set"]) if r["max_reps_in_set"] is not None else 0,
            "top_weight_kg": float(r["top_weight_kg"]),
            "session_volume_kg": float(r["session_volume_kg"]),
            "estimated_1rm": round(float(r["estimated_1rm"]), 1),
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# T18. GET /api/strength/sessions/last-by-split/{split}
# Returns total_reps + BW-inclusive total_volume_kg for the most recent saved
# session of the given split.  Used by StrengthCard session-level comparison.
# ---------------------------------------------------------------------------
@router.get("/strength/sessions/last-by-split/{split}")
async def last_session_by_split(split: str, db: AsyncSession = Depends(get_db)):
    VALID_SPLITS = ("push", "pull", "legs", "abs")
    if split not in VALID_SPLITS:
        raise HTTPException(status_code=400, detail=f"split must be one of: {', '.join(VALID_SPLITS)}")

    result = await db.execute(
        text("""
            SELECT
                (ss.session_datetime AT TIME ZONE 'Australia/Brisbane')::date AS session_date,
                COALESCE(SUM(st.reps), 0)                                        AS total_reps,
                COALESCE(SUM(
                    st.reps * (CASE WHEN st.is_bodyweight THEN COALESCE(st.bodyweight_at_session, 0) ELSE 0 END + COALESCE(st.weight_kg, 0))
                ), 0)                                                             AS total_volume_kg
            FROM strength_sessions ss
            LEFT JOIN strength_sets st ON st.session_id = ss.id
            WHERE ss.session_label = :split
              AND ss.source = 'manual'
            GROUP BY ss.id, ss.session_datetime
            ORDER BY ss.session_datetime DESC
            LIMIT 1
        """),
        {"split": split},
    )
    row = result.mappings().first()
    if not row:
        return None
    return {
        "session_date": row["session_date"].isoformat() if row["session_date"] else None,
        "total_reps": int(row["total_reps"]),
        "total_volume_kg": round(float(row["total_volume_kg"])),
    }


# ---------------------------------------------------------------------------
# Water logging
# ---------------------------------------------------------------------------
#
# Migration (run once on Railway):
#   CREATE TABLE IF NOT EXISTS water_logs (
#     id          SERIAL PRIMARY KEY,
#     logged_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
#     ml          INTEGER NOT NULL CHECK (ml > 0)
#   );
#


class WaterLogCreate(BaseModel):
    ml: int
    logged_at: str | None = None


@router.post("/log/water")
async def log_water(body: WaterLogCreate, db: AsyncSession = Depends(get_db)):
    if body.logged_at:
        _dt = datetime.fromisoformat(body.logged_at)
        logged_at_val = _dt.astimezone(timezone.utc) if _dt.tzinfo else _dt
    else:
        logged_at_val = datetime.now(timezone.utc)
    result = await db.execute(
        text("""
            INSERT INTO water_logs (ml, logged_at)
            VALUES (:ml, :logged_at)
            RETURNING id, logged_at, ml
        """),
        {"ml": body.ml, "logged_at": logged_at_val},
    )
    await db.commit()
    row = result.mappings().one()
    return {
        "id": row["id"],
        "logged_at": row["logged_at"].isoformat(),
        "ml": row["ml"],
    }


BRISBANE_OFFSET = timedelta(hours=10)


@router.get("/water")
async def get_water(
    days: int = Query(default=1, ge=1, le=365),
    date: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    if date:
        d = datetime.fromisoformat(date).date()
        start = datetime(d.year, d.month, d.day, tzinfo=timezone(BRISBANE_OFFSET))
        end = start + timedelta(days=1)
        result = await db.execute(
            text("""
                SELECT id, logged_at, ml
                FROM water_logs
                WHERE logged_at >= :start AND logged_at < :end
                ORDER BY logged_at DESC
            """),
            {"start": start, "end": end},
        )
    else:
        result = await db.execute(
            text("""
                SELECT id, logged_at, ml
                FROM water_logs
                WHERE logged_at >= NOW() - (:days * INTERVAL '1 day')
                ORDER BY logged_at DESC
            """),
            {"days": days},
        )
    rows = result.mappings().all()
    return [
        {
            "id": r["id"],
            "logged_at": r["logged_at"].isoformat(),
            "ml": r["ml"],
        }
        for r in rows
    ]


@router.delete("/water/{entry_id}")
async def delete_water(entry_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("DELETE FROM water_logs WHERE id = :id RETURNING id"),
        {"id": entry_id},
    )
    await db.commit()
    if not result.rowcount:
        raise HTTPException(status_code=404, detail="Water entry not found")
    return {"deleted": entry_id}


# ---------------------------------------------------------------------------
# Mood & energy logging
# ---------------------------------------------------------------------------
#
# Migration (run once on Railway):
#   CREATE TABLE IF NOT EXISTS mood_logs (
#     id          SERIAL PRIMARY KEY,
#     logged_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
#     mood        SMALLINT NOT NULL CHECK (mood BETWEEN 1 AND 5),
#     energy      SMALLINT NOT NULL CHECK (energy BETWEEN 1 AND 5)
#   );
#


class MoodLogCreate(BaseModel):
    mood: int
    energy: int
    logged_at: str | None = None

    @field_validator("mood", "energy")
    @classmethod
    def validate_scale(cls, v: int) -> int:
        if v < 1 or v > 5:
            raise ValueError("must be between 1 and 5")
        return v


@router.post("/log/mood")
async def log_mood(body: MoodLogCreate, db: AsyncSession = Depends(get_db)):
    if body.logged_at:
        _dt = datetime.fromisoformat(body.logged_at)
        logged_at_val = _dt.astimezone(timezone.utc) if _dt.tzinfo else _dt
    else:
        logged_at_val = datetime.now(timezone.utc)
    result = await db.execute(
        text("""
            INSERT INTO mood_logs (mood, energy, logged_at)
            VALUES (:mood, :energy, :logged_at)
            RETURNING id, logged_at, mood, energy
        """),
        {"mood": body.mood, "energy": body.energy, "logged_at": logged_at_val},
    )
    await db.commit()
    row = result.mappings().one()
    return {
        "id": row["id"],
        "logged_at": row["logged_at"].isoformat(),
        "mood": row["mood"],
        "energy": row["energy"],
    }


@router.get("/mood")
async def get_mood(
    days: int = Query(default=1, ge=1, le=365),
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    from datetime import date as date_type, timedelta
    if start_date and end_date:
        start = date_type.fromisoformat(start_date)
        end = date_type.fromisoformat(end_date) + timedelta(days=1)
        result = await db.execute(
            text("""
                SELECT id, logged_at, mood, energy
                FROM mood_logs
                WHERE logged_at >= :start AND logged_at < :end
                ORDER BY logged_at DESC
            """),
            {"start": start, "end": end},
        )
    else:
        result = await db.execute(
            text("""
                SELECT id, logged_at, mood, energy
                FROM mood_logs
                WHERE logged_at >= NOW() - (:days * INTERVAL '1 day')
                ORDER BY logged_at DESC
            """),
            {"days": days},
        )
    rows = result.mappings().all()
    return [
        {
            "id": r["id"],
            "logged_at": r["logged_at"].isoformat(),
            "mood": r["mood"],
            "energy": r["energy"],
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# T15-1b. GET /api/energy-balance?days=N
# Returns daily rows for the Energy Balance chart.
# Burn = Withings TDEE from daily_summary (includes basal + all movement).
# Only returns days where food has been logged (tracking started Mar 7 2026).
# ---------------------------------------------------------------------------
@router.get("/energy-balance")
async def energy_balance(days: int = Query(default=30), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            WITH food_days AS (
                SELECT
                    log_date,
                    SUM(COALESCE(calories_kcal, 0))  AS calories_in,
                    SUM(COALESCE(protein_g, 0))       AS protein_g
                FROM food_logs
                WHERE log_date >= CURRENT_DATE - (:days * INTERVAL '1 day')::interval
                GROUP BY log_date
            ),
            burn_days AS (
                SELECT
                    activity_date                    AS burn_date,
                    -- Some Withings bulk-imported daily_summary rows store kJ not kcal.
                    -- Guard: any value > 8 000 is clearly kJ (≈ 1 912 kcal min — no human
                    -- burns > 8 000 kcal/day in normal life), so convert to kcal.
                    CASE
                        WHEN calories_burned > 8000
                             THEN ROUND(calories_burned / 4.184)::int
                        ELSE calories_burned
                    END                              AS calories_burned_total
                FROM activity_logs
                WHERE activity_type = 'daily_summary'
                  AND activity_date >= CURRENT_DATE - (:days * INTERVAL '1 day')::interval
            ),
            weight_days AS (
                SELECT DISTINCT ON ((recorded_at AT TIME ZONE 'Australia/Brisbane')::date)
                    (recorded_at AT TIME ZONE 'Australia/Brisbane')::date AS weight_date,
                    weight_kg
                FROM weight_logs
                WHERE (recorded_at AT TIME ZONE 'Australia/Brisbane')::date >= CURRENT_DATE - (:days * INTERVAL '1 day')::interval
                ORDER BY (recorded_at AT TIME ZONE 'Australia/Brisbane')::date, recorded_at DESC
            )
            SELECT
                fd.log_date                          AS date,
                fd.calories_in,
                fd.protein_g,
                bd.calories_burned_total,
                wd.weight_kg
            FROM food_days fd
            LEFT JOIN burn_days bd  ON bd.burn_date   = fd.log_date
            LEFT JOIN weight_days wd ON wd.weight_date = fd.log_date
            ORDER BY fd.log_date ASC
        """),
        {"days": days},
    )
    rows = result.mappings().all()
    return [
        {
            "date": r["date"].isoformat(),
            "calories_in": int(r["calories_in"]) if r["calories_in"] is not None else 0,
            "protein_g": round(float(r["protein_g"]), 1) if r["protein_g"] is not None else 0.0,
            "calories_burned_total": int(r["calories_burned_total"]) if r["calories_burned_total"] is not None else None,
            "weight_kg": round(float(r["weight_kg"]), 2) if r["weight_kg"] is not None else None,
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# T16-3. GET /api/hr/zones?days=N
# Returns per-session HR zone breakdown for cardio (run/ride) workouts.
# Columns hr_zone_0/1/2/3 added via main.py lifespan ALTER TABLE.
# ---------------------------------------------------------------------------
@router.get("/hr/zones")
async def hr_zones(days: int = Query(default=30, ge=1, le=365), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            SELECT
                activity_date                AS date,
                activity_type,
                ROUND(duration_mins)::int    AS duration_mins,
                hr_zone_0,
                hr_zone_1,
                hr_zone_2,
                hr_zone_3
            FROM activity_logs
            WHERE activity_type IN ('run', 'ride')
              AND activity_date >= CURRENT_DATE - (:days * INTERVAL '1 day')
              AND (hr_zone_0 IS NOT NULL OR hr_zone_1 IS NOT NULL
                   OR hr_zone_2 IS NOT NULL OR hr_zone_3 IS NOT NULL)
            ORDER BY activity_date ASC
        """),
        {"days": days},
    )
    rows = result.mappings().all()
    return [
        {
            "date": r["date"].isoformat(),
            "activity_type": r["activity_type"],
            "duration_mins": r["duration_mins"],
            "hr_zone_0": r["hr_zone_0"],
            "hr_zone_1": r["hr_zone_1"],
            "hr_zone_2": r["hr_zone_2"],
            "hr_zone_3": r["hr_zone_3"],
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# T19-3. PATCH /api/activity-logs/{id}
# Edit editable fields on an activity_logs row (runs, rides, workouts).
# ---------------------------------------------------------------------------
class ActivityLogUpdate(BaseModel):
    started_at: str | None = None       # ISO datetime string with timezone (e.g. 2026-03-14T07:30:00+10:00)
    activity_date: str | None = None    # YYYY-MM-DD — override calendar date
    duration_mins: float | None = None
    avg_hr: int | None = None
    min_hr: int | None = None
    max_hr: int | None = None
    distance_km: float | None = None
    avg_pace_secs: float | None = None
    calories_burned: int | None = None
    workout_split: str | None = None    # "push" | "pull" | "legs"


@router.patch("/activity-logs/{id}")
async def update_activity_log(id: int, body: ActivityLogUpdate, db: AsyncSession = Depends(get_db)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Resolve started_at string → UTC datetime to avoid asyncpg NULL-cast / tz-offset bug
    if "started_at" in updates and isinstance(updates["started_at"], str):
        _dt = datetime.fromisoformat(updates["started_at"])
        updates["started_at"] = _dt.astimezone(timezone.utc) if _dt.tzinfo else _dt

    # Resolve activity_date string → Python date
    if "activity_date" in updates and isinstance(updates["activity_date"], str):
        from datetime import date as date_type
        updates["activity_date"] = date_type.fromisoformat(updates["activity_date"])

    set_clause = ", ".join(f"{col} = :{col}" for col in updates)
    params = {**updates, "id": id}

    result = await db.execute(
        text(f"UPDATE activity_logs SET {set_clause} WHERE id = :id RETURNING *"),
        params,
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Propagate workout_split to linked strength_session.session_label so the feed reflects it
    if "workout_split" in updates:
        await db.execute(
            text("UPDATE strength_sessions SET session_label = :label WHERE activity_log_id = :id"),
            {"label": updates["workout_split"], "id": id},
        )

    await db.commit()
    return dict(row)


@router.delete("/activity-logs/{id}")
async def delete_activity_log(id: int, db: AsyncSession = Depends(get_db)):
    # NULL out any strength_sessions pointing to this activity before deleting
    await db.execute(
        text("UPDATE strength_sessions SET activity_log_id = NULL WHERE activity_log_id = :id"),
        {"id": id},
    )
    result = await db.execute(
        text("DELETE FROM activity_logs WHERE id = :id RETURNING id"),
        {"id": id},
    )
    if not result.mappings().first():
        raise HTTPException(status_code=404, detail="Activity not found")
    await db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# T19-3. PATCH /api/sleep/{id}
# Edit editable fields on a sleep_logs row.
# ---------------------------------------------------------------------------
class SleepLogUpdate(BaseModel):
    total_sleep_hrs: float | None = None
    deep_sleep_hrs: float | None = None
    light_sleep_hrs: float | None = None
    sleep_hr_avg: float | None = None
    sleep_score: float | None = None


@router.patch("/sleep/{id}")
async def update_sleep_log(id: int, body: SleepLogUpdate, db: AsyncSession = Depends(get_db)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_clause = ", ".join(f"{col} = :{col}" for col in updates)
    params = {**updates, "id": id}

    result = await db.execute(
        text(f"UPDATE sleep_logs SET {set_clause} WHERE id = :id RETURNING id, sleep_date, total_sleep_hrs, deep_sleep_hrs, sleep_hr_avg, sleep_score"),
        params,
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Sleep record not found")
    await db.commit()
    return dict(row)


# ---------------------------------------------------------------------------
# T19-3. PATCH /api/sauna/{id}
# Edit editable fields on a sauna_logs row.
# ---------------------------------------------------------------------------
class SaunaLogUpdate(BaseModel):
    duration_mins: int | None = None
    temperature_c: int | None = None
    did_breathing: bool | None = None
    did_devotions: bool | None = None


@router.patch("/sauna/{id}")
async def update_sauna_log(id: int, body: SaunaLogUpdate, db: AsyncSession = Depends(get_db)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_clause = ", ".join(f"{col} = :{col}" for col in updates)
    params = {**updates, "id": id}

    result = await db.execute(
        text(f"UPDATE sauna_logs SET {set_clause} WHERE id = :id RETURNING id, session_datetime, duration_mins, temperature_c, did_breathing, did_devotions"),
        params,
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Sauna record not found")
    await db.commit()
    return dict(row)


# ---------------------------------------------------------------------------
# Muscle Groups — CRUD
# ---------------------------------------------------------------------------
MACRO_GROUPS = {"push", "pull", "legs", "abs", "other"}

# Maps muscle_group name → macro_group for category derivation
MUSCLE_TO_MACRO: dict[str, str] = {
    "chest": "push", "shoulders": "push", "arms": "push",
    "back": "pull",
    "legs": "legs",
    "core": "abs",
    "other": "other",
}


@router.get("/muscle-groups", response_model=list[MuscleGroupResponse])
async def list_muscle_groups(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(MuscleGroup).order_by(MuscleGroup.macro_group, MuscleGroup.name)
    )).scalars().all()
    return rows


@router.post("/muscle-groups", response_model=MuscleGroupResponse, status_code=201)
async def create_muscle_group(body: MuscleGroupCreate, db: AsyncSession = Depends(get_db)):
    if body.macro_group not in MACRO_GROUPS:
        raise HTTPException(400, f"macro_group must be one of {MACRO_GROUPS}")
    existing = (await db.execute(
        select(MuscleGroup).where(func.lower(MuscleGroup.name) == body.name.lower())
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(409, f"Muscle group '{body.name}' already exists")
    mg = MuscleGroup(name=body.name.lower(), macro_group=body.macro_group)
    db.add(mg)
    await db.flush()
    return mg


# ---------------------------------------------------------------------------
# Exercise update — PATCH /api/exercises/{id}
# ---------------------------------------------------------------------------
@router.patch("/exercises/{exercise_id}")
async def update_exercise(exercise_id: int, body: ExerciseUpdateRequest, db: AsyncSession = Depends(get_db)):
    exercise = (await db.execute(
        select(Exercise).where(Exercise.id == exercise_id)
    )).scalar_one_or_none()
    if not exercise:
        raise HTTPException(404, "Exercise not found")

    # Update optional fields
    if body.uses_bodyweight is not None:
        exercise.uses_bodyweight = body.uses_bodyweight
    if body.notes is not None:
        exercise.notes = body.notes

    # Replace muscle tags
    if body.muscles:
        # Delete existing links
        await db.execute(
            text("DELETE FROM exercise_muscles WHERE exercise_id = :eid"),
            {"eid": exercise_id},
        )

        primary_macro = None
        for m in body.muscles:
            mg_name = m.get("muscle_group", "").lower().strip()
            is_primary = m.get("is_primary", True)

            # Look up muscle group
            mg = (await db.execute(
                select(MuscleGroup).where(func.lower(MuscleGroup.name) == mg_name)
            )).scalar_one_or_none()
            if not mg:
                raise HTTPException(400, f"Unknown muscle group '{mg_name}'. Create it first via POST /api/muscle-groups.")

            em = ExerciseMuscle(exercise_id=exercise_id, muscle_group_id=mg.id, is_primary=is_primary)
            db.add(em)

            # Track primary muscle name for backwards compat category
            if is_primary and primary_macro is None:
                primary_macro = mg.name

        # Update exercises.category with the primary muscle name for backwards compat
        # Must be the muscle name (e.g. "back"), not macro_group (e.g. "pull"),
        # because _session_category() maps muscle names → macro groups.
        if primary_macro:
            exercise.category = primary_macro

    await db.flush()

    # Return updated exercise with muscles
    muscles = (await db.execute(
        select(ExerciseMuscle, MuscleGroup)
        .join(MuscleGroup, ExerciseMuscle.muscle_group_id == MuscleGroup.id)
        .where(ExerciseMuscle.exercise_id == exercise_id)
    )).all()

    return {
        "id": exercise.id,
        "name": exercise.name,
        "category": exercise.category,
        "uses_bodyweight": exercise.uses_bodyweight,
        "notes": exercise.notes,
        "muscles": [
            {"muscle_group": mg.name, "macro_group": mg.macro_group, "is_primary": em.is_primary}
            for em, mg in muscles
        ],
    }


# ---------------------------------------------------------------------------
# Label Scan — vision AI nutrition extraction
# ---------------------------------------------------------------------------
class LabelScanRequest(BaseModel):
    image_base64: str
    mode: str = "label"  # "label" or "recipe"

@router.post("/log/food/scan")
async def scan_food_label(body: LabelScanRequest):
    """Send a photo of a nutrition label or recipe to Claude Vision for extraction."""
    from app.services.claude_service import parse_label_image

    if not body.image_base64:
        raise HTTPException(status_code=400, detail="image_base64 is required")
    if body.mode not in ("label", "recipe"):
        raise HTTPException(status_code=400, detail="mode must be 'label' or 'recipe'")

    try:
        result = await parse_label_image(body.image_base64, body.mode)
        return result
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Label scan failed: {e}")


# ---------------------------------------------------------------------------
# Recipes — CRUD for saved recipes with ingredient breakdowns
# ---------------------------------------------------------------------------
class RecipeCreate(BaseModel):
    name: str
    total_weight_g: float | None = None
    servings: float = 1
    calories_kcal: int
    protein_g: float = 0
    carbs_g: float = 0
    fat_g: float = 0
    ingredients: list = []  # [{name, grams, calories_kcal, protein_g, carbs_g, fat_g}]

class RecipeUpdate(BaseModel):
    name: str | None = None
    total_weight_g: float | None = None
    servings: float | None = None
    calories_kcal: int | None = None
    protein_g: float | None = None
    carbs_g: float | None = None
    fat_g: float | None = None
    ingredients: list | None = None

def _recipe_row(r: dict) -> dict:
    """Serialize a recipes row — NUMERIC columns come back as Decimal."""
    import json as _json
    ingredients = r.get("ingredients", [])
    if isinstance(ingredients, str):
        ingredients = _json.loads(ingredients)
    return {
        "id": r["id"],
        "name": r["name"],
        "total_weight_g": float(r["total_weight_g"]) if r.get("total_weight_g") else None,
        "servings": float(r["servings"]) if r.get("servings") else 1,
        "calories_kcal": int(r["calories_kcal"]),
        "protein_g": float(r["protein_g"]) if r.get("protein_g") is not None else 0.0,
        "carbs_g": float(r["carbs_g"]) if r.get("carbs_g") is not None else 0.0,
        "fat_g": float(r["fat_g"]) if r.get("fat_g") is not None else 0.0,
        "ingredients": ingredients,
        "created_at": r.get("created_at"),
        "updated_at": r.get("updated_at"),
    }


@router.get("/recipes")
async def list_recipes(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("SELECT * FROM recipes ORDER BY updated_at DESC")
    )
    return [_recipe_row(dict(r)) for r in result.mappings().all()]


@router.post("/recipes")
async def create_recipe(body: RecipeCreate, db: AsyncSession = Depends(get_db)):
    import json as _json
    result = await db.execute(
        text("""
            INSERT INTO recipes (name, total_weight_g, servings, calories_kcal, protein_g, carbs_g, fat_g, ingredients)
            VALUES (:name, :total_weight_g, :servings, :calories_kcal, :protein_g, :carbs_g, :fat_g, CAST(:ingredients AS jsonb))
            RETURNING *
        """),
        {
            "name": body.name,
            "total_weight_g": body.total_weight_g,
            "servings": body.servings,
            "calories_kcal": body.calories_kcal,
            "protein_g": body.protein_g,
            "carbs_g": body.carbs_g,
            "fat_g": body.fat_g,
            "ingredients": _json.dumps(body.ingredients),
        },
    )
    row = result.mappings().first()
    return _recipe_row(dict(row))


@router.patch("/recipes/{recipe_id}")
async def update_recipe(recipe_id: int, body: RecipeUpdate, db: AsyncSession = Depends(get_db)):
    import json as _json
    # Build SET clause dynamically from provided fields
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_clauses = []
    params: dict = {"id": recipe_id}
    for key, val in updates.items():
        if key == "ingredients":
            set_clauses.append(f"{key} = CAST(:{key} AS jsonb)")
            params[key] = _json.dumps(val)
        else:
            set_clauses.append(f"{key} = :{key}")
            params[key] = val
    set_clauses.append("updated_at = NOW()")

    result = await db.execute(
        text(f"UPDATE recipes SET {', '.join(set_clauses)} WHERE id = :id RETURNING *"),
        params,
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return _recipe_row(dict(row))


@router.delete("/recipes/{recipe_id}")
async def delete_recipe(recipe_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("DELETE FROM recipes WHERE id = :id RETURNING id"),
        {"id": recipe_id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return {"ok": True}
