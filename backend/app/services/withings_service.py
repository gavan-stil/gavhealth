"""Withings API integration — OAuth2, token refresh, data sync."""

import logging
import uuid
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.health import (
    ActivityLog,
    HrIntraday,
    RhrLog,
    SaunaLog,
    SleepLog,
    SyncEvent,
    SyncLog,
    SyncState,
    WeightLog,
)

logger = logging.getLogger(__name__)

WITHINGS_AUTH_URL = "https://account.withings.com/oauth2_user/authorize2"
WITHINGS_TOKEN_URL = "https://wbsapi.withings.net/v2/oauth2"
WITHINGS_MEASURE_URL = "https://wbsapi.withings.net/measure"
WITHINGS_SLEEP_URL = "https://wbsapi.withings.net/v2/sleep"
WITHINGS_ACTIVITY_URL = "https://wbsapi.withings.net/v2/measure"
WITHINGS_WORKOUT_URL = "https://wbsapi.withings.net/v2/measure"

SOURCE = "withings"

# Withings workout category → app activity_type mapping
# See: https://developer.withings.com/api-reference#tag/measure/operation/measure-getworkouts
WORKOUT_CATEGORY_MAP = {
    1: "walk",
    2: "run",
    3: "walk",       # hiking → walk
    4: "ride",       # skating → ride
    5: "ride",       # BMX → ride
    6: "ride",       # bicycling
    7: "swim",
    8: "surf",
    9: "other",      # cross-country skiing
    10: "other",     # skiing
    11: "other",     # snowboarding
    12: "row",       # rowing / kayaking
    13: "other",     # mountaineering / rock climbing
    16: "workout",   # weights / lift
    17: "other",     # tennis
    18: "other",     # table tennis
    19: "other",     # squash
    20: "other",     # badminton
    21: "other",     # dance
    22: "other",     # baseball
    23: "other",     # basketball
    24: "other",     # soccer
    25: "other",     # football
    26: "other",     # rugby
    27: "other",     # volleyball
    28: "yoga",
    29: "other",     # martial arts
    30: "other",     # boxing
    31: "other",     # cricket
    32: "other",     # elliptical
    33: "other",     # pilates
    34: "other",     # multi-sport
    35: "other",     # zumba
    36: "other",     # miscellaneous — SAUNA lives here
    99: "run",       # treadmill
    187: "other",    # outdoor run (sometimes separate)
    188: "other",    # indoor cycling
}
SCOPES = "user.info,user.metrics,user.activity"


def get_auth_url(callback_url: str) -> str:
    """Build Withings OAuth2 authorization URL."""
    params = {
        "response_type": "code",
        "client_id": settings.withings_client_id,
        "redirect_uri": callback_url,
        "scope": SCOPES,
        "state": "gavhealth",
    }
    qs = "&".join(f"{k}={v}" for k, v in params.items())
    return f"{WITHINGS_AUTH_URL}?{qs}"


async def exchange_code(code: str, callback_url: str) -> dict:
    """Exchange authorization code for access + refresh tokens."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            WITHINGS_TOKEN_URL,
            data={
                "action": "requesttoken",
                "grant_type": "authorization_code",
                "client_id": settings.withings_client_id,
                "client_secret": settings.withings_client_secret,
                "code": code,
                "redirect_uri": callback_url,
            },
        )
        resp.raise_for_status()
        data = resp.json()

    if data.get("status") != 0:
        raise ValueError(f"Withings token error: {data}")

    body = data["body"]
    return {
        "access_token": body["access_token"],
        "refresh_token": body["refresh_token"],
        "expires_in": body["expires_in"],
        "userid": body.get("userid"),
    }


async def refresh_access_token(current_refresh_token: str) -> dict:
    """Refresh an expired access token."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            WITHINGS_TOKEN_URL,
            data={
                "action": "requesttoken",
                "grant_type": "refresh_token",
                "client_id": settings.withings_client_id,
                "client_secret": settings.withings_client_secret,
                "refresh_token": current_refresh_token,
            },
        )
        resp.raise_for_status()
        data = resp.json()

    if data.get("status") != 0:
        raise ValueError(f"Withings refresh error: {data}")

    body = data["body"]
    return {
        "access_token": body["access_token"],
        "refresh_token": body["refresh_token"],
        "expires_in": body["expires_in"],
    }


async def store_tokens(db: AsyncSession, tokens: dict) -> None:
    """Upsert tokens into sync_state table."""
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=tokens["expires_in"])

    stmt = pg_insert(SyncState).values(
        source=SOURCE,
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        token_status="valid",
        token_expires_at=expires_at,
        last_sync_at=None,
        updated_at=now,
    ).on_conflict_do_update(
        index_elements=["source"],
        set_={
            "access_token": tokens["access_token"],
            "refresh_token": tokens["refresh_token"],
            "token_status": "valid",
            "token_expires_at": expires_at,
            "updated_at": now,
        },
    )
    await db.execute(stmt)
    await db.flush()


async def get_valid_token(db: AsyncSession) -> str:
    """Get a valid access token, refreshing if expired."""
    result = await db.execute(
        select(SyncState).where(SyncState.source == SOURCE)
    )
    state = result.scalar_one_or_none()

    if not state or not state.refresh_token:
        raise ValueError("Withings not connected — run OAuth flow first")

    now = datetime.now(timezone.utc)
    # Refresh if expired or expiring within 5 minutes
    if not state.token_expires_at or state.token_expires_at < now + timedelta(minutes=5):
        logger.info("Withings token expired or expiring soon — refreshing")
        new_tokens = await refresh_access_token(state.refresh_token)
        await store_tokens(db, new_tokens)
        return new_tokens["access_token"]

    return state.access_token


# ---------------------------------------------------------------------------
# Data sync functions
# ---------------------------------------------------------------------------

async def _withings_get(access_token: str, url: str, params: dict) -> dict:
    """Make an authenticated GET-style request to Withings API (all POST)."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            url,
            headers={"Authorization": f"Bearer {access_token}"},
            data=params,
        )
        resp.raise_for_status()
        data = resp.json()

    if data.get("status") != 0:
        raise ValueError(f"Withings API error ({url}): status={data.get('status')}, error={data.get('error')}")

    return data.get("body", {})


async def sync_weight(db: AsyncSession, access_token: str, since_ts: int) -> int:
    """Pull weight measurements from Withings and upsert into weight_logs."""
    body = await _withings_get(access_token, WITHINGS_MEASURE_URL, {
        "action": "getmeas",
        "meastype": 1,  # Weight
        "category": 1,  # Real measurements only
        "startdate": since_ts,
        "enddate": int(datetime.now(timezone.utc).timestamp()),
    })

    count = 0
    for grp in body.get("measuregrps", []):
        recorded_at = datetime.fromtimestamp(grp["date"], tz=timezone.utc)
        for measure in grp["measures"]:
            if measure["type"] == 1:  # Weight in kg
                weight_kg = measure["value"] * (10 ** measure["unit"])
                stmt = pg_insert(WeightLog).values(
                    recorded_at=recorded_at,
                    weight_kg=round(weight_kg, 2),
                    source=SOURCE,
                ).on_conflict_do_nothing(
                    index_elements=["recorded_at", "source"],
                )
                await db.execute(stmt)
                count += 1

    return count


async def sync_sleep(db: AsyncSession, access_token: str, since_ts: int) -> int:
    """Pull sleep summaries from Withings and upsert into sleep_logs."""
    start_date = datetime.fromtimestamp(since_ts, tz=timezone.utc).strftime("%Y-%m-%d")
    end_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    body = await _withings_get(access_token, WITHINGS_SLEEP_URL, {
        "action": "getsummary",
        "startdateymd": start_date,
        "enddateymd": end_date,
        "data_fields": "nb_rem_episodes,sleep_efficiency,sleep_latency,total_sleep_time,total_timeinbed,wakeup_latency,waso,deepsleepduration,lightsleepduration,remsleepduration,hr_average,hr_min,hr_max,rr_average,rr_min,rr_max,sleep_score,snoring,snoringepisodecount,night_events,out_of_bed_count,apnea_hypopnea_index,breathing_disturbances_intensity",
    })

    count = 0
    for series in body.get("series", []):
        sleep_date_str = series.get("date")
        if not sleep_date_str:
            continue

        from datetime import date as date_type
        sleep_date = date_type.fromisoformat(sleep_date_str)
        data = series.get("data", {})

        total_sleep_sec = data.get("total_sleep_time", 0)
        deep_sec = data.get("deepsleepduration", 0)
        light_sec = data.get("lightsleepduration", 0)
        rem_sec = data.get("remsleepduration", 0)

        total_hrs = round(total_sleep_sec / 3600, 2) if total_sleep_sec else None
        deep_hrs = round(deep_sec / 3600, 2) if deep_sec else None
        light_hrs = round(light_sec / 3600, 2) if light_sec else None
        rem_hrs = round(rem_sec / 3600, 2) if rem_sec else None

        values = {
            "sleep_date": sleep_date,
            "total_sleep_hrs": total_hrs,
            "deep_sleep_hrs": deep_hrs,
            "light_sleep_hrs": light_hrs,
            "rem_sleep_hrs": rem_hrs,
            "rem_source": "withings_api" if rem_sec else None,
            "sleep_hr_avg": data.get("hr_average"),
            "sleep_hr_min": data.get("hr_min"),
            "respiratory_rate": data.get("rr_average"),
            "sleep_score": data.get("sleep_score"),
            "sleep_efficiency_pct": round(data["sleep_efficiency"] * 100, 1) if data.get("sleep_efficiency") else None,
            "source": SOURCE,
        }

        stmt = pg_insert(SleepLog).values(**values).on_conflict_do_update(
            index_elements=["sleep_date", "source"],
            set_={k: v for k, v in values.items() if k not in ("sleep_date", "source")},
        )
        await db.execute(stmt)
        count += 1

    return count


async def sync_sleep_stages(db: AsyncSession, access_token: str, sleep_date_str: str) -> bool:
    """Fetch sleep stage segments from Withings v2/sleep action=get for a given date.

    Uses a window: (sleep_date - 1) at 20:00 local → sleep_date at 14:00 local,
    expressed as UTC unix timestamps.  Brisbane is UTC+10, no DST.

    Stages array: [{startdate, enddate, state}]
    state: 0=awake, 1=light, 2=deep, 3=REM

    Returns True if stages were stored, False if no data or error.
    """
    from datetime import date as date_type

    try:
        sleep_date = date_type.fromisoformat(sleep_date_str)
    except ValueError:
        logger.warning("sync_sleep_stages: invalid date %s", sleep_date_str)
        return False

    # Brisbane UTC+10: "night before" window 20:00 local = 10:00 UTC, wake window 14:00 local = 04:00 UTC
    prev_day = sleep_date - timedelta(days=1)
    startdate = int(datetime(prev_day.year, prev_day.month, prev_day.day, 10, 0, 0, tzinfo=timezone.utc).timestamp())
    enddate = int(datetime(sleep_date.year, sleep_date.month, sleep_date.day, 4, 0, 0, tzinfo=timezone.utc).timestamp())

    try:
        body = await _withings_get(access_token, WITHINGS_SLEEP_URL, {
            "action": "get",
            "startdate": startdate,
            "enddate": enddate,
            "data_fields": "hr",
        })
    except Exception as e:
        logger.warning("sync_sleep_stages: Withings error for %s: %s", sleep_date_str, e)
        return False

    series = body.get("series", [])
    if not series:
        logger.info("sync_sleep_stages: no stage data from Withings for %s", sleep_date_str)
        return False

    stages = [
        {
            "startdate": seg["startdate"],
            "enddate": seg["enddate"],
            "state": seg["state"],
        }
        for seg in series
        if "startdate" in seg and "enddate" in seg and "state" in seg
    ]

    if not stages:
        return False

    # Update sleep_logs.stages for the matching row (withings source preferred)
    result = await db.execute(
        select(SleepLog).where(
            SleepLog.sleep_date == sleep_date,
            SleepLog.source == SOURCE,
        )
    )
    row = result.scalar_one_or_none()

    if row:
        from sqlalchemy import update as sa_update
        await db.execute(
            sa_update(SleepLog)
            .where(SleepLog.id == row.id)
            .values(stages=stages)
        )
        logger.info("sync_sleep_stages: stored %d segments for %s", len(stages), sleep_date_str)
        return True
    else:
        logger.info("sync_sleep_stages: no sleep_log row for %s — skipping", sleep_date_str)
        return False


async def sync_intraday_hr(db: AsyncSession, access_token: str, date_str: str) -> int:
    """Fetch minute-level HR data from Withings getintradayactivity and bucket by hour (Brisbane local).

    Brisbane is UTC+10, no DST.  Converts each Unix timestamp to local hour before bucketing.
    Upserts one row per hour per day into hr_intraday.

    Returns number of hour-buckets stored/updated.
    """
    from datetime import date as date_type
    from collections import defaultdict

    try:
        log_date = date_type.fromisoformat(date_str)
    except ValueError:
        logger.warning("sync_intraday_hr: invalid date %s", date_str)
        return 0

    # Brisbane UTC+10: cover the calendar day 00:00–23:59 local = 14:00 UTC(prev) – 13:59 UTC(same)
    BRISBANE_OFFSET = 10 * 3600
    startdate = int(datetime(log_date.year, log_date.month, log_date.day, 0, 0, 0, tzinfo=timezone.utc).timestamp()) - BRISBANE_OFFSET
    enddate   = startdate + 86400  # +24h

    try:
        body = await _withings_get(access_token, WITHINGS_ACTIVITY_URL, {
            "action": "getintradayactivity",
            "startdate": startdate,
            "enddate": enddate,
            "data_fields": "heart_rate",
        })
    except Exception as e:
        logger.warning("sync_intraday_hr: Withings error for %s: %s", date_str, e)
        return 0

    series = body.get("series", {})
    if not series:
        logger.info("sync_intraday_hr: no intraday data for %s", date_str)
        return 0

    # Bucket readings by local hour
    buckets: dict[int, list[int]] = defaultdict(list)
    for ts_str, reading in series.items():
        try:
            ts = int(ts_str)
        except (ValueError, TypeError):
            continue
        hr = reading.get("heart_rate")
        if hr is None or hr <= 0:
            continue
        # Convert to Brisbane local hour
        local_hour = ((ts + BRISBANE_OFFSET) % 86400) // 3600
        buckets[local_hour].append(int(hr))

    if not buckets:
        return 0

    count = 0
    for hour, readings in buckets.items():
        hr_avg = round(sum(readings) / len(readings), 1)
        hr_min = min(readings)
        hr_max = max(readings)

        stmt = pg_insert(HrIntraday).values(
            log_date=log_date,
            hour=hour,
            hr_avg=hr_avg,
            hr_min=hr_min,
            hr_max=hr_max,
            readings_count=len(readings),
            source=SOURCE,
        ).on_conflict_do_update(
            index_elements=["log_date", "hour", "source"],
            set_={
                "hr_avg": hr_avg,
                "hr_min": hr_min,
                "hr_max": hr_max,
                "readings_count": len(readings),
            },
        )
        await db.execute(stmt)
        count += 1

    logger.info("sync_intraday_hr: stored %d hour-buckets for %s", count, date_str)
    return count


RHR_SAUNA_THRESHOLD = 115  # BPM — readings at or above this are sauna artefacts (D44)


async def sync_rhr(db: AsyncSession, access_token: str, since_ts: int) -> int:
    """Pull resting heart rate from Withings and upsert into rhr_logs.

    Readings ≥ RHR_SAUNA_THRESHOLD are diverted to sauna_logs instead, because
    they originate from using the Withings Breathe app during sauna sessions
    rather than genuine resting heart-rate measurements (see R11 / D44).
    """
    body = await _withings_get(access_token, WITHINGS_MEASURE_URL, {
        "action": "getmeas",
        "meastype": 11,  # Heart rate
        "category": 1,
        "startdate": since_ts,
        "enddate": int(datetime.now(timezone.utc).timestamp()),
    })

    count = 0
    seen_dates = set()
    for grp in body.get("measuregrps", []):
        recorded_at = datetime.fromtimestamp(grp["date"], tz=timezone.utc)
        log_date = recorded_at.date()
        if log_date in seen_dates:
            continue  # Take first reading per day

        for measure in grp["measures"]:
            if measure["type"] == 11:
                hr_value = measure["value"] * (10 ** measure["unit"])
                bpm = round(hr_value)

                if bpm >= RHR_SAUNA_THRESHOLD:
                    # Anomalous HR — treat as a sauna session artefact
                    logger.info(
                        "RHR %d bpm on %s exceeds threshold %d — diverting to sauna_logs",
                        bpm, log_date, RHR_SAUNA_THRESHOLD,
                    )
                    sauna_entry = SaunaLog(
                        session_datetime=recorded_at,
                        session_type="traditional",
                        duration_mins=30,  # assumed duration (D44)
                        source=SOURCE,
                        notes=f"Auto-created from anomalous RHR reading ({bpm} bpm)",
                    )
                    db.add(sauna_entry)
                else:
                    stmt = pg_insert(RhrLog).values(
                        log_date=log_date,
                        rhr_bpm=bpm,
                        source=SOURCE,
                    ).on_conflict_do_nothing(
                        index_elements=["log_date", "source"],
                    )
                    await db.execute(stmt)

                seen_dates.add(log_date)
                count += 1

    return count


async def cleanup_anomalous_rhr(db: AsyncSession) -> dict:
    """One-time cleanup: move existing RHR rows ≥ threshold into sauna_logs.

    Returns summary of rows moved and deleted.
    """
    from sqlalchemy import delete

    result = await db.execute(
        select(RhrLog).where(RhrLog.rhr_bpm >= RHR_SAUNA_THRESHOLD)
    )
    bad_rows = result.scalars().all()

    created = 0
    deleted = 0
    for row in bad_rows:
        # Create a SaunaLog entry
        sauna_entry = SaunaLog(
            session_datetime=datetime.combine(
                row.log_date, datetime.min.time(), tzinfo=timezone.utc,
            ),
            session_type="traditional",
            duration_mins=30,
            source=SOURCE,
            notes=f"Backfill from anomalous RHR ({row.rhr_bpm} bpm)",
        )
        db.add(sauna_entry)
        created += 1

        # Delete the bad RHR row
        await db.execute(delete(RhrLog).where(RhrLog.id == row.id))
        deleted += 1

    return {"sauna_created": created, "rhr_deleted": deleted}


async def sync_activities(db: AsyncSession, access_token: str, since_ts: int) -> int:
    """Pull activities from Withings and upsert into activity_logs."""
    start_date = datetime.fromtimestamp(since_ts, tz=timezone.utc).strftime("%Y-%m-%d")
    end_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    body = await _withings_get(access_token, WITHINGS_ACTIVITY_URL, {
        "action": "getactivity",
        "startdateymd": start_date,
        "enddateymd": end_date,
        "data_fields": "steps,distance,elevation,soft,moderate,intense,active,calories,totalcalories,hr_average,hr_min,hr_max,hr_zone_0,hr_zone_1,hr_zone_2,hr_zone_3",
    })

    count = 0
    for activity in body.get("activities", []):
        activity_date_str = activity.get("date")
        if not activity_date_str:
            continue

        from datetime import date as date_type
        activity_date = date_type.fromisoformat(activity_date_str)
        external_id = f"withings_daily_{activity_date_str}"
        distance_km = round(activity.get("distance", 0) / 1000, 2)
        duration_min = round(activity.get("active", 0) / 60, 1) if activity.get("active") else None

        # Build zone_seconds from daily HR zones if available
        zone_keys = ["hr_zone_0", "hr_zone_1", "hr_zone_2", "hr_zone_3"]
        zone_data = None
        if any(activity.get(k) for k in zone_keys):
            zone_data = {k: activity.get(k, 0) for k in zone_keys}

        values = {
            "external_id": external_id,
            "activity_type": "daily_summary",
            "activity_date": activity_date,
            "duration_mins": duration_min,
            "distance_km": distance_km if distance_km > 0 else None,
            "calories_burned": activity.get("totalcalories"),
            "avg_hr": activity.get("hr_average"),
            "max_hr": activity.get("hr_max"),
            "elevation_m": activity.get("elevation"),
            "zone_seconds": zone_data,
            "notes": f"steps: {activity.get('steps')}" if activity.get("steps") else None,
            "source": SOURCE,
        }

        stmt = pg_insert(ActivityLog).values(**values).on_conflict_do_update(
            index_elements=["external_id", "source"],
            set_={k: v for k, v in values.items() if k not in ("external_id", "source", "activity_type", "activity_date")},
        )
        await db.execute(stmt)
        count += 1

    return count


async def sync_workouts(db: AsyncSession, access_token: str, since_ts: int) -> int:
    """Pull individual workouts from Withings getworkouts and upsert into activity_logs.

    Category 36 (miscellaneous) with HR data but low distance is treated as a
    sauna session and also linked to sauna_logs via withings_activity_id.
    """
    params: dict = {
        "action": "getworkouts",
        "lastupdate": since_ts,
        "data_fields": (
            "calories,effduration,steps,distance,elevation,"
            "hr_average,hr_max,hr_min,hr_zone_0,hr_zone_1,hr_zone_2,hr_zone_3,"
            "pause_duration,pool_laps,strokes,spo2_average"
        ),
    }

    count = 0
    has_more = True

    while has_more:
        body = await _withings_get(access_token, WITHINGS_WORKOUT_URL, params)
        series = body.get("series", [])
        has_more = body.get("more", False)
        if has_more:
            params["offset"] = body.get("offset", 0)

        for workout in series:
            w_id = workout.get("id")
            if not w_id:
                continue

            category = workout.get("category", 0)
            activity_type = WORKOUT_CATEGORY_MAP.get(category, "other")
            data = workout.get("data", {})

            # Timestamps
            start_ts = workout.get("startdate", 0)
            end_ts = workout.get("enddate", start_ts)
            start_dt = datetime.fromtimestamp(start_ts, tz=timezone.utc)
            activity_date = start_dt.date()

            # Duration from effduration (effective seconds) or start/end delta
            eff_duration = data.get("effduration")
            if eff_duration:
                duration_mins = round(eff_duration / 60, 1)
            else:
                duration_mins = round((end_ts - start_ts) / 60, 1) if end_ts > start_ts else None

            # Distance in km
            distance_m = data.get("distance", 0)
            distance_km = round(distance_m / 1000, 2) if distance_m else None

            # Pace for runs/walks (sec per km)
            avg_pace_secs = None
            if distance_km and distance_km > 0.01 and duration_mins and activity_type in ("run", "walk"):
                avg_pace_secs = round((duration_mins * 60) / distance_km, 1)

            # HR zone data as JSONB
            zone_seconds = None
            zone_keys = ["hr_zone_0", "hr_zone_1", "hr_zone_2", "hr_zone_3"]
            if any(data.get(k) for k in zone_keys):
                zone_seconds = {k: data.get(k, 0) for k in zone_keys}

            external_id = f"withings_workout_{w_id}"

            values = {
                "external_id": external_id,
                "activity_type": activity_type,
                "activity_date": activity_date,
                "duration_mins": duration_mins,
                "distance_km": distance_km,
                "avg_pace_secs": avg_pace_secs,
                "avg_hr": data.get("hr_average"),
                "max_hr": data.get("hr_max"),
                "calories_burned": data.get("calories"),
                "elevation_m": data.get("elevation"),
                "zone_seconds": zone_seconds,
                "source": SOURCE,
            }

            stmt = pg_insert(ActivityLog).values(**values).on_conflict_do_nothing(
                index_elements=["external_id", "source"],
            )
            result = await db.execute(stmt)
            if result.rowcount > 0:
                count += 1

            # --- Sauna special case ---
            # Category 36 (miscellaneous) + has HR data + low distance → sauna
            if category == 36 and data.get("hr_average") and (not distance_m or distance_m < 50):
                existing_sauna = await db.execute(
                    select(SaunaLog).where(SaunaLog.withings_activity_id == w_id)
                )
                if existing_sauna.scalar_one_or_none() is None:
                    sauna_entry = SaunaLog(
                        session_datetime=start_dt,
                        session_type="traditional",
                        duration_mins=int(duration_mins) if duration_mins else 0,
                        withings_activity_id=w_id,
                        source=SOURCE,
                    )
                    db.add(sauna_entry)

    return count


async def run_full_sync(db: AsyncSession) -> dict:
    """Run a full sync of all Withings data types. Returns summary dict."""
    batch_id = uuid.uuid4()
    sync_log = SyncLog(
        source=SOURCE,
        sync_type="daily",
        status="running",
    )
    db.add(sync_log)
    await db.flush()

    try:
        access_token = await get_valid_token(db)

        # Determine start time — last sync or 7 days ago
        result = await db.execute(
            select(SyncState.last_sync_at).where(SyncState.source == SOURCE)
        )
        last_sync = result.scalar_one_or_none()
        if last_sync:
            since_ts = int(last_sync.timestamp())
        else:
            since_ts = int((datetime.now(timezone.utc) - timedelta(days=7)).timestamp())

        # Sync each data type
        results = {}
        for name, sync_fn in [
            ("weight", sync_weight),
            ("sleep", sync_sleep),
            ("rhr", sync_rhr),
            ("activities", sync_activities),
            ("workouts", sync_workouts),
        ]:
            try:
                count = await sync_fn(db, access_token, since_ts)
                results[name] = count
                db.add(SyncEvent(
                    source=SOURCE,
                    event_type=f"sync_{name}",
                    status="success",
                    records_created=count,
                    batch_id=batch_id,
                ))
            except Exception as e:
                logger.error(f"Error syncing {name}: {e}")
                results[name] = f"error: {str(e)}"
                db.add(SyncEvent(
                    source=SOURCE,
                    event_type=f"sync_{name}",
                    status="error",
                    error_message=str(e),
                    batch_id=batch_id,
                ))

        # Sync sleep stages + intraday HR for last 2 days
        today = datetime.now(timezone.utc).date()
        stages_count = 0
        hr_intraday_count = 0
        for delta in range(2):
            day = today - timedelta(days=delta)
            try:
                stored = await sync_sleep_stages(db, access_token, day.isoformat())
                if stored:
                    stages_count += 1
            except Exception as e:
                logger.warning("sync_sleep_stages error for %s: %s", day, e)
            try:
                buckets = await sync_intraday_hr(db, access_token, day.isoformat())
                hr_intraday_count += buckets
            except Exception as e:
                logger.warning("sync_intraday_hr error for %s: %s", day, e)
        results["sleep_stages"] = stages_count
        results["hr_intraday"] = hr_intraday_count

        # Update sync state and log
        total = sum(v for v in results.values() if isinstance(v, int))
        sync_log.status = "success"
        sync_log.records_synced = total

        await db.execute(
            pg_insert(SyncState).values(
                source=SOURCE,
                last_sync_at=datetime.now(timezone.utc),
            ).on_conflict_do_update(
                index_elements=["source"],
                set_={
                    "last_sync_at": datetime.now(timezone.utc),
                },
            )
        )

        await db.flush()
        return {"status": "success", "records": results, "total": total}

    except Exception as e:
        logger.error(f"Sync failed: {e}")
        sync_log.status = "error"
        sync_log.error_message = str(e)
        await db.flush()
        return {"status": "error", "error": str(e)}
