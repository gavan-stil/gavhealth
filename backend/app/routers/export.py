"""CSV export endpoint — one row per day, all metrics flattened."""

import csv
import io
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import verify_api_key
from app.database import get_db
from app.models.health import (
    ActivityLog,
    DailyHabit,
    DexaScan,
    RhrLog,
    SaunaLog,
    SleepLog,
    WeightLog,
)

router = APIRouter(prefix="/api/export", tags=["export"])

# Column headers in output order
COLUMNS = [
    "date",
    # weight
    "weight_kg",
    "fat_mass_kg",
    "muscle_mass_kg",
    "bone_mass_kg",
    "hydration_kg",
    "bmi",
    # sleep
    "total_sleep_hrs",
    "deep_sleep_hrs",
    "light_sleep_hrs",
    "rem_sleep_hrs",
    "awake_hrs",
    "sleep_hr_avg",
    "sleep_hr_min",
    "hrv_ms",
    "spo2_avg",
    "sleep_score",
    "sleep_efficiency_pct",
    "respiratory_rate",
    # rhr
    "rhr_bpm",
    # activity aggregates
    "activity_count",
    "activity_types",
    "total_duration_mins",
    "total_distance_km",
    "total_calories_burned",
    "best_avg_hr",
    "best_max_hr",
    # sauna
    "sauna_count",
    "sauna_total_mins",
    # dexa (sparse — only on scan days)
    "dexa_body_fat_pct",
    "dexa_lean_mass_kg",
    "dexa_fat_mass_kg",
    "dexa_vat_area_cm2",
    "dexa_rmr_kcal",
    # habits
    "did_breathing",
    "did_devotions",
]


async def _date_range(db: AsyncSession, date_from: date | None, date_to: date | None) -> tuple[date, date]:
    """Resolve the date range — defaults to earliest data → today."""
    if date_from and date_to:
        return date_from, date_to

    # Find earliest date across all tables with a date column
    candidates = []
    for model, col in [
        (WeightLog, "recorded_at"),
        (SleepLog, "sleep_date"),
        (RhrLog, "log_date"),
        (ActivityLog, "activity_date"),
        (SaunaLog, "session_datetime"),
        (DexaScan, "scan_date"),
        (DailyHabit, "habit_date"),
    ]:
        attr = getattr(model, col)
        result = await db.execute(select(func.min(attr)))
        val = result.scalar()
        if val is not None:
            d = val.date() if hasattr(val, "date") else val
            candidates.append(d)

    earliest = min(candidates) if candidates else date.today()
    return date_from or earliest, date_to or date.today()


async def _build_lookup(db: AsyncSession, date_from: date, date_to: date) -> dict[date, dict]:
    """Query every table once and build a dict keyed by date."""
    rows: dict[date, dict] = {}

    def ensure(d: date) -> dict:
        if d not in rows:
            rows[d] = {}
        return rows[d]

    # --- Weight (recorded_at is datetime, cast to date) ---
    q = select(WeightLog).where(
        func.date(WeightLog.recorded_at) >= date_from,
        func.date(WeightLog.recorded_at) <= date_to,
    ).order_by(WeightLog.recorded_at)
    result = await db.execute(q)
    for w in result.scalars():
        d = w.recorded_at.date() if hasattr(w.recorded_at, "date") else w.recorded_at
        r = ensure(d)
        # If multiple readings on same day, keep the latest
        r["weight_kg"] = w.weight_kg
        r["fat_mass_kg"] = w.fat_mass_kg
        r["muscle_mass_kg"] = w.muscle_mass_kg
        r["bone_mass_kg"] = w.bone_mass_kg
        r["hydration_kg"] = w.hydration_kg
        r["bmi"] = w.bmi

    # --- Sleep ---
    q = select(SleepLog).where(
        SleepLog.sleep_date >= date_from,
        SleepLog.sleep_date <= date_to,
    )
    result = await db.execute(q)
    for s in result.scalars():
        r = ensure(s.sleep_date)
        r["total_sleep_hrs"] = s.total_sleep_hrs
        r["deep_sleep_hrs"] = s.deep_sleep_hrs
        r["light_sleep_hrs"] = s.light_sleep_hrs
        r["rem_sleep_hrs"] = s.rem_sleep_hrs
        r["awake_hrs"] = s.awake_hrs
        r["sleep_hr_avg"] = s.sleep_hr_avg
        r["sleep_hr_min"] = s.sleep_hr_min
        r["hrv_ms"] = s.hrv_ms
        r["spo2_avg"] = s.spo2_avg
        r["sleep_score"] = s.sleep_score
        r["sleep_efficiency_pct"] = s.sleep_efficiency_pct
        r["respiratory_rate"] = s.respiratory_rate

    # --- RHR ---
    q = select(RhrLog).where(RhrLog.log_date >= date_from, RhrLog.log_date <= date_to)
    result = await db.execute(q)
    for rhr in result.scalars():
        ensure(rhr.log_date)["rhr_bpm"] = rhr.rhr_bpm

    # --- Activities (aggregate per day) ---
    q = select(ActivityLog).where(
        ActivityLog.activity_date >= date_from,
        ActivityLog.activity_date <= date_to,
    )
    result = await db.execute(q)
    acts_by_day: dict[date, list] = {}
    for a in result.scalars():
        acts_by_day.setdefault(a.activity_date, []).append(a)

    for d, acts in acts_by_day.items():
        r = ensure(d)
        r["activity_count"] = len(acts)
        types = sorted({a.activity_type for a in acts if a.activity_type})
        r["activity_types"] = "|".join(types) if types else ""
        r["total_duration_mins"] = round(sum(a.duration_mins or 0 for a in acts), 1) or None
        r["total_distance_km"] = round(sum(a.distance_km or 0 for a in acts), 2) or None
        r["total_calories_burned"] = sum(a.calories_burned or 0 for a in acts) or None
        hrs = [a.avg_hr for a in acts if a.avg_hr]
        r["best_avg_hr"] = max(hrs) if hrs else None
        max_hrs = [a.max_hr for a in acts if a.max_hr]
        r["best_max_hr"] = max(max_hrs) if max_hrs else None

    # --- Sauna ---
    q = select(SaunaLog).where(
        func.date(SaunaLog.session_datetime) >= date_from,
        func.date(SaunaLog.session_datetime) <= date_to,
    )
    result = await db.execute(q)
    sauna_by_day: dict[date, list] = {}
    for s in result.scalars():
        d = s.session_datetime.date() if hasattr(s.session_datetime, "date") else s.session_datetime
        sauna_by_day.setdefault(d, []).append(s)

    for d, sessions in sauna_by_day.items():
        r = ensure(d)
        r["sauna_count"] = len(sessions)
        r["sauna_total_mins"] = sum(s.duration_mins or 0 for s in sessions)

    # --- DEXA ---
    q = select(DexaScan).where(DexaScan.scan_date >= date_from, DexaScan.scan_date <= date_to)
    result = await db.execute(q)
    for dx in result.scalars():
        r = ensure(dx.scan_date)
        r["dexa_body_fat_pct"] = dx.body_fat_pct
        r["dexa_lean_mass_kg"] = dx.lean_mass_kg
        r["dexa_fat_mass_kg"] = dx.fat_mass_kg
        r["dexa_vat_area_cm2"] = dx.vat_area_cm2
        r["dexa_rmr_kcal"] = dx.rmr_kcal

    # --- Habits ---
    q = select(DailyHabit).where(DailyHabit.habit_date >= date_from, DailyHabit.habit_date <= date_to)
    result = await db.execute(q)
    for h in result.scalars():
        r = ensure(h.habit_date)
        r["did_breathing"] = h.did_breathing
        r["did_devotions"] = h.did_devotions

    return rows


def _generate_csv(all_dates: list[date], lookup: dict[date, dict]):
    """Yield CSV rows as strings."""
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=COLUMNS)

    # Header
    writer.writeheader()
    yield buf.getvalue()
    buf.seek(0)
    buf.truncate(0)

    # One row per day (even empty days get a row — useful for charting gaps)
    for d in all_dates:
        row_data = lookup.get(d, {})
        row = {"date": d.isoformat()}
        for col in COLUMNS[1:]:
            val = row_data.get(col, "")
            if isinstance(val, bool):
                row[col] = "1" if val else "0"
            elif val is None:
                row[col] = ""
            else:
                row[col] = val
        writer.writerow(row)
        yield buf.getvalue()
        buf.seek(0)
        buf.truncate(0)


@router.get("/csv")
async def export_csv(
    db: AsyncSession = Depends(get_db),
    _auth: str = Depends(verify_api_key),
    date_from: date | None = Query(None, alias="from", description="Start date (YYYY-MM-DD)"),
    date_to: date | None = Query(None, alias="to", description="End date (YYYY-MM-DD)"),
):
    """Export all health data as a flat CSV — one row per day, all metrics as columns."""
    start, end = await _date_range(db, date_from, date_to)
    lookup = await _build_lookup(db, start, end)

    # Generate every date in range (so empty days appear as gaps)
    all_dates = []
    current = start
    while current <= end:
        all_dates.append(current)
        current += timedelta(days=1)

    filename = f"goe_health_export_{date.today().isoformat()}.csv"

    return StreamingResponse(
        _generate_csv(all_dates, lookup),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
