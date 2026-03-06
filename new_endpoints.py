"""New endpoints: activity effort, activity feed, manual strength logging."""

from datetime import datetime, timedelta

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


# ---------------------------------------------------------------------------
# 1. PATCH /api/activities/{id}/effort
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
# ---------------------------------------------------------------------------
@router.get("/activities/feed")
async def activities_feed(days: int = Query(default=14), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            SELECT id, type, name, date, start_time, duration_minutes,
                   avg_bpm, effort, effort_manually_set
            FROM activity_logs
            WHERE date >= CURRENT_DATE - :days
            ORDER BY date DESC, start_time DESC
        """),
        {"days": days},
    )
    return [dict(r) for r in result.mappings().all()]


# ---------------------------------------------------------------------------
# 7. GET /api/habits
# ---------------------------------------------------------------------------
@router.get("/habits")
async def get_habits_history(days: int = Query(default=14), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            SELECT id, habit_date, did_breathing, did_devotions, notes
            FROM daily_habits
            WHERE habit_date >= CURRENT_DATE - :days
            ORDER BY habit_date DESC
        """),
        {"days": days},
    )
    return [dict(r) for r in result.mappings().all()]
# ---------------------------------------------------------------------------
# 3. POST /api/log/strength/save
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
    log_start = inserted["start_time"]

    # Try to match an activity_logs row within ±30 min
    matched_activity_id = None
    match_confirmed = False

    match_result = await db.execute(
        text("""
            SELECT id FROM activity_logs
            WHERE type = 'strength'
              AND start_time BETWEEN :low AND :high
            ORDER BY ABS(EXTRACT(EPOCH FROM (start_time - :ref::timestamp)))
            LIMIT 1
        """),
        {
            "low": body.start_time,  # will be cast by PG
            "high": body.start_time,
            "ref": body.start_time,
        },
    )
    # Recalculate bounds properly
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
            WHERE type = 'strength'
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
            SELECT date, exercises
            FROM manual_strength_logs
            WHERE workout_split = :split
            ORDER BY date DESC, start_time DESC
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
            SELECT id, type, name, date, start_time, duration_minutes
            FROM activity_logs
            WHERE date >= CURRENT_DATE - :days
            ORDER BY date DESC, start_time DESC
        """),
        {"days": days},
    )
    return [dict(r) for r in result.mappings().all()]
