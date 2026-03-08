"""Read-only data endpoints: weight, sleep, activity, RHR, DEXA, streaks, settings,
food, sauna, exercises, strength history, strength PRs."""

from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, text, update
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
    UserSettings,
    WeightLog,
)
from app.schemas.common import PaginatedResponse
from app.schemas.health import (
    ActivityResponse,
    DexaCreate,
    DexaResponse,
    ExerciseResponse,
    FoodResponse,
    FoodWeeklyResponse,
    RhrResponse,
    SaunaResponse,
    SettingsResponse,
    SettingsUpdate,
    SleepResponse,
    StreakResponse,
    StrengthPRResponse,
    StrengthSetHistoryRow,
    WeightResponse,
)

router = APIRouter(prefix="/api", tags=["data"])


# ---------------------------------------------------------------------------
# Weight
# ---------------------------------------------------------------------------
@router.get("/weight", response_model=PaginatedResponse[WeightResponse])
async def list_weights(
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(verify_api_key),
):
    q = select(WeightLog).order_by(WeightLog.recorded_at.desc())
    count_q = select(func.count()).select_from(WeightLog)

    if start_date:
        q = q.where(func.date(WeightLog.recorded_at) >= start_date)
        count_q = count_q.where(func.date(WeightLog.recorded_at) >= start_date)
    if end_date:
        q = q.where(func.date(WeightLog.recorded_at) <= end_date)
        count_q = count_q.where(func.date(WeightLog.recorded_at) <= end_date)

    total = (await db.execute(count_q)).scalar_one()
    rows = (await db.execute(q.limit(limit).offset(offset))).scalars().all()

    return PaginatedResponse(data=rows, total=total, limit=limit, offset=offset)


# ---------------------------------------------------------------------------
# Sleep
# ---------------------------------------------------------------------------
@router.get("/sleep", response_model=PaginatedResponse[SleepResponse])
async def list_sleep(
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(verify_api_key),
):
    q = select(SleepLog).order_by(SleepLog.sleep_date.desc())
    count_q = select(func.count()).select_from(SleepLog)

    if start_date:
        q = q.where(SleepLog.sleep_date >= start_date)
        count_q = count_q.where(SleepLog.sleep_date >= start_date)
    if end_date:
        q = q.where(SleepLog.sleep_date <= end_date)
        count_q = count_q.where(SleepLog.sleep_date <= end_date)

    total = (await db.execute(count_q)).scalar_one()
    rows = (await db.execute(q.limit(limit).offset(offset))).scalars().all()

    return PaginatedResponse(data=rows, total=total, limit=limit, offset=offset)


# ---------------------------------------------------------------------------
# Activity
# ---------------------------------------------------------------------------
@router.get("/activity", response_model=PaginatedResponse[ActivityResponse])
async def list_activities(
    start_date: date | None = None,
    end_date: date | None = None,
    activity_type: str | None = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(verify_api_key),
):
    filters = []
    params: dict = {"limit": limit, "offset": offset}
    if start_date:
        filters.append("a.activity_date >= :start_date")
        params["start_date"] = start_date
    if end_date:
        filters.append("a.activity_date <= :end_date")
        params["end_date"] = end_date
    if activity_type:
        filters.append("a.activity_type = :activity_type")
        params["activity_type"] = activity_type

    where = ("WHERE " + " AND ".join(filters)) if filters else ""

    total = (await db.execute(
        text(f"SELECT COUNT(*) FROM activity_logs a {where}"),
        params,
    )).scalar_one()

    rows = await db.execute(
        text(f"""
            SELECT a.id, a.activity_date, a.activity_type, a.duration_mins,
                   a.distance_km, a.avg_pace_secs, a.avg_hr, a.max_hr,
                   a.calories_burned, a.elevation_m, a.source, a.external_id, a.notes,
                   ss.session_label AS workout_split
            FROM activity_logs a
            LEFT JOIN strength_sessions ss ON ss.activity_log_id = a.id
            {where}
            ORDER BY a.activity_date DESC
            LIMIT :limit OFFSET :offset
        """),
        params,
    )
    data = [ActivityResponse.model_validate(dict(r)) for r in rows.mappings()]
    return PaginatedResponse(data=data, total=total, limit=limit, offset=offset)


# ---------------------------------------------------------------------------
# RHR
# ---------------------------------------------------------------------------
@router.get("/rhr", response_model=PaginatedResponse[RhrResponse])
async def list_rhr(
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(verify_api_key),
):
    q = select(RhrLog).order_by(RhrLog.log_date.desc())
    count_q = select(func.count()).select_from(RhrLog)

    if start_date:
        q = q.where(RhrLog.log_date >= start_date)
        count_q = count_q.where(RhrLog.log_date >= start_date)
    if end_date:
        q = q.where(RhrLog.log_date <= end_date)
        count_q = count_q.where(RhrLog.log_date <= end_date)

    total = (await db.execute(count_q)).scalar_one()
    rows = (await db.execute(q.limit(limit).offset(offset))).scalars().all()

    return PaginatedResponse(data=rows, total=total, limit=limit, offset=offset)


# ---------------------------------------------------------------------------
# DEXA
# ---------------------------------------------------------------------------
@router.get("/dexa", response_model=list[DexaResponse])
async def list_dexa(
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(verify_api_key),
):
    rows = (
        await db.execute(select(DexaScan).order_by(DexaScan.scan_date.desc()))
    ).scalars().all()
    return rows


@router.post("/dexa", response_model=DexaResponse, status_code=201)
async def create_dexa(
    body: DexaCreate,
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(verify_api_key),
):
    scan = DexaScan(**body.model_dump())
    db.add(scan)
    await db.flush()
    await db.refresh(scan)
    return scan


# ---------------------------------------------------------------------------
# Streaks
# ---------------------------------------------------------------------------
@router.get("/streaks", response_model=StreakResponse)
async def get_streaks(
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(verify_api_key),
):
    today = date.today()

    async def _streak(check_fn) -> tuple[int, int]:
        """Return (current_streak, longest_streak)."""
        current = 0
        longest = 0
        streak = 0
        # Scan last 365 days
        for offset in range(365):
            d = today - timedelta(days=offset)
            if await check_fn(d):
                streak += 1
                if offset == current:  # still in current streak
                    current = streak
            else:
                longest = max(longest, streak)
                streak = 0
        longest = max(longest, streak)
        return current, longest

    async def _has_breathing(d: date) -> bool:
        row = (await db.execute(
            select(DailyHabit.did_breathing).where(DailyHabit.habit_date == d)
        )).scalar_one_or_none()
        return bool(row)

    async def _has_devotions(d: date) -> bool:
        row = (await db.execute(
            select(DailyHabit.did_devotions).where(DailyHabit.habit_date == d)
        )).scalar_one_or_none()
        return bool(row)

    async def _has_sauna(d: date) -> bool:
        count = (await db.execute(
            select(func.count()).select_from(SaunaLog)
            .where(func.date(SaunaLog.session_datetime) == d)
        )).scalar_one()
        return count > 0

    async def _has_training(d: date) -> bool:
        count = (await db.execute(
            select(func.count()).select_from(ActivityLog)
            .where(ActivityLog.activity_date == d)
        )).scalar_one()
        return count > 0

    bc, bl = await _streak(_has_breathing)
    dc, dl = await _streak(_has_devotions)
    sc, sl = await _streak(_has_sauna)
    tc, tl = await _streak(_has_training)

    return StreakResponse(
        breathing_current=bc, breathing_longest=bl,
        devotions_current=dc, devotions_longest=dl,
        sauna_current=sc, sauna_longest=sl,
        training_current=tc, training_longest=tl,
    )


# ---------------------------------------------------------------------------
# Food
# ---------------------------------------------------------------------------
@router.get("/food", response_model=PaginatedResponse[FoodResponse])
async def list_food(
    start_date: date | None = None,
    end_date: date | None = None,
    meal_label: str | None = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(verify_api_key),
):
    q = select(FoodLog).order_by(FoodLog.log_date.desc(), FoodLog.meal_time.desc())
    count_q = select(func.count()).select_from(FoodLog)

    if start_date:
        q = q.where(FoodLog.log_date >= start_date)
        count_q = count_q.where(FoodLog.log_date >= start_date)
    if end_date:
        q = q.where(FoodLog.log_date <= end_date)
        count_q = count_q.where(FoodLog.log_date <= end_date)
    if meal_label:
        q = q.where(FoodLog.meal_label == meal_label)
        count_q = count_q.where(FoodLog.meal_label == meal_label)

    total = (await db.execute(count_q)).scalar_one()
    rows = (await db.execute(q.limit(limit).offset(offset))).scalars().all()
    return PaginatedResponse(data=rows, total=total, limit=limit, offset=offset)


@router.get("/food/weekly", response_model=list[FoodWeeklyResponse])
async def food_weekly(
    weeks: int = Query(12, le=52),
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(verify_api_key),
):
    """Aggregate food by ISO week for the last N weeks."""
    result = await db.execute(
        text("""
            SELECT
                DATE_TRUNC('week', log_date::timestamp)::date AS week_start,
                AVG(calories_kcal)  AS avg_calories,
                AVG(protein_g)      AS avg_protein_g,
                AVG(carbs_g)        AS avg_carbs_g,
                AVG(fat_g)          AS avg_fat_g,
                COUNT(*)            AS total_meals
            FROM food_logs
            WHERE log_date >= CURRENT_DATE - (:weeks * INTERVAL '1 week')
            GROUP BY 1
            ORDER BY 1 DESC
        """),
        {"weeks": weeks},
    )
    rows = result.mappings().all()
    return [
        FoodWeeklyResponse(
            week_start=r["week_start"],
            avg_calories=float(r["avg_calories"] or 0),
            avg_protein_g=float(r["avg_protein_g"] or 0),
            avg_carbs_g=float(r["avg_carbs_g"] or 0),
            avg_fat_g=float(r["avg_fat_g"] or 0),
            total_meals=int(r["total_meals"]),
        )
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Sauna
# ---------------------------------------------------------------------------
@router.get("/sauna", response_model=PaginatedResponse[SaunaResponse])
async def list_sauna(
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(verify_api_key),
):
    q = select(SaunaLog).order_by(SaunaLog.session_datetime.desc())
    count_q = select(func.count()).select_from(SaunaLog)

    if start_date:
        q = q.where(func.date(SaunaLog.session_datetime) >= start_date)
        count_q = count_q.where(func.date(SaunaLog.session_datetime) >= start_date)
    if end_date:
        q = q.where(func.date(SaunaLog.session_datetime) <= end_date)
        count_q = count_q.where(func.date(SaunaLog.session_datetime) <= end_date)

    total = (await db.execute(count_q)).scalar_one()
    rows = (await db.execute(q.limit(limit).offset(offset))).scalars().all()
    return PaginatedResponse(data=rows, total=total, limit=limit, offset=offset)


# ---------------------------------------------------------------------------
# Exercises
# ---------------------------------------------------------------------------
@router.get("/exercises", response_model=list[ExerciseResponse])
async def list_exercises(
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(verify_api_key),
):
    rows = (
        await db.execute(select(Exercise).order_by(Exercise.category, Exercise.name))
    ).scalars().all()
    return rows


# ---------------------------------------------------------------------------
# Strength history / PRs
# ---------------------------------------------------------------------------
@router.get("/strength/history/{exercise_id}", response_model=list[StrengthSetHistoryRow])
async def strength_history(
    exercise_id: int,
    start_date: date | None = None,
    end_date: date | None = None,
    limit: int = Query(200, le=500),
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(verify_api_key),
):
    q = (
        select(
            StrengthSet.id.label("set_id"),
            StrengthSet.session_id,
            StrengthSession.session_datetime,
            StrengthSession.session_label,
            StrengthSet.set_number,
            StrengthSet.reps,
            StrengthSet.weight_kg,
            StrengthSet.is_bodyweight,
            StrengthSet.rpe,
        )
        .join(StrengthSession, StrengthSet.session_id == StrengthSession.id)
        .where(StrengthSet.exercise_id == exercise_id)
        .order_by(StrengthSession.session_datetime.desc(), StrengthSet.set_number)
    )
    if start_date:
        q = q.where(func.date(StrengthSession.session_datetime) >= start_date)
    if end_date:
        q = q.where(func.date(StrengthSession.session_datetime) <= end_date)

    rows = (await db.execute(q.limit(limit))).mappings().all()
    return [StrengthSetHistoryRow(**dict(r)) for r in rows]


@router.get("/strength/prs", response_model=list[StrengthPRResponse])
async def strength_prs(
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(verify_api_key),
):
    """Return best (max weight) set per exercise, with the date it was achieved."""
    result = await db.execute(
        text("""
            SELECT DISTINCT ON (ss.exercise_id)
                ss.exercise_id,
                e.name AS exercise_name,
                ss.weight_kg AS max_weight_kg,
                DATE(sn.session_datetime) AS best_date
            FROM strength_sets ss
            JOIN exercises e ON e.id = ss.exercise_id
            JOIN strength_sessions sn ON sn.id = ss.session_id
            WHERE ss.weight_kg IS NOT NULL
            ORDER BY ss.exercise_id, ss.weight_kg DESC, sn.session_datetime DESC
        """)
    )
    rows = result.mappings().all()
    return [
        StrengthPRResponse(
            exercise_id=r["exercise_id"],
            exercise_name=r["exercise_name"],
            max_weight_kg=float(r["max_weight_kg"]) if r["max_weight_kg"] else None,
            best_date=r["best_date"],
        )
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------
@router.get("/settings", response_model=SettingsResponse)
async def get_settings(
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(verify_api_key),
):
    row = (await db.execute(select(UserSettings).limit(1))).scalar_one_or_none()
    if not row:
        row = UserSettings()
        db.add(row)
        await db.flush()
        await db.refresh(row)
    return row


@router.patch("/settings", response_model=SettingsResponse)
async def update_settings(
    body: SettingsUpdate,
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(verify_api_key),
):
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        return await get_settings(db=db, _key=_key)

    await db.execute(
        update(UserSettings).where(UserSettings.id == 1).values(**updates)
    )
    await db.flush()
    return await get_settings(db=db, _key=_key)
