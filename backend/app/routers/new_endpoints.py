"""New endpoints: activity effort, activity feed, manual strength logging, food & nutrition."""

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import verify_api_key
from app.database import get_db

router = APIRouter(prefix="/api", tags=["activities"], dependencies=[Depends(verify_api_key)])


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
    start_time: str
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
    logged_at: str | None = None


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
                   duration_mins                          AS duration_minutes,
                   avg_hr                                 AS avg_bpm,
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
            "duration_minutes": r["duration_minutes"],
            "avg_bpm": r["avg_bpm"],
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

    result = await db.execute(
        text("""
            INSERT INTO manual_strength_logs
                (workout_split, exercises, start_time, duration_minutes, notes)
            VALUES (:workout_split, :exercises, :start_time, :duration_minutes, :notes)
            RETURNING id, start_time
        """),
        {
            "workout_split": body.workout_split,
            "exercises": exercises_json,
            "start_time": body.start_time,
            "duration_minutes": body.duration_minutes,
            "notes": body.notes,
        },
    )
    inserted = result.mappings().first()
    log_id = inserted["id"]

    matched_activity_id = None
    match_confirmed = False

    from dateutil.parser import parse as dtparse

    ref_date = body.start_time[:10]  # fallback: first 10 chars of "YYYY-MM-DDTHH:MM:SS"
    try:
        ref_date = dtparse(body.start_time).date().isoformat()
    except Exception:
        pass

    try:
        match_result = await db.execute(
            text("""
                SELECT id FROM activity_logs
                WHERE activity_type = 'workout'
                  AND activity_date = :ref_date
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
            SELECT created_at::date AS date, exercises
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
    await db.commit()
    return dict(row)


# ---------------------------------------------------------------------------
# 6. GET /api/log/strength/sessions
# ---------------------------------------------------------------------------
@router.get("/log/strength/sessions")
async def list_strength_sessions(days: int = Query(default=14), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            SELECT id, created_at::date AS log_date, workout_split, duration_minutes,
                   jsonb_array_length(exercises) AS exercise_count,
                   matched_activity_id, match_confirmed
            FROM manual_strength_logs
            WHERE created_at >= CURRENT_DATE - (:days * INTERVAL '1 day')
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
    result = await db.execute(
        text("""
            INSERT INTO food_logs
                (description_raw, meal_label, log_date,
                 protein_g, carbs_g, fat_g, calories_kcal, confidence, source)
            VALUES
                (:name, 'snack', CURRENT_DATE,
                 :protein_g, :carbs_g, :fat_g, :calories_kcal, 'high', 'manual')
            RETURNING id, description_raw, log_date, calories_kcal,
                      protein_g, carbs_g, fat_g
        """),
        {
            "name": body.name,
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
                ss.session_datetime::date              AS session_date,
                ss.activity_log_id,
                al.duration_mins,
                al.avg_hr,
                al.calories_burned                     AS calories,
                COUNT(st.id)                           AS total_sets,
                COALESCE(SUM(st.reps), 0)              AS total_reps,
                COALESCE(SUM(
                    (COALESCE(st.bodyweight_at_session, 0) + COALESCE(st.weight_kg, 0))
                    * st.reps
                ), 0)                                  AS total_load_kg,
                CASE WHEN COUNT(st.id) > 0 THEN
                    COALESCE(SUM(
                        (COALESCE(st.bodyweight_at_session, 0) + COALESCE(st.weight_kg, 0))
                        * st.reps
                    ), 0) / COUNT(st.id)
                ELSE 0 END                             AS avg_load_per_set_kg,
                ARRAY_AGG(DISTINCT e.name)             AS exercises
            FROM strength_sessions ss
            LEFT JOIN strength_sets st ON st.session_id = ss.id
            LEFT JOIN exercises e ON e.id = st.exercise_id
            LEFT JOIN activity_logs al ON al.id = ss.activity_log_id
            WHERE ss.session_datetime >= CURRENT_TIMESTAMP - (:days * INTERVAL '1 day')
            GROUP BY ss.id, ss.session_datetime, ss.activity_log_id,
                     al.duration_mins, al.avg_hr, al.calories_burned
            ORDER BY ss.session_datetime DESC
        """),
        {"days": days},
    )
    rows = result.mappings().all()
    return [
        {
            "id": r["id"],
            "session_date": r["session_date"].isoformat() if r["session_date"] else None,
            "activity_log_id": r["activity_log_id"],
            "duration_mins": float(r["duration_mins"]) if r["duration_mins"] is not None else None,
            "avg_hr": r["avg_hr"],
            "calories": r["calories"],
            "total_sets": r["total_sets"],
            "total_reps": r["total_reps"],
            "total_load_kg": float(r["total_load_kg"]),
            "avg_load_per_set_kg": float(r["avg_load_per_set_kg"]),
            "exercises": [e for e in (r["exercises"] or []) if e is not None],
        }
        for r in rows
    ]


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
                ss.session_datetime::date              AS session_date,
                COUNT(st.id)                           AS sets,
                SUM(st.reps)                           AS total_reps,
                MAX(COALESCE(st.weight_kg, 0))         AS top_weight_kg,
                SUM(st.reps * COALESCE(st.weight_kg, 0)) AS session_volume_kg,
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
            "session_date": r["session_date"].isoformat() if r["session_date"] else None,
            "sets": r["sets"],
            "total_reps": r["total_reps"],
            "top_weight_kg": float(r["top_weight_kg"]),
            "session_volume_kg": float(r["session_volume_kg"]),
            "estimated_1rm": round(float(r["estimated_1rm"]), 1),
        }
        for r in rows
    ]


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
    result = await db.execute(
        text("""
            INSERT INTO water_logs (ml, logged_at)
            VALUES (:ml, COALESCE(:logged_at::timestamptz, NOW()))
            RETURNING id, logged_at, ml
        """),
        {"ml": body.ml, "logged_at": body.logged_at},
    )
    await db.commit()
    row = result.mappings().one()
    return {
        "id": row["id"],
        "logged_at": row["logged_at"].isoformat(),
        "ml": row["ml"],
    }


@router.get("/water")
async def get_water(
    days: int = Query(default=1, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
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
    result = await db.execute(
        text("""
            INSERT INTO mood_logs (mood, energy, logged_at)
            VALUES (:mood, :energy, COALESCE(:logged_at::timestamptz, NOW()))
            RETURNING id, logged_at, mood, energy
        """),
        {"mood": body.mood, "energy": body.energy, "logged_at": body.logged_at},
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
    db: AsyncSession = Depends(get_db),
):
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
