# Withings Data Reference

> Originally verified 2026-03-06. Updated 2026-03-14 (T23 — all major gaps closed).

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
| `startdate` / `enddate` | Unix timestamps | ✅ `started_at` + derived `duration_mins` |
| `data.calories` | Calories burned | ✅ `calories_burned` |
| `data.hr_average` | Average HR | ✅ `avg_hr` |
| `data.hr_max` | Max HR | ✅ `max_hr` |
| `data.hr_min` | Min HR | ✅ `min_hr` |
| `data.hr_zone_0` | Time in zone 0 (rest/low) secs | ✅ `hr_zone_0` (integer seconds) |
| `data.hr_zone_1` | Time in zone 1 (fat burn) secs | ✅ `hr_zone_1` |
| `data.hr_zone_2` | Time in zone 2 (cardio) secs | ✅ `hr_zone_2` |
| `data.hr_zone_3` | Time in zone 3 (peak) secs | ✅ `hr_zone_3` |
| `data.intensity` | Session intensity score | ❌ Not stored (not a blocking gap) |
| `data.effduration` | Effective duration (excl. pauses) secs | ✅ Used to derive `duration_mins` (preferred over start/end delta) |
| `data.pause_duration` | Total paused time secs | ✅ `pause_duration_mins` (÷60, T23) |
| `data.spo2_average` | SpO2 % average | ✅ `spo2_avg` (T23) |
| `data.pool_laps` | Swim lap count | ✅ `pool_laps` (T23) |
| `data.strokes` | Swim stroke count | ✅ `strokes` (T23) |
| `data.distance` | Distance (runs/rides) | ✅ `distance_km` |
| `data.elevation` | Elevation gain (runs) | ✅ `elevation_m` |
| `data.steps` | Steps per workout | ✅ `steps` |

> `zone_seconds` JSONB column also exists as a legacy fallback (stores raw zone dict); the dedicated integer columns `hr_zone_0/1/2/3` are the primary store.

---

## What Withings Sends (getmeas — weight/body comp)

Meastype groupings per scale session (`grpid`):

| Meastype | Description | DB column |
|---|---|---|
| 1 | Weight (kg) | `weight_kg` |
| 5 | Fat-free mass (kg) | `fat_free_mass_kg` ✅ T23 |
| 6 | Fat ratio (%) | `fat_ratio_pct` ✅ T23 |
| 8 | Fat mass (kg) | `fat_mass_kg` |
| 76 | Muscle mass (kg) | `muscle_mass_kg` |
| 77 | Hydration (kg) | `hydration_kg` |
| 88 | Bone mass (kg) | `bone_mass_kg` |

All 7 measttypes are now fetched in a single `getmeas` call (`meastype: "1,5,6,8,76,77,88"`), grouped by `grpid`, and upserted into a single `weight_logs` row per scale session. Previously only meastype 1 was fetched — all body comp columns were empty for API-sourced rows (only CSV-imported rows had comp data).

---

## What Withings Sends (getsummary — sleep)

| Withings field | Description | DB column |
|---|---|---|
| `hr_average` | Average HR during sleep | `sleep_hr_avg` |
| `hr_min` | Minimum HR (≈ RHR proxy) | `sleep_hr_min` |
| `hr_max` | Maximum HR during sleep | `sleep_hr_max` ✅ T23 |
| `rr_average` | Respiratory rate (breaths/min) | `respiratory_rate` |
| `spo2_average` | Average SpO2 % | `spo2_avg` ✅ T23 |
| `sleep_score` | Withings sleep score | `sleep_score` |
| `sleep_efficiency` | Sleep efficiency ratio | `sleep_efficiency_pct` |
| `total_sleep_time` | Total sleep seconds | `total_sleep_hrs` |
| `deepsleepduration` | Deep sleep seconds | `deep_sleep_hrs` |
| `lightsleepduration` | Light sleep seconds | `light_sleep_hrs` |
| `remsleepduration` | REM sleep seconds | `rem_sleep_hrs` |

---

## What Withings Sends (getactivity — daily summary)

| Withings field | Description | DB column |
|---|---|---|
| `steps` | Total steps | `steps` |
| `active` | Active time (seconds) | `duration_mins` (÷60) |
| `totalcalories` | Total calories burned (TDEE) | `calories_burned` |
| `hr_average` | Average HR for day | `avg_hr` |
| `hr_max` | Max HR for day | `max_hr` |
| `soft` | Soft activity seconds | `soft_mins` ✅ T23 (÷60) |
| `moderate` | Moderate activity seconds | `moderate_mins` ✅ T23 (÷60) |
| `intense` | Intense activity seconds | `intense_mins` ✅ T23 (÷60) |
| `distance` | Distance metres | `distance_km` |
| `elevation` | Elevation gain metres | `elevation_m` |

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

---

## RHR Data Source

Withings provides RHR via two mechanisms:

1. **Meastype 11** — manual spot-check HR readings taken via the Breathe app. These ran until ~2026-03-05 then stopped (user stopped using Breathe app for daily checks).
2. **`sleep_hr_min`** — minimum HR recorded during sleep (sleep summary API). This is the best available proxy for overnight resting HR and has been populated daily throughout.

**T23 fix:** `derive_rhr_from_sleep()` runs after every `sync_rhr`. It reads `sleep_logs.sleep_hr_min` for the last 7 days and inserts into `rhr_logs` using `on_conflict_do_nothing(log_date, source)`. If a meastype-11 reading exists for a date, it wins (both use source=`"withings"`). If no spot check exists, sleep_hr_min fills the gap. This restores continuous RHR data from 2026-03-05 onwards.

---

## Sync Reliability Protocol (implemented 2026-03-13)

Withings delivers data lazily — GPS distance, HR data, and daily summary step counts can arrive hours after the workout completes. The sync strategy is designed so that **every sync can correct previously incomplete data**.

### Upsert strategy per endpoint

| Endpoint | Lookback window | Upsert behaviour |
|---|---|---|
| `getworkouts` | min(since_ts, 30 days) | **COALESCE** per field — new non-NULL wins, existing non-NULL preserved if new is NULL |
| `getactivity` (daily summaries) | min(since_ts, 7 days) | Blind overwrite — daily rollup always replaced with latest aggregated data |
| `getsummary` (sleep) | min(since_ts, 3 days) | COALESCE per field |
| `getintradayactivity` (intraday HR) | Today + yesterday (2 days) | Upsert by hour bucket |

### Why COALESCE for workouts?
Withings sometimes attaches HR and GPS data hours after initial upload. If we blindly overwrote on re-sync, a second pass (before data arrives) would null out previously-good values. COALESCE ensures:
- Incoming non-NULL value → always written (correct stale wrong values, fill NULLs)
- Incoming NULL → keep existing value (ignore late-delivery gaps)

### backfill_incomplete_workouts
Runs inside every `run_full_sync`. Queries for workout rows with `avg_hr IS NULL`, `distance_km IS NULL` (for runs/walks), or `steps IS NULL` within 60 days. If found, extends the workout lookback to 60 days to catch all pending late-delivery rows.

### Known late-delivery fields
- **GPS distance** (`data.distance`): can be step-estimated on first sync, replaced with GPS value later. Re-sync within 30-day window corrects this automatically via COALESCE.
- **HR average/min/max**: typically arrives within minutes but can lag on cellular sync.
- **Daily steps** (`getactivity`): Withings finalises daily totals overnight.

### Category map corrections (2026-03-13)
- Category `187` = outdoor GPS run (was incorrectly mapped to `"other"`, now `"run"`)
- Category `188` = indoor cycling (was `"other"`, now `"ride"`)
- Category `99` = treadmill run → `"run"`

### API cost impact
No per-call billing — Withings API is free for OAuth personal use. Rate limit is ~120 req/min; our sync uses 6–12 calls per run well under this. The 30-day workout lookback returns ~30–100 rows in 1–3 paginated calls — negligible. Even 10 syncs/day = <150 calls/day.

---

### ✅ 5. Store HR zones from Withings — DONE
- `hr_zone_0/1/2/3` integer columns added; populated via COALESCE upsert in `sync_workouts`

### ✅ 6. Store `effduration` from Withings — DONE
- `effduration` used preferentially to derive `duration_mins`; `pause_duration_mins` column added (T23)

### ✅ 7. Store steps from daily_summary — DONE
- `steps` INTEGER column in `activity_logs`; populated from `getactivity`

### ✅ 8 (T23). Body comp, SpO2, intensity fields — DONE
- See T23 section above.

### ⚠️ kJ unit inconsistency in daily_summary rows (DATA QUALITY)
- Some bulk-imported `daily_summary` rows have `calories_burned` stored in **kJ not kcal**.
- Affected rows identified: 2026-03-06 (12926 kJ) and 2026-03-07 (12634 kJ). These also have anomalously large `duration_mins` (~1100).
- Root cause: likely CSV export format difference (Withings CSV uses kJ in some locales/exports).
- **Workaround (implemented):** `GET /api/energy-balance` applies `CASE WHEN calories_burned > 8000 THEN ROUND(calories_burned / 4.184) ELSE calories_burned END`. No human burns >8000 kcal/day normally; anything above that threshold is treated as kJ.
- TODO: update the raw DB rows to store kcal consistently (or add a `calories_unit` column). Low urgency while the endpoint guard is in place.

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
