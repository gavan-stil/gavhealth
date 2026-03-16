"""Deterministic readiness score fallback.

Formula from IMPLEMENTATION_SPEC.md:
  base = 70
  sleep_delta  = (actual_sleep - 7.6) * 8
  deep_delta   = (actual_deep_pct - 0.43) * 20
  rhr_delta    = (rhr_7day_avg - rhr_today) * 3
  load_penalty = min(0, (1.3 - acwr) * 20)
  rest_penalty = max(0, (consecutive_days - 4)) * 5
  score = clamp(base + sleep_delta + deep_delta + rhr_delta + load_penalty - rest_penalty, 0, 100)
"""

from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.health import ActivityLog, DailySummary, RhrLog, SleepLog


def _clamp(val: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, val))


async def compute_readiness(db: AsyncSession, target_date: date) -> dict:
    """Compute deterministic readiness for a given date.

    Returns dict with score, components breakdown, and recommendation.
    """
    # --- Sleep data for target date ---
    sleep = (
        await db.execute(
            select(SleepLog)
            .where(SleepLog.sleep_date == target_date)
            .order_by(SleepLog.source.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    actual_sleep = sleep.total_sleep_hrs if sleep and sleep.total_sleep_hrs else 7.0
    deep_sleep = sleep.deep_sleep_hrs if sleep and sleep.deep_sleep_hrs else 0.0
    deep_pct = deep_sleep / actual_sleep if actual_sleep > 0 else 0.0

    # --- RHR today + 7-day avg ---
    rhr_today_row = (
        await db.execute(
            select(RhrLog.rhr_bpm)
            .where(RhrLog.log_date == target_date)
            .limit(1)
        )
    ).scalar_one_or_none()
    rhr_today = rhr_today_row if rhr_today_row else 52

    week_ago = target_date - timedelta(days=7)
    rhr_avg_result = (
        await db.execute(
            select(func.avg(RhrLog.rhr_bpm))
            .where(RhrLog.log_date.between(week_ago, target_date))
        )
    ).scalar_one_or_none()
    rhr_7day_avg = float(rhr_avg_result) if rhr_avg_result else float(rhr_today)

    # --- Training load: ACWR (acute:chronic workload ratio) ---
    # Acute = last 7 days, chronic = last 28 days
    four_weeks_ago = target_date - timedelta(days=28)

    acute_load = (
        await db.execute(
            select(func.coalesce(func.sum(ActivityLog.duration_mins), 0.0))
            .where(
                ActivityLog.activity_date.between(week_ago, target_date),
                ActivityLog.activity_type != "daily_summary",
            )
        )
    ).scalar_one()

    chronic_load = (
        await db.execute(
            select(func.coalesce(func.sum(ActivityLog.duration_mins), 0.0))
            .where(
                ActivityLog.activity_date.between(four_weeks_ago, target_date),
                ActivityLog.activity_type != "daily_summary",
            )
        )
    ).scalar_one()

    chronic_weekly = float(chronic_load) / 4.0 if chronic_load else 1.0
    acwr = float(acute_load) / chronic_weekly if chronic_weekly > 0 else 1.0

    # --- Consecutive training days ---
    # Exclude daily_summary rows — they exist for every synced day and would
    # make consecutive_days always 14, pinning rest_penalty to 50 permanently.
    consecutive_days = 0
    for offset in range(1, 15):
        check_date = target_date - timedelta(days=offset)
        count = (
            await db.execute(
                select(func.count())
                .select_from(ActivityLog)
                .where(
                    ActivityLog.activity_date == check_date,
                    ActivityLog.activity_type != "daily_summary",
                )
            )
        ).scalar_one()
        if count > 0:
            consecutive_days += 1
        else:
            break

    # --- Compute components ---
    base = 70.0
    sleep_delta = (actual_sleep - 7.6) * 8
    deep_delta = (deep_pct - 0.43) * 20
    rhr_delta = (rhr_7day_avg - rhr_today) * 3
    load_penalty = min(0.0, (1.3 - acwr) * 20)
    rest_penalty = max(0.0, (consecutive_days - 4)) * 5

    raw_score = base + sleep_delta + deep_delta + rhr_delta + load_penalty - rest_penalty
    score = round(_clamp(raw_score), 1)

    # Recommendation
    if score >= 80:
        recommendation = "High readiness — good day for intense training."
    elif score >= 60:
        recommendation = "Moderate readiness — steady-state or technique work."
    elif score >= 40:
        recommendation = "Low readiness — consider light activity or active recovery."
    else:
        recommendation = "Very low readiness — prioritise rest and recovery."

    return {
        "date": target_date,
        "readiness_score": score,
        "components": {
            "base": base,
            "sleep_delta": round(sleep_delta, 2),
            "deep_delta": round(deep_delta, 2),
            "rhr_delta": round(rhr_delta, 2),
            "load_penalty": round(load_penalty, 2),
            "rest_penalty": round(rest_penalty, 2),
            "inputs": {
                "actual_sleep_hrs": actual_sleep,
                "deep_sleep_hrs": deep_sleep,
                "deep_pct": round(deep_pct, 3),
                "rhr_today": rhr_today,
                "rhr_7day_avg": round(rhr_7day_avg, 1),
                "acwr": round(acwr, 2),
                "consecutive_training_days": consecutive_days,
            },
        },
        "recommendation": recommendation,
    }
