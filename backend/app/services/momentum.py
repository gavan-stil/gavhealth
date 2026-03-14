"""Momentum service — compute signal baselines, trends, and goals."""

from __future__ import annotations

from datetime import date, timedelta, datetime, timezone
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# ---------------------------------------------------------------------------
# Signal metadata
# ---------------------------------------------------------------------------
SIGNAL_META: dict[str, dict[str, Any]] = {
    "sleep_hrs": {
        "label": "Sleep",
        "unit": "hrs",
        "group": "recovery",
        "direction": "higher",   # higher is better
    },
    "rhr_bpm": {
        "label": "Resting HR",
        "unit": "bpm",
        "group": "strain",
        "direction": "lower",    # lower is better
    },
    "weight_kg": {
        "label": "Weight",
        "unit": "kg",
        "group": "strain",
        "direction": "range",    # stay within range
    },
    "calories_in": {
        "label": "Calories",
        "unit": "kcal",
        "group": "recovery",
        "direction": "range",
    },
    "protein_g": {
        "label": "Protein",
        "unit": "g",
        "group": "recovery",
        "direction": "higher",
    },
    "water_ml": {
        "label": "Water",
        "unit": "ml",
        "group": "recovery",
        "direction": "higher",
    },
    "calories_out": {
        "label": "Cal burned",
        "unit": "kcal",
        "group": "strain",
        "direction": "range",
    },
}

SIGNALS = list(SIGNAL_META.keys())

# Default seed targets — used when no health_goals row exists for a signal
SIGNAL_DEFAULTS: dict[str, dict[str, float]] = {
    "sleep_hrs":   {"min": 7.0,    "max": 8.5},
    "rhr_bpm":     {"min": 52.0,   "max": 60.0},
    "weight_kg":   {"min": 71.0,   "max": 72.0},
    "calories_in": {"min": 2000.0, "max": 2400.0},
    "protein_g":   {"min": 160.0,  "max": 200.0},
    "water_ml":    {"min": 2500.0, "max": 3500.0},
    "calories_out": {"min": 1800.0, "max": 2800.0},
}


# ---------------------------------------------------------------------------
# Data fetchers
# ---------------------------------------------------------------------------

async def _fetch_sleep(db: AsyncSession, since: date, until: date) -> dict[str, float | None]:
    """Return {date_str: total_sleep_hrs} taking the MAX per day (exclude naps)."""
    rows = await db.execute(text("""
        SELECT sleep_date::text, MAX(total_sleep_hrs) AS hrs
        FROM sleep_logs
        WHERE sleep_date >= :since AND sleep_date <= :until
          AND total_sleep_hrs IS NOT NULL
        GROUP BY sleep_date
        ORDER BY sleep_date
    """), {"since": since, "until": until})
    return {r.sleep_date: r.hrs for r in rows}


async def _fetch_rhr(db: AsyncSession, since: date, until: date) -> dict[str, float | None]:
    rows = await db.execute(text("""
        SELECT log_date::text, AVG(rhr_bpm) AS rhr
        FROM rhr_logs
        WHERE log_date >= :since AND log_date <= :until
          AND rhr_bpm IS NOT NULL
        GROUP BY log_date
        ORDER BY log_date
    """), {"since": since, "until": until})
    return {r.log_date: float(r.rhr) for r in rows}


async def _fetch_weight(db: AsyncSession, since: date, until: date) -> dict[str, float | None]:
    rows = await db.execute(text("""
        SELECT recorded_at::date::text AS d, AVG(weight_kg) AS w
        FROM weight_logs
        WHERE recorded_at::date >= :since AND recorded_at::date <= :until
          AND weight_kg IS NOT NULL
        GROUP BY recorded_at::date
        ORDER BY recorded_at::date
    """), {"since": since, "until": until})
    return {r.d: float(r.w) for r in rows}


async def _fetch_nutrition(db: AsyncSession, since: date, until: date) -> dict[str, dict[str, float | None]]:
    """Return {date_str: {calories_in, protein_g}} aggregated by day."""
    rows = await db.execute(text("""
        SELECT log_date::text,
               SUM(calories_kcal) AS cal,
               SUM(protein_g) AS prot
        FROM food_logs
        WHERE log_date >= :since AND log_date <= :until
        GROUP BY log_date
        ORDER BY log_date
    """), {"since": since, "until": until})
    result: dict[str, dict[str, float | None]] = {}
    for r in rows:
        result[r.log_date] = {
            "calories_in": float(r.cal) if r.cal is not None else None,
            "protein_g": float(r.prot) if r.prot is not None else None,
        }
    return result


async def _fetch_water(db: AsyncSession, since: date, until: date) -> dict[str, float | None]:
    """Return {date_str: total_ml} bucketed to Brisbane local date (UTC+10)."""
    rows = await db.execute(text("""
        SELECT (logged_at AT TIME ZONE 'Australia/Brisbane')::date::text AS d,
               SUM(ml) AS total_ml
        FROM water_logs
        WHERE (logged_at AT TIME ZONE 'Australia/Brisbane')::date >= :since
          AND (logged_at AT TIME ZONE 'Australia/Brisbane')::date <= :until
        GROUP BY d
        ORDER BY d
    """), {"since": since, "until": until})
    return {r.d: float(r.total_ml) for r in rows}


async def _fetch_calories_out(db: AsyncSession, since: date, until: date) -> dict[str, float | None]:
    """Return {date_str: calories_burned_kcal} from daily_summary activity logs."""
    rows = await db.execute(text("""
        SELECT activity_date::text AS d,
               CASE
                   WHEN calories_burned > 8000
                        THEN ROUND(calories_burned / 4.184)::int
                   ELSE calories_burned
               END AS cal
        FROM activity_logs
        WHERE activity_type = 'daily_summary'
          AND activity_date >= :since AND activity_date <= :until
          AND calories_burned IS NOT NULL
    """), {"since": since, "until": until})
    return {r.d: float(r.cal) for r in rows}


async def _fetch_targets(db: AsyncSession) -> dict[str, dict[str, float | None]]:
    """Return latest target per signal from health_goals (newest row wins)."""
    rows = await db.execute(text("""
        SELECT DISTINCT ON (signal)
               signal, target_min, target_max
        FROM health_goals
        ORDER BY signal, set_at DESC
    """))
    targets: dict[str, dict[str, float | None]] = {}
    for sig in SIGNALS:
        defaults = SIGNAL_DEFAULTS[sig]
        targets[sig] = {"min": defaults["min"], "max": defaults["max"]}
    for r in rows:
        if r.signal in targets:
            targets[r.signal] = {
                "min": float(r.target_min) if r.target_min is not None else None,
                "max": float(r.target_max) if r.target_max is not None else None,
            }
    return targets


# ---------------------------------------------------------------------------
# Helper: assemble per-day signal value dicts
# ---------------------------------------------------------------------------

def _build_day_values(
    sleep: dict, rhr: dict, weight: dict,
    nutrition: dict, water: dict, calories_out: dict,
    date_range: list[date],
) -> list[dict]:
    days = []
    for d in date_range:
        ds = str(d)
        nut = nutrition.get(ds, {})
        days.append({
            "date": d,
            "sleep_hrs": sleep.get(ds),
            "rhr_bpm": rhr.get(ds),
            "weight_kg": weight.get(ds),
            "calories_in": nut.get("calories_in"),
            "protein_g": nut.get("protein_g"),
            "water_ml": water.get(ds),
            "calories_out": calories_out.get(ds),
        })
    return days


def _avg(values: list[float | None]) -> float | None:
    valid = [v for v in values if v is not None]
    return sum(valid) / len(valid) if valid else None


def _compute_trend(avg_7d: float | None, baseline: float | None, direction: str,
                   target_min: float | None, target_max: float | None) -> str:
    if avg_7d is None or baseline is None:
        return "stable"
    if direction == "higher":
        return "improving" if avg_7d > baseline else "declining"
    if direction == "lower":
        return "improving" if avg_7d < baseline else "declining"
    if direction == "range":
        if target_min is None or target_max is None:
            return "stable"
        mid = (target_min + target_max) / 2
        gap_now = abs(avg_7d - mid)
        gap_base = abs(baseline - mid)
        return "improving" if gap_now < gap_base else ("stable" if abs(gap_now - gap_base) < 0.5 else "declining")
    return "stable"


def _compute_status(today: float | None, avg_7d: float | None, baseline: float | None,
                    target_min: float | None, target_max: float | None,
                    direction: str) -> str:
    if today is None:
        return "off_track"
    # on_track: today inside target range (both bounds required)
    if target_min is not None and target_max is not None:
        if target_min <= today <= target_max:
            return "on_track"
    elif target_min is not None and today >= target_min:
        return "on_track"
    elif target_max is not None and today <= target_max:
        return "on_track"
    # improving: outside target but trending correct direction vs baseline
    trend = _compute_trend(avg_7d, baseline, direction, target_min, target_max)
    return "improving" if trend == "improving" else "off_track"


def _compute_gap_pct(baseline: float | None,
                     target_min: float | None, target_max: float | None) -> float | None:
    if baseline is None:
        return None
    if target_min is not None and target_max is not None:
        mid = (target_min + target_max) / 2
        if mid == 0:
            return None
        return round((baseline - mid) / mid * 100, 1)
    return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def compute_momentum(db: AsyncSession, target_date: date | None = None) -> dict:
    today = target_date or date.today()
    since_28 = today - timedelta(days=27)
    since_7 = today - timedelta(days=6)

    # Fetch all raw data for the 28-day window
    sleep = await _fetch_sleep(db, since_28, today)
    rhr   = await _fetch_rhr(db, since_28, today)
    weight = await _fetch_weight(db, since_28, today)
    nutrition = await _fetch_nutrition(db, since_28, today)
    water = await _fetch_water(db, since_28, today)
    cal_out = await _fetch_calories_out(db, since_28, today)
    targets = await _fetch_targets(db)

    all_dates = [since_28 + timedelta(days=i) for i in range(28)]
    days = _build_day_values(sleep, rhr, weight, nutrition, water, cal_out, all_dates)

    # Split into 28d and 7d windows
    last_7_dates = {str(d["date"]) for d in days[-7:]}

    def get_values(sig: str, date_set: set | None = None) -> list[float | None]:
        vals = []
        for d in days:
            if date_set and str(d["date"]) not in date_set:
                continue
            vals.append(d.get(sig))
        return vals

    signals_out = []
    for sig in SIGNALS:
        meta = SIGNAL_META[sig]
        tgt = targets[sig]
        t_min, t_max = tgt.get("min"), tgt.get("max")

        vals_28 = get_values(sig)
        vals_7 = get_values(sig, last_7_dates)

        baseline_28d = _avg(vals_28)
        avg_7d = _avg(vals_7)

        today_str = str(today)
        today_val: float | None = None
        for d in reversed(days):
            if str(d["date"]) == today_str:
                today_val = d.get(sig)
                break
        # If today has no data, use most recent available
        if today_val is None:
            for d in reversed(days):
                v = d.get(sig)
                if v is not None:
                    today_val = v
                    break

        trend_7d = _compute_trend(avg_7d, baseline_28d, meta["direction"], t_min, t_max)
        status = _compute_status(today_val, avg_7d, baseline_28d, t_min, t_max, meta["direction"])
        gap_pct = _compute_gap_pct(baseline_28d, t_min, t_max)

        signals_out.append({
            "signal": sig,
            "label": meta["label"],
            "unit": meta["unit"],
            "group": meta["group"],
            "target_min": t_min,
            "target_max": t_max,
            "baseline_28d": round(baseline_28d, 2) if baseline_28d is not None else None,
            "today": round(today_val, 2) if today_val is not None else None,
            "avg_7d": round(avg_7d, 2) if avg_7d is not None else None,
            "trend_7d": trend_7d,
            "gap_pct": gap_pct,
            "status": status,
        })

    on_track = sum(1 for s in signals_out if s["status"] in ("on_track", "improving"))
    total = len(signals_out)
    off_track_count = sum(1 for s in signals_out if s["status"] == "off_track")
    if on_track >= total // 2 + 1:
        overall = "improving"
    elif off_track_count >= total // 2 + 1:
        overall = "declining"
    else:
        overall = "stable"

    return {
        "overall_trend": overall,
        "signals_on_track": on_track,
        "signals_total": total,
        "signals": signals_out,
    }


async def get_signal_history(db: AsyncSession, days: int = 7) -> dict:
    today = date.today()
    since = today - timedelta(days=days - 1)

    sleep = await _fetch_sleep(db, since, today)
    rhr   = await _fetch_rhr(db, since, today)
    weight = await _fetch_weight(db, since, today)
    nutrition = await _fetch_nutrition(db, since, today)
    water = await _fetch_water(db, since, today)
    cal_out = await _fetch_calories_out(db, since, today)
    targets = await _fetch_targets(db)

    date_range = [since + timedelta(days=i) for i in range(days)]
    day_values = _build_day_values(sleep, rhr, weight, nutrition, water, cal_out, date_range)

    # 28d baselines
    since_28 = today - timedelta(days=27)
    sleep_28 = await _fetch_sleep(db, since_28, today)
    rhr_28 = await _fetch_rhr(db, since_28, today)
    weight_28 = await _fetch_weight(db, since_28, today)
    nutrition_28 = await _fetch_nutrition(db, since_28, today)
    water_28 = await _fetch_water(db, since_28, today)
    cal_out_28 = await _fetch_calories_out(db, since_28, today)
    all_28 = _build_day_values(sleep_28, rhr_28, weight_28, nutrition_28, water_28, cal_out_28,
                                [since_28 + timedelta(days=i) for i in range(28)])

    baselines: dict[str, float | None] = {}
    for sig in SIGNALS:
        vals = [d.get(sig) for d in all_28 if d.get(sig) is not None]
        baselines[sig] = round(sum(vals) / len(vals), 2) if vals else None

    return {
        "baselines": baselines,
        "targets": targets,
        "days": [
            {
                "date": str(d["date"]),
                "sleep_hrs": d.get("sleep_hrs"),
                "rhr_bpm": d.get("rhr_bpm"),
                "weight_kg": d.get("weight_kg"),
                "calories_in": d.get("calories_in"),
                "protein_g": d.get("protein_g"),
                "water_ml": d.get("water_ml"),
                "calories_out": d.get("calories_out"),
            }
            for d in day_values
        ],
    }
