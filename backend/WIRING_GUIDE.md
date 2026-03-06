# gavhealth Backend — Wiring Guide

How every component connects. Read this before touching the codebase.

---

## Architecture at a Glance

```
Client (HTML / future React)
  │  X-API-Key header on every request
  ▼
FastAPI app  (app/main.py)
  ├── CORS middleware
  ├── verify_api_key dependency
  ├── 4 routers ──┐
  │               ├── test_router    /api/test
  │               ├── summary_router /api/summary/*
  │               ├── data_router    /api/*  (reads)
  │               └── logging_router /api/log/*  (writes)
  ▼
Services layer
  ├── claude_service.py   → Anthropic API (food + strength parsing)
  └── readiness.py        → deterministic readiness score
  ▼
SQLAlchemy 2.0 async  (app/database.py)
  ▼
PostgreSQL 16 via asyncpg
```

---

## Entry Point — `app/main.py`

The `lifespan` context manager runs `Base.metadata.create_all` on startup (sync, via `engine.begin()`). This auto-creates any missing tables but does NOT run Alembic migrations — use Alembic for schema changes in production.

Routers are registered in this order:

```python
app.include_router(test_router)
app.include_router(summary_router)
app.include_router(data_router)
app.include_router(logging_router)
```

CORS is wide open in dev (`allow_origins=["*"]`). Tighten via `CORS_ALLOW_ORIGINS` env var for production.

Health check: `GET /api/health` → `{"status": "ok"}` (no auth required).

---

## Configuration — `app/config.py`

Single `Settings` class via pydantic-settings. Reads from `.env` file automatically.

| Env var | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | asyncpg connection string (`postgresql+asyncpg://...`) |
| `API_KEY` | Yes | Single shared key for all requests |
| `ANTHROPIC_API_KEY` | Yes* | Claude Haiku for food/strength parsing |
| `WITHINGS_CLIENT_ID` | No | Withings OAuth (future sync) |
| `WITHINGS_CLIENT_SECRET` | No | Withings OAuth |
| `WITHINGS_ACCESS_TOKEN` | No | Withings OAuth |
| `WITHINGS_REFRESH_TOKEN` | No | Withings OAuth |
| `FRONTEND_URL` | No | Default `http://localhost:3000` |
| `CORS_ALLOW_ORIGINS` | No | Default `["*"]` |
| `ENVIRONMENT` | No | Default `development` |
| `RATE_LIMIT_PER_MINUTE` | No | Default `60` |

*Required only if using `/api/log/food` or `/api/log/strength` parse endpoints.

Singleton instance: `from app.config import settings`.

---

## Authentication — `app/auth.py`

Single-user app. One API key, checked via FastAPI dependency:

```python
async def verify_api_key(x_api_key: str = Header(...))
```

Every protected endpoint includes `_key: str = Depends(verify_api_key)`. Returns 401 if header missing or wrong.

---

## Database Layer — `app/database.py`

Async engine with `asyncpg`, pool_size=5, max_overflow=10.

`get_db()` is an async generator dependency:
- Yields an `AsyncSession`
- Commits on success
- Rolls back on exception

All routers use `db: AsyncSession = Depends(get_db)`.

---

## Models — `app/models/health.py`

14 SQLAlchemy ORM models. This file is the **authoritative schema** (not `schema.sql`, which is older).

### Core domain models

| Model | Table | Key constraints |
|---|---|---|
| `WeightLog` | `weight_logs` | Unique on `(recorded_at, source)` |
| `SleepLog` | `sleep_logs` | Unique on `(sleep_date, source)` |
| `ActivityLog` | `activity_logs` | Unique on `(external_id, source)` |
| `RhrLog` | `rhr_logs` | Unique on `(log_date, source)` |
| `SaunaLog` | `sauna_logs` | `withings_activity_id` (nullable), `source` enum: manual/withings/manual_reconciled |
| `DailyHabit` | `daily_habits` | Unique on `habit_date` |
| `FoodLog` | `food_logs` | `meal_label` check constraint, `confidence` check constraint |
| `Exercise` | `exercises` | `category` check constraint |
| `StrengthSession` | `strength_sessions` | Cascade delete → `StrengthSet` |
| `StrengthSet` | `strength_sets` | FK to `session_id` + `exercise_id`, RPE 1-10 |
| `DexaScan` | `dexa_scans` | Unique on `scan_date` |

### Infrastructure models

| Model | Table | Purpose |
|---|---|---|
| `SyncLog` | `sync_logs` | Track sync job runs |
| `SyncEvent` | `sync_events` | Individual sync actions |
| `SyncState` | `sync_state` | Cursor/token storage per source |
| `DailySummary` | `daily_summary` | Aggregated daily rollup |
| `UserSettings` | `user_settings` | Single-row config (id=1) |

### Sauna tracking specifics

`SaunaLog` has these sauna-specific fields (already applied):
- `session_type` — defaults to `"traditional"`
- `did_breathing` — bool
- `did_devotions` — bool
- `withings_activity_id` — nullable int, for linking to Withings Scanwatch data
- `source` — `manual` | `withings` | `manual_reconciled`

Reconciliation logic: manual sessions created within 10 min of a Withings workout get merged. Withings data (duration, HR) overrides manual values; manual toggles (devotions, breathing) preserved. Source becomes `manual_reconciled`.

---

## Schemas — `app/schemas/`

Pydantic v2 models. Two files:

### `health.py` — Domain schemas

Every model has a `*Create` (input) and `*Response` (output) pair. All response schemas use `model_config = {"from_attributes": True}` for ORM mode.

Special flows:
- **Food**: `FoodParseRequest` → `FoodParseResponse` (Claude output) → `FoodConfirmRequest` → `FoodResponse` (saved)
- **Strength**: `StrengthParseRequest` → `StrengthParseResponse` (Claude output, contains `StrengthSetParsed` list) → `StrengthConfirmRequest` → `StrengthSessionResponse`

### `common.py` — Shared schemas

- `PaginatedResponse[T]` — generic wrapper with `data`, `total`, `limit`, `offset`
- `DateRangeParams` — `start_date`, `end_date` query params
- `ErrorResponse` — `detail` string

---

## Routers — `app/routers/`

### `test.py` — `GET /api/test`

Returns one sample row + row count from 11 tables. For full-stack smoke testing. Auth required.

### `data.py` — Read endpoints

All auth-protected. Paginated where noted.

| Endpoint | Method | Returns |
|---|---|---|
| `/api/weight` | GET | Paginated weight logs, date-filtered |
| `/api/sleep` | GET | Paginated sleep logs, date-filtered |
| `/api/activity` | GET | Paginated activity logs, date-filtered |
| `/api/rhr` | GET | Paginated RHR logs, date-filtered |
| `/api/dexa` | GET | List of DEXA scans |
| `/api/dexa` | POST | Create DEXA scan |
| `/api/streaks` | GET | Breathing/devotions/sauna/training streaks (scans last 365 days) |
| `/api/settings` | GET | User settings (single row) |
| `/api/settings` | PATCH | Update user settings (partial) |

### `summary.py` — Aggregate endpoints

| Endpoint | Method | Returns |
|---|---|---|
| `/api/summary/daily` | GET | Daily summary for a date (sleep, weight, activity, nutrition rollup) |
| `/api/readiness` | GET | Readiness score + component breakdown + recommendation |

### `logging.py` — Write endpoints

| Endpoint | Method | Flow |
|---|---|---|
| `/api/log/food` | POST | Step 1: Send text to Claude → get parsed macros |
| `/api/log/food/confirm` | POST | Step 2: Save confirmed macros to DB |
| `/api/log/strength` | POST | Step 1: Send workout text to Claude → get structured sets |
| `/api/log/strength/confirm` | POST | Step 2: Save confirmed session + sets to DB |
| `/api/log/sauna` | POST | Direct save |
| `/api/log/habits` | POST | Upsert by `habit_date` |
| `/api/log/weight` | POST | Direct save |
| `/api/log/sleep` | POST | Direct save |
| `/api/log/activity` | POST | Direct save |
| `/api/log/rhr` | POST | Direct save |

---

## Services — `app/services/`

### `claude_service.py` — Claude Haiku integration

Lazy singleton `AsyncAnthropic` client. Two parse functions:

**`parse_food(description, meal_label, log_date)`**
- Model: `claude-haiku-4-5-20251001`
- System prompt enforces Australian serving sizes, JSON output
- Returns: `{description_raw, meal_label, log_date, protein_g, carbs_g, fat_g, calories_kcal, confidence, items}`
- Called by `POST /api/log/food`

**`parse_strength(description, session_label, session_datetime)`**
- Model: `claude-haiku-4-5-20251001`
- System prompt normalises exercise names, converts lbs→kg, outputs structured sets
- Returns: `{session_label, session_datetime, sets: [{exercise_name, set_number, reps, weight_kg, is_bodyweight, rpe}]}`
- Called by `POST /api/log/strength`

**`get_readiness(db, target_date)`**
- Delegates to `readiness.compute_readiness()`

### `readiness.py` — Readiness score

Deterministic formula, no ML:

```
base = 70
sleep_delta   = (actual_sleep - 7.6) × 8
deep_delta    = (deep_pct - 0.43) × 20
rhr_delta     = (rhr_7day_avg - rhr_today) × 3
load_penalty  = min(0, (1.3 - acwr) × 20)
rest_penalty  = max(0, (consecutive_days - 4)) × 5

score = clamp(base + sleep_delta + deep_delta + rhr_delta + load_penalty - rest_penalty, 0, 100)
```

Returns score, component breakdown dict, and a recommendation string.

---

## Migrations — Alembic

Config in `alembic.ini`, migrations in `migrations/`. The `sqlalchemy.url` in `alembic.ini` is a placeholder — `migrations/env.py` overrides it with `settings.database_url` at runtime.

Generate a new migration after model changes:

```bash
cd backend
alembic revision --autogenerate -m "description"
alembic upgrade head
```

Note: `main.py` lifespan runs `create_all` on startup, which handles new tables in dev. But for column changes on existing tables, you need Alembic.

---

## Request Flow Examples

### Logging a meal (two-step)

```
POST /api/log/food  {description: "2 eggs on toast with avocado", meal_label: "breakfast"}
  → verify_api_key
  → parse_food() → Claude Haiku → returns {protein_g: 28, carbs_g: 35, ...}
  → 200 FoodParseResponse

POST /api/log/food/confirm  {log_date: "2026-02-28", protein_g: 28, ...}
  → verify_api_key
  → get_db session
  → create FoodLog row
  → commit
  → 201 FoodResponse
```

### Reading weight data

```
GET /api/weight?start_date=2026-02-01&end_date=2026-02-28&limit=50
  → verify_api_key
  → get_db session
  → SELECT from weight_logs WHERE recorded_at BETWEEN ... ORDER BY recorded_at DESC
  → 200 PaginatedResponse[WeightResponse]
```

### Getting readiness

```
GET /api/readiness?date=2026-02-28
  → verify_api_key
  → get_db session
  → compute_readiness(db, date)
    → queries sleep_logs, rhr_logs, activity_logs
    → applies formula
  → 200 ReadinessResponse {score: 74, components: {...}, recommendation: "..."}
```
