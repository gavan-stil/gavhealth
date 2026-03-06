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
| `/api/weight` | Weight entries (date, weight_kg) | ~404 |
| `/api/sleep` | Sleep entries (date, duration_hrs, deep_pct, sleep_hr) | ~822 |
| `/api/activity` | Activities (runs, rides, strength). Also `?type=` filter | ~1378 |
| `/api/rhr` | Resting heart rate (date, rhr_bpm) | ~1845 |
| `/api/activities/feed` | Activity feed for log page. Returns `[{ id, type, date, duration_minutes, avg_bpm, effort, effort_manually_set }]`. **`start_time` NOT returned** — `activity_logs` table has no start_time from Withings sync. Frontend accepts it optionally and will display when available. Backend migration + sync update required to add it. | — |
| `/api/food` | Food logs for date. Use `?date=YYYY-MM-DD` | 0 (empty until logged) |
| `/api/food/weekly` | Weekly macro aggregates | varies |
| `/api/strength/:exercise_id` | History for one exercise | 0 |
| `/api/strength/prs` | Personal records per exercise | 0 |
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

## Logging (POST)

All require `X-API-Key` header.

### Food (2-step NLP)

| Step | Endpoint | Body | Returns |
|------|----------|------|---------|
| Parse | `POST /api/log/food` | `{ "description": "2 eggs scrambled with cheese" }` | `{ parsed: { protein, carbs, fat, calories, food_items[] } }` |
| Confirm | `POST /api/log/food/confirm` | Confirmed macro data | Row written to `food_logs` |

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

`weight_logs`, `sleep_logs`, `activity_logs`, `rhr_logs`, `food_logs`, `sauna_logs`, `dexa_scans`, `daily_habits`, `strength_sessions`, `strength_sets`, `exercises`, `sync_log`

Total seeded: ~4,189 rows.
