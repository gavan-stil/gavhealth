"""Write endpoints: food, strength, sauna, habits, weight, sleep, activity, RHR."""

from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

BRISBANE_TZ = ZoneInfo("Australia/Brisbane")
from sqlalchemy import text as sa_text

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import verify_api_key
from app.database import get_db
from app.models.health import (
    ActivityLog,
    DailyHabit,
    Exercise,
    ExerciseMuscle,
    FoodLog,
    MuscleGroup,
    RhrLog,
    SaunaLog,
    SleepLog,
    StrengthSession,
    StrengthSet,
    WeightLog,
)
from sqlalchemy import func as sa_func
from app.schemas.health import (
    ActivityCreate,
    ActivityResponse,
    FoodConfirmRequest,
    FoodParseRequest,
    FoodParseResponse,
    FoodResponse,
    HabitCreate,
    HabitResponse,
    RhrCreate,
    RhrResponse,
    SaunaCreate,
    SaunaResponse,
    SleepCreate,
    SleepResponse,
    StrengthConfirmRequest,
    StrengthParseRequest,
    StrengthParseResponse,
    StrengthSessionResponse,
    WeightCreate,
    WeightResponse,
)
from app.services.claude_service import parse_food, parse_strength

router = APIRouter(prefix="/api/log", tags=["logging"])


# ---------------------------------------------------------------------------
# Food — two-step: parse then confirm
# ---------------------------------------------------------------------------
@router.post("/food", response_model=FoodParseResponse)
async def parse_food_entry(
    body: FoodParseRequest,
    _key: str = Depends(verify_api_key),
):
    """Step 1: Send food description to Claude for macro estimation."""
    log_date = body.log_date or datetime.now(BRISBANE_TZ).date()
    try:
        result = await parse_food(body.description, body.meal_label, log_date)
        return FoodParseResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Food parse failed: {e}")


@router.post("/food/confirm", response_model=FoodResponse, status_code=201)
async def confirm_food_entry(
    body: FoodConfirmRequest,
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(verify_api_key),
):
    """Step 2: User confirms/edits parsed macros and saves to DB."""
    food = FoodLog(
        log_date=body.log_date,
        meal_label=body.meal_label,
        description_raw=body.description_raw,
        protein_g=body.protein_g,
        carbs_g=body.carbs_g,
        fat_g=body.fat_g,
        calories_kcal=body.calories_kcal,
        confidence=body.confidence,
        source="claude",
        notes=body.notes,
    )
    db.add(food)
    await db.flush()
    await db.refresh(food)
    return food


# ---------------------------------------------------------------------------
# Strength — two-step: parse then confirm
# ---------------------------------------------------------------------------
@router.post("/strength", response_model=StrengthParseResponse)
async def parse_strength_entry(
    body: StrengthParseRequest,
    _key: str = Depends(verify_api_key),
):
    """Step 1: Send workout description to Claude for structured parsing."""
    try:
        result = await parse_strength(
            body.description, body.session_label, body.session_datetime
        )
        return StrengthParseResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Strength parse failed: {e}")


@router.post("/strength/confirm", response_model=StrengthSessionResponse, status_code=201)
async def confirm_strength_entry(
    body: StrengthConfirmRequest,
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(verify_api_key),
):
    """Step 2: User confirms parsed sets and saves session to DB."""
    session = StrengthSession(
        session_datetime=body.session_datetime,
        session_label=body.session_label,
        notes=body.notes,
        source="claude",
    )
    db.add(session)
    await db.flush()

    # A1: Look up bodyweight for session date (exact match, else 7-day rolling avg)
    # Use Brisbane local date — body.session_datetime may be UTC-aware, so convert first.
    _dt = body.session_datetime
    session_date = _dt.astimezone(BRISBANE_TZ).date() if _dt.tzinfo else _dt.date()
    bw_result = await db.execute(
        sa_text("""
            SELECT weight_kg FROM weight_logs
            WHERE (recorded_at AT TIME ZONE 'Australia/Brisbane')::date = :session_date
            ORDER BY recorded_at DESC
            LIMIT 1
        """),
        {"session_date": session_date},
    )
    bw_row = bw_result.mappings().first()
    if bw_row:
        bodyweight_kg = float(bw_row["weight_kg"])
    else:
        rolling_result = await db.execute(
            sa_text("""
                SELECT AVG(weight_kg) AS avg_weight FROM (
                    SELECT weight_kg FROM weight_logs
                    WHERE (recorded_at AT TIME ZONE 'Australia/Brisbane')::date < :session_date
                    ORDER BY recorded_at DESC
                    LIMIT 7
                ) sub
            """),
            {"session_date": session_date},
        )
        rolling_row = rolling_result.mappings().first()
        bodyweight_kg = float(rolling_row["avg_weight"]) if rolling_row and rolling_row["avg_weight"] else None

    # A2: Match an activity_log workout row on the same date, only if not already
    # claimed by another strength session (prevents two sessions sharing one workout).
    activity_match = await db.execute(
        sa_text("""
            SELECT id FROM activity_logs
            WHERE activity_type = 'workout'
              AND activity_date = :session_date
              AND id NOT IN (
                  SELECT activity_log_id FROM strength_sessions
                  WHERE activity_log_id IS NOT NULL
              )
            LIMIT 1
        """),
        {"session_date": session_date},
    )
    match_row = activity_match.mappings().first()
    if match_row:
        session.activity_log_id = match_row["id"]
        await db.flush()

    sets_created = []
    for s in body.sets:
        # Find or create the exercise
        exercise = (
            await db.execute(select(Exercise).where(Exercise.name == s.exercise_name))
        ).scalar_one_or_none()
        if not exercise:
            exercise = Exercise(name=s.exercise_name, category="other")
            db.add(exercise)
            await db.flush()
            # Create default exercise_muscles link
            mg = (await db.execute(
                select(MuscleGroup).where(sa_func.lower(MuscleGroup.name) == "other")
            )).scalar_one_or_none()
            if mg:
                db.add(ExerciseMuscle(exercise_id=exercise.id, muscle_group_id=mg.id, is_primary=True))

        strength_set = StrengthSet(
            session_id=session.id,
            exercise_id=exercise.id,
            set_number=s.set_number,
            reps=s.reps,
            weight_kg=s.weight_kg,
            is_bodyweight=s.is_bodyweight,
            bodyweight_at_session=bodyweight_kg,
            rpe=s.rpe,
        )
        db.add(strength_set)
        sets_created.append({
            "exercise_name": s.exercise_name,
            "set_number": s.set_number,
            "reps": s.reps,
            "weight_kg": s.weight_kg,
            "is_bodyweight": s.is_bodyweight,
            "rpe": s.rpe,
        })

    await db.flush()
    await db.refresh(session)

    return StrengthSessionResponse(
        id=session.id,
        session_datetime=session.session_datetime,
        session_label=session.session_label,
        notes=session.notes,
        source=session.source,
        sets=sets_created,
    )


# ---------------------------------------------------------------------------
# Sauna
# ---------------------------------------------------------------------------
@router.post("/sauna", response_model=SaunaResponse, status_code=201)
async def log_sauna(
    body: SaunaCreate,
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(verify_api_key),
):
    sauna = SaunaLog(**body.model_dump())
    db.add(sauna)
    await db.flush()
    await db.refresh(sauna)
    return sauna


# ---------------------------------------------------------------------------
# Habits
# ---------------------------------------------------------------------------
@router.post("/habits", response_model=HabitResponse, status_code=201)
async def log_habits(
    body: HabitCreate,
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(verify_api_key),
):
    # Upsert — if habit for date exists, update it
    existing = (
        await db.execute(
            select(DailyHabit).where(DailyHabit.habit_date == body.habit_date)
        )
    ).scalar_one_or_none()

    if existing:
        existing.did_breathing = body.did_breathing
        existing.did_devotions = body.did_devotions
        existing.notes = body.notes
        await db.flush()
        await db.refresh(existing)
        return existing

    habit = DailyHabit(**body.model_dump())
    db.add(habit)
    await db.flush()
    await db.refresh(habit)
    return habit


# ---------------------------------------------------------------------------
# Weight (manual entry)
# ---------------------------------------------------------------------------
@router.post("/weight", response_model=WeightResponse, status_code=201)
async def log_weight(
    body: WeightCreate,
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(verify_api_key),
):
    w = WeightLog(**body.model_dump())
    db.add(w)
    await db.flush()
    await db.refresh(w)
    return w


# ---------------------------------------------------------------------------
# Sleep (manual entry)
# ---------------------------------------------------------------------------
@router.post("/sleep", response_model=SleepResponse, status_code=201)
async def log_sleep(
    body: SleepCreate,
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(verify_api_key),
):
    s = SleepLog(**body.model_dump())
    db.add(s)
    await db.flush()
    await db.refresh(s)
    return s


# ---------------------------------------------------------------------------
# Activity (manual entry)
# ---------------------------------------------------------------------------
@router.post("/activity", response_model=ActivityResponse, status_code=201)
async def log_activity(
    body: ActivityCreate,
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(verify_api_key),
):
    a = ActivityLog(**body.model_dump())
    db.add(a)
    await db.flush()
    await db.refresh(a)
    return a


# ---------------------------------------------------------------------------
# RHR (manual entry)
# ---------------------------------------------------------------------------
@router.post("/rhr", response_model=RhrResponse, status_code=201)
async def log_rhr(
    body: RhrCreate,
    db: AsyncSession = Depends(get_db),
    _key: str = Depends(verify_api_key),
):
    r = RhrLog(**body.model_dump())
    db.add(r)
    await db.flush()
    await db.refresh(r)
    return r
