# Backend API Reference

> All endpoints on the existing FastAPI backend. Frontend consumes these — backend is NOT being rebuilt.

---

## Base

| Item | Value |
|------|-------|
| Base URL | `https://gavhealth-production.up.railway.app` |
| Auth header | `X-API-Key: <your-api-key>` |
| Host | Railway (FastAPI + PostgreSQL 16) |

> **Paths verified 2026-03-06** via curl against production. The `/api/data/...` prefix paths from FEATURES.md all return 404 — correct paths are without the `/data/` prefix (e.g. `/api/weight`, not `/api/data/weight`).

---

## Health & Debug

| Endpoint | Method | Auth | Returns |
|----------|--------|------|---------|
| `/api/health` | GET | No | `{ status: "ok", environment: "production" }` |
| `/api/test` | GET | Yes | Table row counts for all 12 tables |

---

## Data Retrieval (GET)

All require `X-API-Key` header. All support `?days=N` unless noted.

| Endpoint | Returns | Seeded Rows |
|----------|---------|-------------|
| `/api/weight` | Weight entries. Fields: `id, recorded_at, weight_kg, fat_mass_kg, muscle_mass_kg, bone_mass_kg, hydration_kg, bmi, fat_ratio_pct, fat_free_mass_kg, source`. Body comp fields populated from API-sourced rows after T23. | ~404 |
| `/api/sleep` | Sleep entries. Fields: `id, sleep_date, bed_time, wake_time, total_sleep_hrs, deep_sleep_hrs, light_sleep_hrs, rem_sleep_hrs, awake_hrs, sleep_hr_avg, sleep_hr_min, sleep_hr_max, sleep_score, sleep_efficiency_pct, spo2_avg, respiratory_rate, source`. Returns `DISTINCT ON (sleep_date)` preferring `withings` source. | ~822 |
| `/api/activity` | Activities (runs, rides, strength). Fields include: `id, activity_date, activity_type, started_at, duration_mins, distance_km, avg_pace_secs, avg_hr, min_hr, max_hr, calories_burned, elevation_m, steps, spo2_avg, pause_duration_mins, pool_laps, strokes, soft_mins, moderate_mins, intense_mins, source, external_id, notes, workout_split`. Also `?type=` filter | ~1378 |
| `/api/rhr` | Resting heart rate (date, rhr_bpm). Populated from meastype-11 spot checks AND derived from `sleep_hr_min` after T23 (gaps filled). Source preference: `withings` > `withings_csv`. | ~1845 |
| `/api/activities/feed` | Activity feed for log page. Returns `[{ id, type, date, start_time (ISO+TZ or null), duration_minutes, avg_bpm, min_hr, max_hr, distance_km, avg_pace_secs, effort, effort_manually_set }]`. Supports `?days=N`. **Curl-verified 2026-03-14** — all fields confirmed present. `start_time` IS returned when available. | — |
| `/api/food` | Food logs for date. Use `?date=YYYY-MM-DD` | 0 (empty until logged) |
| `/api/food/weekly` | Weekly macro aggregates | varies |
| `/api/strength/:exercise_id` | History for one exercise | 0 |
| `/api/strength/prs` | Personal records per exercise | 0 |
| `/api/strength/sessions?days=N` | Per-session aggregates: id, **date** (non-null after T15-2b fix), session_date, activity_log_id, duration_mins, avg_hr, calories, total_sets, total_reps, total_load_kg, avg_load_per_set_kg, exercises[], **category** (push/pull/legs/abs/mixed) | — |
| `/api/energy-balance?days=N` | Daily energy balance (T15-1b, added 2026-03-10). Array of `{ date, calories_in, protein_g, calories_burned_total (Withings TDEE or null), weight_kg (or null) }`. Only returns days with food logs. | 30 |
| `PATCH /api/strength/sessions/:id/unlink` | Sets `activity_log_id = NULL` on strength session. Returns `{ ok: true, id }`. | — |
| `/api/strength/exercise/:id/history?days=N` | Per-exercise session history (chronological): `[{ session_date, sets: int, total_reps, top_weight_kg, session_volume_kg, estimated_1rm }]`. `sets` is a count integer. BW exercises have `top_weight_kg: 0`. **`session_volume_kg` includes `bodyweight_at_session` (fixed T18)** — formula: `reps × (bodyweight_at_session + weight_kg)`. Use last element for "previous session". | — |
| `GET /api/strength/sessions/last-by-split/:split` | **NEW (T18)** Most recent saved session for a split (push/pull/legs/abs). Returns `{ session_date, total_reps, total_volume_kg }` using BW-inclusive formula. Used by StrengthCard session-level comparison header. Returns `null` if no prior session. | — |
| `/api/sauna` | Sauna sessions | ~65 |
| `/api/dexa` | DEXA scan results | 1 |

---

## Summaries & Intelligence (GET)

| Endpoint | Returns |
|----------|---------|
| `/api/summary/daily` | Today's summary: weight, sleep, RHR, activity, food totals |
| `/api/summary/weekly` | 7-day rollup: avg weight, sleep, total km, strength sessions, readiness |
| `/api/readiness` | `{ score: 0-100, breakdown: {...}, narrative: "..." }`. Claude Haiku 4.5 generates narrative; deterministic fallback if API key absent |
| `/api/streaks` | `{ running_streak, strength_streak, sauna_streak, habits_streak }` |
| `/api/exercises` | Exercise lookup table (names + IDs) |

---

## Momentum & Goals (T22)

All require `X-API-Key` header.

| Endpoint | Method | Returns |
|----------|--------|---------|
| `/api/momentum` | GET | `{ overall_trend, signals_on_track, signals_total, signals: [{ signal, label, unit, group, target_min, target_max, baseline_28d, today, avg_7d, trend_7d, gap_pct, status }] }`. Signals: sleep_hrs, rhr_bpm, weight_kg, calories_in, protein_g, water_ml. Status: "on_track" \| "improving" \| "off_track". Optional `?target_date=YYYY-MM-DD`. |
| `/api/momentum/signals` | GET | `{ baselines: {signal→float}, targets: {signal→{min,max}}, days: [{date, sleep_hrs, rhr_bpm, weight_kg, calories_in, protein_g, water_ml}] }`. Optional `?days=N` (default 7). |
| `/api/goals` | GET | Latest active goal per signal (all 6 signals always returned, using defaults if no DB row). `[{ id, signal, label, unit, group, target_min, target_max, set_at, notes }]` |
| `/api/goals` | POST | Body: `{ signal, target_min?, target_max?, notes? }`. Inserts new row (old targets preserved). Returns new `GoalResponse`. |
| `/api/goals/{signal}/history` | GET | All goal rows for signal, newest-first. `[{ id, target_min, target_max, set_at, notes }]` |

---

## Logging (POST)

All require `X-API-Key` header.

### Food (2-step NLP)

| Step | Endpoint | Body | Returns |
|------|----------|------|---------|
| Parse | `POST /api/log/food` | `{ "description": "2 eggs scrambled with cheese" }` | `{ parsed: { protein, carbs, fat, calories, food_items[] } }` |
| Confirm | `POST /api/log/food/confirm` | Confirmed macro data | Row written to `food_logs` |

### Strength GET endpoints

| Endpoint | Returns |
|----------|---------|
| `GET /api/log/strength/last/{split}` | `{ date: "YYYY-MM-DD", exercises: WorkoutExercise[] }` — most recent session for split. exercises JSONB shape: `[{ name, sets: [{ kg, reps, completed?, load_type }], superset }]`. load_type: "bw" (bodyweight — skip in volume), "bw+" (bw + extra kg), "kg" (loaded). |
| `GET /api/log/strength/recent/{split}?limit=5` | `RecentSession[]` — up to `limit` (max 10) sessions, sorted: PBs first → most_loaded → chrono desc. Response: `{ id, date, start_time, exercise_count, total_sets, avg_reps_per_set, total_volume_kg, is_pb, most_loaded, exercises: RecentSessionExercise[], raw_exercises: WorkoutExercise[] }`. `raw_exercises` = original JSONB for `onLoad`. Volume skips "bw" sets. 400 if split invalid. |

### Strength (2-step NLP)

| Step | Endpoint | Body | Returns |
|------|----------|------|---------|
| Parse | `POST /api/log/strength` | `{ "description": "squat 100kg 3x5" }` | `{ parsed: { exercises: [{ exercise_name, sets: [{ reps, weight_kg }] }] } }` |
| Confirm | `POST /api/log/strength/confirm` | Confirmed sets data | Rows to `strength_sessions` + `strength_sets`, PRs auto-updated |

### Direct Logging

| Endpoint | Body | Notes |
|----------|------|-------|
| `POST /api/log/sauna` | `{ date, duration_min, temp_celsius, notes }` | |
| `POST /api/log/habits` | `{ date, breathing: bool, devotions: bool }` | |
| `POST /api/log/strength/save` | Builder format — will accept optional `activity_id` after Task 7 to skip auto-match and link directly | Currently: creates `strength_sessions` row; does NOT create `activity_log` when unmatched (bug — Task 7 fixes) |

### Edit Endpoints (PATCH)

| Endpoint | Body fields | Notes |
|----------|-------------|-------|
| `PATCH /api/activity-logs/{id}` | `started_at` (ISO+TZ), `activity_date` (YYYY-MM-DD), `duration_mins`, `avg_hr`, `min_hr`, `max_hr`, `distance_km`, `avg_pace_secs`, `calories_burned`, `workout_split` | Dynamic SET — only provided fields updated. `workout_split` accepts "push"/"pull"/"legs". `started_at` requires ISO string with timezone offset (e.g. `2026-03-14T07:30:00+10:00`). |
| `PATCH /api/sleep/{id}` | `total_sleep_hrs`, `deep_sleep_hrs`, `light_sleep_hrs`, `sleep_hr_avg`, `sleep_score` | Dynamic SET. |
| `PATCH /api/sauna/{id}` | `duration_mins`, `temperature_c`, `did_breathing`, `did_devotions` | Dynamic SET. |

### Delete Endpoints

| Endpoint | Notes |
|----------|-------|
| `DELETE /api/activity-logs/{id}` | Deletes a workout activity record from `activity_logs`. Returns `{ ok: true }`. Used by "Delete workout" button in DayDetailSheet and ActivityFeed. |
| `DELETE /api/strength/sessions/{id}` | Deletes a strength session and its related `manual_strength_logs` (via bridged_session_id). Returns `{ ok: true }`. |

### Habits History (planned — Task 8)

| Endpoint | Method | Body | Notes |
|----------|--------|------|-------|
| `GET /api/habits` | GET | `?days=N` | **Does not exist yet.** To be added. Returns `[{ habit_date, did_breathing, did_devotions }]` sorted desc |

---

## Withings Sync

| Endpoint | Method | Status |
|----------|--------|--------|
| `/api/withings/callback` | GET | Built — needs OAuth flow completion (Gav action) |
| `/api/withings/sync` | POST | Built — needs valid tokens |

---

## Export

| Endpoint | Method | Returns |
|----------|--------|---------|
| `/api/export/csv` | GET | 35-column daily flattened CSV (~202KB) |

---

## Database Tables (12)

`weight_logs`, `sleep_logs`, `activity_logs`, `rhr_logs`, `food_logs`, `sauna_logs`, `dexa_scans`, `daily_habits`, `strength_sessions`, `strength_sets`, `exercises`, `sync_log`, `hr_intraday`, `water_logs`, `mood_logs`, `saved_meals`, `health_goals`

Total seeded: ~4,189 rows + health_goals seed (6 rows on first deploy).
