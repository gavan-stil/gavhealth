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

## Backend Work Required

Ordered by priority for strength trends feature:

### 1. Store bodyweight at log time (HIGH — blocks load calculations)
- On `POST /api/log/strength/confirm` and `POST /api/log/strength/save`
- Look up `weight_log` for session date, fall back to 7-day rolling avg
- Populate `strength_sets.bodyweight_at_session`

### 2. Link strength_sessions → activity_log (HIGH — blocks cascade drill-down)
- Add `activity_log_id FK` to `strength_sessions`
- Match on date + duration proximity at log time
- Allows joining Withings duration/HR with manual sets/reps

### 3. New GET endpoint: `/api/strength/sessions?days=N` (HIGH — new UI)
- Returns per-session aggregates: date, total_sets, total_reps, total_load, avg_load_per_set, duration (from linked activity_log), avg_hr
- Groups by session, ordered by date desc

### 4. New GET endpoint: `/api/strength/exercise/:id/history?days=N` (HIGH — exercise drill-down)
- Returns per-session data for one exercise: date, sets, reps, top_weight, session_volume (sets×reps×weight)
- Existing `/api/strength/:exercise_id` returns 404 — not wired or wrong path

### 5. Store HR zones from Withings (MEDIUM — intensity tracking)
- Alter `activity_log` to add `hr_zone_0/1/2/3` integer columns (seconds in each zone)
- Update Withings sync to populate them
- The existing `zone_seconds` column is always NULL — repurpose or add proper zone columns

### 6. Store `intensity` and `effduration` from Withings (LOW)
- Useful for workout quality scoring but not blocking

### 7. Store steps properly from daily_summary (LOW)
- Currently stuffed into `notes` as a string — should be its own column

---

## Current Data Volume (as of 2026-03-06)

| Type | Count | Date range |
|---|---|---|
| `workout` (LiftWeights) | 6 sessions | Feb 25 – Mar 4 2026 |
| `run` | 23 sessions | Feb 5 – Mar 5 2026 |
| `ride` | 17 sessions | Feb 5 – Mar 2 2026 |
| `daily_summary` | 4 entries | Recent only |
| `strength_sessions` (manual) | 2 sessions | Mar 2026 |
| `strength_sets` (manual) | 7 sets | Mar 2026 |

> Data is sparse because Withings OAuth is incomplete (backlog item). Once OAuth is authorised, historical data can be bulk-imported.

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
