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

    try:
        ref_dt = dtparse(body.start_time)
        low = (ref_dt - timedelta(minutes=30)).isoformat()
        high = (ref_dt + timedelta(minutes=30)).isoformat()
    except Exception:
        low = body.start_time
        high = body.start_time

    match_result = await db.execute(
        text("""
            SELECT id FROM activity_logs
            WHERE activity_type = 'strength'
              AND start_time BETWEEN :low AND :high
            ORDER BY ABS(EXTRACT(EPOCH FROM (start_time - :ref::timestamp)))
            LIMIT 1
        """),
        {"low": low, "high": high, "ref": body.start_time},
    )
    match_row = match_result.mappings().first()

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
            SELECT log_date AS date, exercises
            FROM manual_strength_logs
            WHERE workout_split = :split
            ORDER BY log_date DESC, start_time DESC
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
# 6. GET /api/activities/linkable
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


# 8. GET /api/saved-meals
@router.get("/saved-meals")
async def list_saved_meals(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            SELECT id, name, calories_kcal,
                   protein_g::float AS protein_g,
                   carbs_g::float   AS carbs_g,
                   fat_g::float     AS fat_g
            FROM saved_meals
            ORDER BY created_at ASC
        """)
    )
    return [dict(r) for r in result.mappings().all()]


# 9. POST /api/saved-meals
@router.post("/saved-meals")
async def create_saved_meal(body: SavedMealCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            INSERT INTO saved_meals (name, calories_kcal, protein_g, carbs_g, fat_g)
            VALUES (:name, :calories_kcal, :protein_g, :carbs_g, :fat_g)
            RETURNING id, name, calories_kcal,
                      protein_g::float AS protein_g,
                      carbs_g::float   AS carbs_g,
                      fat_g::float     AS fat_g
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
    return dict(row)


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
