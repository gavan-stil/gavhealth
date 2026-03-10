# Withings Data Reference

> Verified 2026-03-06. Describes what the Withings API actually sends, what we store, and what gaps exist.

---

## Device

**ScanWatch Horizon** — measures HR, HR zones, SpO2, sleep, steps, calories, workout type/duration.

---

## Activity Types in Our DB

The backend maps Withings workout categories to a string type stored in `activity_log.activity_type`.

| DB `activity_type` | Withings Category | What it is |
|---|---|---|
| `run` | Running (~1) | Outdoor/treadmill runs |
| `ride` | Cycling (~2) | Bike rides |
| `workout` | LiftWeights (46) | Gym/strength sessions from ScanWatch |
| `daily_summary` | — | Withings daily step/calorie summary |

> `workout` = the Withings LiftWeights category. This is the primary strength session record from the device. Sets/reps/weight are NOT in Withings data — those come from manual NLP logging into `strength_sessions`.

---

## What Withings Sends (workoutv2 API)

Per session, Withings provides:

| Withings field | Description | Stored in DB? |
|---|---|---|
| `category` | Workout type code (e.g. 46 = LiftWeights) | ⚠️ Mapped to type string, code lost |
| `startdate` / `enddate` | Unix timestamps | ✅ Derived as `duration_mins` |
| `data.calories` | Calories burned | ✅ `calories_burned` |
| `data.hr_average` | Average HR | ✅ `avg_hr` |
| `data.hr_max` | Max HR | ✅ `max_hr` |
| `data.hr_min` | Min HR | ❌ Not stored |
| `data.hr_zone_0` | Time in zone 0 (rest/low) secs | ❌ Not stored |
| `data.hr_zone_1` | Time in zone 1 (fat burn) secs | ❌ Not stored |
| `data.hr_zone_2` | Time in zone 2 (cardio) secs | ❌ Not stored |
| `data.hr_zone_3` | Time in zone 3 (peak) secs | ❌ Not stored |
| `data.intensity` | Session intensity score | ❌ Not stored |
| `data.effduration` | Effective duration (excl. pauses) secs | ❌ Not stored |
| `data.pause_duration` | Total paused time secs | ❌ Not stored |
| `data.spo2_average` | SpO2 % average | ❌ Not stored |
| `data.distance` | Distance (runs/rides) | ✅ `distance_km` |
| `data.elevation` | Elevation gain (runs) | ✅ `elevation_m` |
| `data.steps` | Steps (daily summary) | ⚠️ Stored in `notes` as string |

> DB has a `zone_seconds` column that exists but is always NULL — this may have been intended for HR zone data but was never populated.

---

## Strength Session Data Model

Withings tracks that a LiftWeights workout happened. Sets/reps/weight come from manual NLP logging.

```
activity_log (workout type)          strength_sessions
  └── id, date, duration, avg_hr  ←→  └── session_datetime, notes
                                           └── strength_sets
                                                 └── exercise_id, set_number,
                                                     reps, weight_kg,
                                                     is_bodyweight,
                                                     bodyweight_at_session ⚠️ NULL
```

**Key gap:** `bodyweight_at_session` is never populated at log time. Must pull from `weight_log` for the session date (or 7-day rolling avg) to compute total load.

**Key gap:** `strength_sessions` and `activity_log` are not linked yet (Task 7 partial fix). There's no FK between them.

---

## Computed Metrics (client-side or new endpoints)

These metrics don't exist in the DB and must be computed:

| Metric | Formula | Data needed |
|---|---|---|
| Total load per session | `SUM(sets × reps × (bodyweight + weight_kg))` | `strength_sets` + `weight_log` |
| Avg weight per set | `total_load / total_sets` | Above |
| Cumulative monthly load per exercise | `SUM(sets × reps × weight_kg)` over 4-week window | `strength_sets` grouped by exercise + month |
| 1RM estimate | `weight_kg × (1 + reps/30)` (Epley formula) | `strength_sets` per exercise |

---

## Backend Work — Strength Trends ✅ COMPLETE (2026-03-10)

All 4 blocking strength trends backend tasks are live. Verified via curl.

### ✅ 1. Store bodyweight at log time
- `_lookup_bodyweight()` in `new_endpoints.py` — exact date match, falls back to 7-day rolling avg
- Populated into `strength_sets.bodyweight_at_session` at log time

### ✅ 2. Link strength_sessions → activity_log
- `activity_log_id FK` on `strength_sessions` table
- Matched by date proximity in `save_strength_log`

### ✅ 3. GET /api/strength/sessions?days=N
- Returns per-session aggregates: date, total_sets, total_reps, total_load, exercises[], duration, avg_hr
- Curl-verified 200 OK with real data

### ✅ 4. GET /api/strength/exercise/:id/history?days=N
- Returns per-session data per exercise: date, sets, reps, top_weight, session_volume
- Curl-verified 200 OK

### 5. Store HR zones from Withings (MEDIUM — intensity tracking)
- Alter `activity_log` to add `hr_zone_0/1/2/3` integer columns (seconds in each zone)
- Update Withings sync to populate them
- The existing `zone_seconds` column is always NULL — repurpose or add proper zone columns

### 6. Store `intensity` and `effduration` from Withings (LOW)
- Useful for workout quality scoring but not blocking

### 7. Store steps properly from daily_summary (LOW)
- Currently stuffed into `notes` as a string — should be its own column

---

## Current Data Volume (as of 2026-03-07)

| Table | Count | Date range |
|---|---|---|
| `activity_logs` — workout | 2,076 | Jan 2020 – Mar 2026 |
| `activity_logs` — run | 1,609 | Jan 2020 – Mar 2026 |
| `activity_logs` — walk | 2,043 | Jan 2020 – Mar 2026 |
| `activity_logs` — ride | 341 | Jan 2020 – Mar 2026 |
| `activity_logs` — other types | ~884 | Jan 2020 – Mar 2026 |
| `sleep_logs` | 2,805 | Jan 2020 – Mar 2026 |
| `weight_logs` | 937 | Jan 2020 – Mar 2026 |
| `strength_sessions` (manual) | 2 | Mar 2026 |
| `strength_sets` (manual) | 7 | Mar 2026 |

> Bulk-imported 2026-03-07 from `Desktop/Withings_data_gav_5_mar_2026/` using `backend/import_withings_csv.py`.
> Source tag: `withings_csv`. Script is idempotent — safe to re-run with newer exports.

---

## CSV Import Script

`backend/import_withings_csv.py` — imports weight, sleep, and activities from a Withings CSV export folder.

```bash
python3 backend/import_withings_csv.py 'postgresql://...'
```

- De-dupes on `(external_id, source)` / `(recorded_at, source)` — safe to re-run
- `external_id` = ISO `from` timestamp from activities.csv
- Activity type mapping: Weights/Gym class → `workout`, Running → `run`, Cycling → `ride`, Walking → `walk`, etc.
- Calories: uses `manual_calories` field (Withings estimate), falls back to device `calories`
- HR zones stored as JSONB in `zone_seconds` column

---

## Notes on Data Relationship

The intended flow once backend work is done:

```
1. User lifts weights → ScanWatch records workout (type=LiftWeights)
2. Withings sync → activity_log row (type='workout', duration, avg_hr, calories)
3. User opens app → logs session via NLP → strength_session + strength_sets created
4. Backend auto-links strength_session.activity_log_id = activity_log.id (by date proximity)
5. Frontend joins both: Withings gives duration/HR, manual gives sets/reps/weight
6. Total load = SUM(sets × reps × (weight_kg + bodyweight_at_session))
```
