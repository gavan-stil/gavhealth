"""GET /api/test — returns sample data from each table for full-stack verification."""

from datetime import date, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import verify_api_key
from app.database import get_db
from app.models.health import (
    ActivityLog,
    DailyHabit,
    DexaScan,
    Exercise,
    FoodLog,
    RhrLog,
    SaunaLog,
    SleepLog,
    StrengthSession,
    StrengthSet,
    WeightLog,
)

router = APIRouter(prefix="/api", tags=["test"])


@router.get("/test")
async def test_data(
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(verify_api_key),
):
    """Return one sample row from each table + row counts. For wiring verification."""

    async def _sample(model):
        row = (await db.execute(select(model).limit(1))).scalar_one_or_none()
        count = (
            await db.execute(select(func.count()).select_from(model))
        ).scalar_one()
        return {"count": count, "sample": _row_to_dict(row) if row else None}

    def _row_to_dict(row):
        if row is None:
            return None
        d = {}
        for col in row.__table__.columns:
            val = getattr(row, col.name)
            if isinstance(val, (date, datetime)):
                val = val.isoformat()
            d[col.name] = val
        return d

    return {
        "status": "ok",
        "tables": {
            "weight_log": await _sample(WeightLog),
            "sleep_log": await _sample(SleepLog),
            "activity_log": await _sample(ActivityLog),
            "rhr_log": await _sample(RhrLog),
            "food_log": await _sample(FoodLog),
            "sauna_log": await _sample(SaunaLog),
            "daily_habit": await _sample(DailyHabit),
            "exercise": await _sample(Exercise),
            "strength_session": await _sample(StrengthSession),
            "strength_set": await _sample(StrengthSet),
            "dexa_scan": await _sample(DexaScan),
        },
    }
