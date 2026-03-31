"""Daily summary, weekly summary, and readiness endpoints."""

from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import verify_api_key
from app.database import get_db
from app.models.health import (
    ActivityLog,
    DailySummary,
    FoodLog,
    RhrLog,
    SaunaLog,
    SleepLog,
    WeightLog,
)
from app.schemas.health import DailySummaryResponse, ReadinessResponse, WeeklySummaryResponse
from app.services.claude_service import get_readiness

router = APIRouter(prefix="/api", tags=["summary"])


@router.get("/summary/daily", response_model=DailySummaryResponse)
async def daily_summary(
    target_date: date = Query(default_factory=date.today, alias="date"),
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(verify_api_key),
):
    """Aggregate daily summary: readiness, weight, sleep, RHR, nutrition, activity."""
    # Check for a cached daily summary first
    cached = (
        await db.execute(
            select(DailySummary).where(DailySummary.summary_date == target_date)
        )
    ).scalar_one_or_none()

    if cached:
        return cached

    # Build on the fly
    # Weight — latest for the day
    weight_row = (
        await db.execute(
            select(WeightLog.weight_kg)
            .where(func.date(func.timezone('Australia/Brisbane', WeightLog.recorded_at)) == target_date)
            .order_by(WeightLog.recorded_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    # Sleep
    sleep_row = (
        await db.execute(
            select(SleepLog)
            .where(SleepLog.sleep_date == target_date)
            .order_by(SleepLog.source.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    # RHR
    rhr_row = (
        await db.execute(
            select(RhrLog.rhr_bpm)
            .where(RhrLog.log_date == target_date)
            .order_by(RhrLog.source.desc())  # "withings" > "withings_csv" alphabetically
            .limit(1)
        )
    ).scalar_one_or_none()

    # Nutrition totals
    food_agg = (
        await db.execute(
            select(
                func.sum(FoodLog.calories_kcal),
                func.sum(FoodLog.protein_g),
            ).where(FoodLog.log_date == target_date)
        )
    ).one()

    # Activity count + load
    activity_agg = (
        await db.execute(
            select(
                func.count(),
                func.coalesce(func.sum(ActivityLog.duration_mins), 0),
            ).where(ActivityLog.activity_date == target_date)
        )
    ).one()

    # Readiness
    readiness = await get_readiness(db, target_date)

    return DailySummaryResponse(
        summary_date=target_date,
        readiness_score=readiness["readiness_score"],
        weight_kg=weight_row,
        total_sleep_hrs=sleep_row.total_sleep_hrs if sleep_row else None,
        deep_sleep_hrs=sleep_row.deep_sleep_hrs if sleep_row else None,
        sleep_score=sleep_row.sleep_score if sleep_row else None,
        rhr_bpm=rhr_row,
        hrv_ms=None,  # populated by data pipeline
        calories_kcal=food_agg[0],
        protein_g=food_agg[1],
        activity_count=activity_agg[0],
        training_load_mins=float(activity_agg[1]) if activity_agg[1] else None,
        strain_score=None,
    )


@router.get("/readiness", response_model=ReadinessResponse)
async def readiness(
    target_date: date = Query(default_factory=date.today, alias="date"),
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(verify_api_key),
):
    """Full readiness breakdown with component scores."""
    result = await get_readiness(db, target_date)
    return ReadinessResponse(**result)


@router.get("/summary/weekly", response_model=list[WeeklySummaryResponse])
async def weekly_summary(
    weeks: int = Query(8, le=52),
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(verify_api_key),
):
    """Aggregate weekly health summary for the last N weeks."""
    today = date.today()
    # Align to Monday of the current week
    current_monday = today - timedelta(days=today.weekday())

    results = []
    for i in range(weeks):
        week_start = current_monday - timedelta(weeks=i)
        week_end = week_start + timedelta(days=6)

        # Avg RHR
        rhr_val = (
            await db.execute(
                select(func.avg(RhrLog.rhr_bpm)).where(
                    RhrLog.log_date >= week_start,
                    RhrLog.log_date <= week_end,
                )
            )
        ).scalar_one_or_none()

        # Avg sleep
        sleep_agg = (
            await db.execute(
                select(
                    func.avg(SleepLog.total_sleep_hrs),
                    func.avg(SleepLog.deep_sleep_hrs),
                ).where(
                    SleepLog.sleep_date >= week_start,
                    SleepLog.sleep_date <= week_end,
                )
            )
        ).one()

        # Training sessions
        training_count = (
            await db.execute(
                select(func.count()).select_from(ActivityLog).where(
                    ActivityLog.activity_date >= week_start,
                    ActivityLog.activity_date <= week_end,
                )
            )
        ).scalar_one()

        # Sauna sessions
        sauna_count = (
            await db.execute(
                select(func.count()).select_from(SaunaLog).where(
                    func.date(SaunaLog.session_datetime) >= week_start,
                    func.date(SaunaLog.session_datetime) <= week_end,
                )
            )
        ).scalar_one()

        # Avg nutrition
        food_agg = (
            await db.execute(
                select(
                    func.avg(FoodLog.calories_kcal),
                    func.avg(FoodLog.protein_g),
                ).where(
                    FoodLog.log_date >= week_start,
                    FoodLog.log_date <= week_end,
                )
            )
        ).one()

        results.append(
            WeeklySummaryResponse(
                week_start=week_start,
                week_end=week_end,
                avg_rhr=float(rhr_val) if rhr_val else None,
                avg_sleep_hrs=float(sleep_agg[0]) if sleep_agg[0] else None,
                avg_deep_sleep_hrs=float(sleep_agg[1]) if sleep_agg[1] else None,
                total_training_sessions=int(training_count),
                total_sauna_sessions=int(sauna_count),
                avg_calories=float(food_agg[0]) if food_agg[0] else None,
                avg_protein_g=float(food_agg[1]) if food_agg[1] else None,
            )
        )

    return results
