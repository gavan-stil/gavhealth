#!/usr/bin/env python3
"""
Withings CSV → Railway PostgreSQL bulk import.

Imports: weight_logs, sleep_logs, activity_logs
De-dupes against existing rows — safe to run multiple times.

Usage:
  DATABASE_URL='postgresql://user:pass@host:port/db' python3 import_withings_csv.py
  python3 import_withings_csv.py 'postgresql://user:pass@host:port/db'
"""

import csv
import json
import os
import sys
from dateutil import parser as dtparse
import psycopg2
from psycopg2.extras import execute_values

BATCH_SIZE = 500

DATA_DIR = "/Users/gavanstilgoe/Desktop/Withings_data_gav_5_mar_2026"

# Withings activity type → our DB activity_type string
ACTIVITY_TYPE_MAP = {
    "Weights": "workout",
    "Gym class": "workout",
    "Running": "run",
    "Indoor Running": "run",
    "Cycling": "ride",
    "Walking": "walk",
    "Indoor Walk": "walk",
    "Volleyball": "volleyball",
    "Yoga": "yoga",
    "Pilates": "pilates",
    "Swimming": "swim",
    "Surfing": "surf",
    "Other": "other",
    "Elliptical": "elliptical",
    "Rowing": "row",
    "Handball": "handball",
    "Ice Skating": "skate",
    "Standup Paddleboarding": "sup",
}


def parse_dt(s):
    if not s or not s.strip():
        return None
    try:
        return dtparse.parse(s.strip())
    except Exception:
        return None


def safe_float(val):
    try:
        v = float(val)
        return v if v > 0 else None
    except (TypeError, ValueError):
        return None


def safe_int(val):
    try:
        v = int(float(val))
        return v if v > 0 else None
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# weight_logs
# ---------------------------------------------------------------------------
def import_weight(conn):
    print("\n--- Importing weight_logs ---")
    cur = conn.cursor()
    rows = []
    errors = 0

    with open(f"{DATA_DIR}/weight.csv", newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            try:
                recorded_at = parse_dt(row.get("Date"))
                if not recorded_at:
                    continue
                rows.append((
                    recorded_at,
                    safe_float(row.get("Weight (kg)")),
                    safe_float(row.get("Fat mass (kg)")),
                    safe_float(row.get("Bone mass (kg)")),
                    safe_float(row.get("Muscle mass (kg)")),
                    safe_float(row.get("Hydration (kg)")),
                ))
            except Exception as e:
                errors += 1
                print(f"  Weight row error: {e} | row={row.get('Date')}")

    inserted = 0
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i:i + BATCH_SIZE]
        execute_values(
            cur,
            """
            INSERT INTO weight_logs
                (recorded_at, weight_kg, fat_mass_kg, bone_mass_kg,
                 muscle_mass_kg, hydration_kg, source)
            VALUES %s
            ON CONFLICT ON CONSTRAINT uq_weight_recorded_source DO NOTHING
            """,
            [(r[0], r[1], r[2], r[3], r[4], r[5], "withings_csv") for r in batch],
        )
        inserted += cur.rowcount
        conn.commit()
        print(f"  Batch {i // BATCH_SIZE + 1}: {cur.rowcount} inserted")

    skipped = len(rows) - inserted
    print(f"  Total — Inserted: {inserted}  Skipped (duplicate): {skipped}  Errors: {errors}")


# ---------------------------------------------------------------------------
# sleep_logs
# ---------------------------------------------------------------------------
def import_sleep(conn):
    print("\n--- Importing sleep_logs ---")
    cur = conn.cursor()
    rows = []
    errors = 0

    def secs_to_hrs(val):
        try:
            v = float(val)
            return round(v / 3600, 4) if v > 0 else None
        except (TypeError, ValueError):
            return None

    with open(f"{DATA_DIR}/sleep.csv", newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            try:
                bed_time = parse_dt(row.get("from"))
                wake_time = parse_dt(row.get("to"))
                if not bed_time:
                    continue

                sleep_date = bed_time.date()
                light = secs_to_hrs(row.get("light (s)"))
                deep = secs_to_hrs(row.get("deep (s)"))
                rem = secs_to_hrs(row.get("rem (s)"))
                awake = secs_to_hrs(row.get("awake (s)"))

                parts = [x for x in [light, deep, rem] if x is not None]
                total = round(sum(parts), 4) if parts else None

                hr_avg = safe_int(row.get("Average heart rate"))
                hr_min = safe_int(row.get("Heart rate (min)"))

                rows.append((sleep_date, bed_time, wake_time, total, deep, light, rem, awake, hr_avg, hr_min))
            except Exception as e:
                errors += 1
                print(f"  Sleep row error: {e} | row={row.get('from')}")

    inserted = 0
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i:i + BATCH_SIZE]
        execute_values(
            cur,
            """
            INSERT INTO sleep_logs
                (sleep_date, bed_time, wake_time, total_sleep_hrs,
                 deep_sleep_hrs, light_sleep_hrs, rem_sleep_hrs,
                 awake_hrs, sleep_hr_avg, sleep_hr_min, source)
            VALUES %s
            ON CONFLICT ON CONSTRAINT uq_sleep_date_source DO NOTHING
            """,
            [(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], "withings_csv") for r in batch],
        )
        inserted += cur.rowcount
        conn.commit()
        print(f"  Batch {i // BATCH_SIZE + 1}: {cur.rowcount} inserted")

    skipped = len(rows) - inserted
    print(f"  Total — Inserted: {inserted}  Skipped (duplicate): {skipped}  Errors: {errors}")


# ---------------------------------------------------------------------------
# activity_logs
# ---------------------------------------------------------------------------
def import_activities(conn):
    print("\n--- Importing activity_logs ---")
    cur = conn.cursor()
    rows = []
    errors = 0

    with open(f"{DATA_DIR}/activities.csv", newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            try:
                from_dt = parse_dt(row.get("from"))
                to_dt = parse_dt(row.get("to"))
                if not from_dt:
                    continue

                activity_date = from_dt.date()
                duration_mins = (
                    round((to_dt - from_dt).total_seconds() / 60, 2)
                    if to_dt
                    else None
                )

                raw_type = (row.get("Activity type") or "").strip()
                activity_type = ACTIVITY_TYPE_MAP.get(raw_type, raw_type.lower().replace(" ", "_"))

                try:
                    data = json.loads(row.get("Data") or "{}")
                except Exception:
                    data = {}

                # Calories: prefer manual_calories (Withings estimate), fall back to device calories
                manual_cal = data.get("manual_calories")
                device_cal = data.get("calories")
                calories = None
                if manual_cal is not None:
                    try:
                        v = float(manual_cal)
                        if v > 0:
                            calories = int(round(v))
                    except (TypeError, ValueError):
                        pass
                if calories is None and device_cal is not None:
                    try:
                        v = float(device_cal)
                        if v > 0:
                            calories = int(round(v))
                    except (TypeError, ValueError):
                        pass

                avg_hr = safe_int(data.get("hr_average"))
                max_hr = safe_int(data.get("hr_max"))

                dist_m = safe_float(data.get("distance"))
                distance_km = round(dist_m / 1000, 4) if dist_m else None
                elevation_m = safe_float(data.get("elevation"))

                zone_data = {
                    f"zone_{i}": data.get(f"hr_zone_{i}")
                    for i in range(4)
                    if data.get(f"hr_zone_{i}") is not None
                }
                zone_seconds = json.dumps(zone_data) if zone_data else None

                external_id = row.get("from")

                rows.append((
                    activity_date, activity_type, duration_mins, avg_hr, max_hr,
                    calories, distance_km, elevation_m, zone_seconds, external_id,
                ))
            except Exception as e:
                errors += 1
                print(f"  Activity row error: {e} | row={row.get('from')}")

    inserted = 0
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i:i + BATCH_SIZE]
        execute_values(
            cur,
            """
            INSERT INTO activity_logs
                (activity_date, activity_type, duration_mins, avg_hr, max_hr,
                 calories_burned, distance_km, elevation_m, zone_seconds,
                 source, external_id)
            VALUES %s
            ON CONFLICT ON CONSTRAINT uq_activity_ext_source DO NOTHING
            """,
            [
                (r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7],
                 psycopg2.extras.Json(json.loads(r[8])) if r[8] else None,
                 "withings_csv", r[9])
                for r in batch
            ],
        )
        inserted += cur.rowcount
        conn.commit()
        print(f"  Batch {i // BATCH_SIZE + 1}: {cur.rowcount} inserted")

    skipped = len(rows) - inserted
    print(f"  Total — Inserted: {inserted}  Skipped (duplicate): {skipped}  Errors: {errors}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    db_url = (len(sys.argv) > 1 and sys.argv[1]) or os.environ.get("DATABASE_URL")
    if not db_url:
        print("Usage:")
        print("  python3 import_withings_csv.py 'postgresql://user:pass@host:port/db'")
        print("  DATABASE_URL='postgresql://...' python3 import_withings_csv.py")
        sys.exit(1)

    # Normalise asyncpg-style URL to psycopg2
    db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")

    print(f"Connecting to database...")
    try:
        conn = psycopg2.connect(db_url)
    except Exception as e:
        print(f"Connection failed: {e}")
        sys.exit(1)

    print("Connected.")

    import_weight(conn)
    import_sleep(conn)
    import_activities(conn)

    conn.close()
    print("\nAll done.")


if __name__ == "__main__":
    main()
