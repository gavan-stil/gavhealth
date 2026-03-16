"""Read-only data endpoints: weight, sleep, activity, RHR, DEXA, streaks, settings,
food, sauna, exercises, strength history, strength PRs."""

from datetime import date, datetime, timedelta, timezone

BRISBANE_TZ = timezone(timedelta(hours=10))


def brisbane_today() -> date:
    return datetime.now(BRISBANE_TZ).date()

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
    HrIntraday,
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
    HrIntradayResponse,
    RhrResponse,
    SaunaResponse,
    SettingsResponse,
    SettingsUpdate,
    SleepResponse,
    SleepStagesResponse,
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
    # DISTINCT ON (sleep_date) — prefer "withings" source over "withings_csv" for the same date
    q = (
        select(SleepLog)
        .distinct(SleepLog.sleep_date)
        .order_by(SleepLog.sleep_date.desc(), SleepLog.source.desc())
    )
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


@router.get("/sleep/stages", response_model=SleepStagesResponse | None)
async def get_sleep_stages(
    date: date | None = None,
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(verify_api_key),
):
    """Return sleep stage segments for a given date (defaults to today).

    If stages are NULL in DB, attempts a live Withings fetch.
    Returns null if no sleep record exists for that date.
    """
    from app.services.withings_service import get_valid_token, sync_sleep_stages

    target_date = date or brisbane_today()

    row = (await db.execute(
        select(SleepLog).where(SleepLog.sleep_date == target_date, SleepLog.source == "withings")
    )).scalar_one_or_none()

    # If no withings row, also check any source
    if row is None:
        row = (await db.execute(
            select(SleepLog).where(SleepLog.sleep_date == target_date).order_by(SleepLog.id.desc())
        )).scalar_one_or_none()

    if row is None:
        return None

    # Live fetch if stages are missing
    if row.stages is None:
        try:
            access_token = await get_valid_token(db)
            await sync_sleep_stages(db, access_token, target_date.isoformat())
            await db.flush()
            # Re-read after write
            row = (await db.execute(
                select(SleepLog).where(SleepLog.id == row.id)
            )).scalar_one_or_none()
        except Exception:
            pass  # Return what we have without stages

    return row


# ---------------------------------------------------------------------------
# Intraday HR
# ---------------------------------------------------------------------------
@router.get("/hr/intraday", response_model=HrIntradayResponse)
async def get_hr_intraday(
    date: date | None = None,
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(verify_api_key),
):
    """Return hourly HR buckets for a given date (defaults to today Brisbane local).

    Triggers a live Withings fetch if no data exists, or if the date is today and
    data is present but stale (fewer than 12 hours of readings expected by now).
    """
    import datetime as _dt
    from app.services.withings_service import get_valid_token, sync_intraday_hr

    BRISBANE_OFFSET = _dt.timedelta(hours=10)
    today_local = (_dt.datetime.now(_dt.timezone.utc) + BRISBANE_OFFSET).date()
    target_date = date or today_local

    rows = (await db.execute(
        select(HrIntraday)
        .where(HrIntraday.log_date == target_date)
        .order_by(HrIntraday.hour)
    )).scalars().all()

    # Fetch from Withings if: no data at all, or it's today and we have < 6 buckets
    should_fetch = len(rows) == 0 or (target_date == today_local and len(rows) < 6)

    if should_fetch:
        try:
            access_token = await get_valid_token(db)
            await sync_intraday_hr(db, access_token, target_date.isoformat())
            await db.flush()
            rows = (await db.execute(
                select(HrIntraday)
                .where(HrIntraday.log_date == target_date)
                .order_by(HrIntraday.hour)
            )).scalars().all()
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning("hr/intraday live fetch failed: %s", exc)

    return HrIntradayResponse(log_date=target_date, buckets=list(rows))


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
    today = brisbane_today()

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
            .where(func.date(func.timezone('Australia/Brisbane', SaunaLog.session_datetime)) == d)
        )).scalar_one()
        return count > 0

    async def _has_training(d: date) -> bool:
        # Exclude daily_summary — Withings syncs one per day and would make
        # the streak always show 365 regardless of actual training.
        count = (await db.execute(
            select(func.count()).select_from(ActivityLog)
            .where(
                ActivityLog.activity_date == d,
                ActivityLog.activity_type != "daily_summary",
            )
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
    """Aggregate food by ISO week for the last N weeks.

    Computes the average DAILY total per week (not average per meal entry).
    e.g. 3 meals/day × 7 days → avg of 7 daily sums, not avg of 21 rows.
    """
    result = await db.execute(
        text("""
            SELECT
                week_start,
                AVG(daily_calories)   AS avg_calories,
                AVG(daily_protein_g)  AS avg_protein_g,
                AVG(daily_carbs_g)    AS avg_carbs_g,
                AVG(daily_fat_g)      AS avg_fat_g,
                SUM(meal_count)       AS total_meals
            FROM (
                SELECT
                    DATE_TRUNC('week', log_date::timestamp)::date AS week_start,
                    SUM(COALESCE(calories_kcal, 0))               AS daily_calories,
                    SUM(COALESCE(protein_g, 0))                   AS daily_protein_g,
                    SUM(COALESCE(carbs_g, 0))                     AS daily_carbs_g,
                    SUM(COALESCE(fat_g, 0))                       AS daily_fat_g,
                    COUNT(*)                                       AS meal_count
                FROM food_logs
                WHERE log_date >= CURRENT_DATE - (:weeks * INTERVAL '1 week')
                GROUP BY log_date, DATE_TRUNC('week', log_date::timestamp)::date
            ) AS daily_agg
            GROUP BY week_start
            ORDER BY week_start DESC
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
        q = q.where(func.date(func.timezone('Australia/Brisbane', SaunaLog.session_datetime)) >= start_date)
        count_q = count_q.where(func.date(func.timezone('Australia/Brisbane', SaunaLog.session_datetime)) >= start_date)
    if end_date:
        q = q.where(func.date(func.timezone('Australia/Brisbane', SaunaLog.session_datetime)) <= end_date)
        count_q = count_q.where(func.date(func.timezone('Australia/Brisbane', SaunaLog.session_datetime)) <= end_date)

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
        q = q.where(func.date(func.timezone('Australia/Brisbane', StrengthSession.session_datetime)) >= start_date)
    if end_date:
        q = q.where(func.date(func.timezone('Australia/Brisbane', StrengthSession.session_datetime)) <= end_date)

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
