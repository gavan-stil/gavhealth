# gavhealth Backend

Personal health tracking API. FastAPI + PostgreSQL + Claude Haiku for food/strength parsing.

---

## Prerequisites

- Python 3.11+
- PostgreSQL 16
- [Poetry](https://python-poetry.org/docs/#installation)

---

## Quick Start

```bash
cd backend

# Install dependencies
poetry install

# Copy env template and fill in values
cp .env.example .env
# Edit .env — see Environment Variables below

# Create the database
createdb gavhealth

# Run migrations
poetry run alembic upgrade head

# Start dev server
poetry run uvicorn app.main:app --reload --port 8000
```

API is at `http://localhost:8000`. Health check: `GET /api/health`.

---

## Environment Variables

Create a `.env` file in `backend/`:

```env
# Required
DATABASE_URL=postgresql+asyncpg://localhost:5432/gavhealth
API_KEY=your-secret-key-here
ANTHROPIC_API_KEY=sk-ant-...

# Optional — Withings OAuth (future sync)
WITHINGS_CLIENT_ID=
WITHINGS_CLIENT_SECRET=
WITHINGS_ACCESS_TOKEN=
WITHINGS_REFRESH_TOKEN=

# Optional — defaults shown
FRONTEND_URL=http://localhost:3000
CORS_ALLOW_ORIGINS=["*"]
ENVIRONMENT=development
RATE_LIMIT_PER_MINUTE=60
```

`ANTHROPIC_API_KEY` is only required if you use the food or strength parse endpoints (`/api/log/food`, `/api/log/strength`).

---

## Database

### Initial setup

```bash
createdb gavhealth
poetry run alembic upgrade head
```

### After model changes

```bash
poetry run alembic revision --autogenerate -m "description of change"
poetry run alembic upgrade head
```

Note: `main.py` runs `create_all` on startup which handles new tables in dev, but column changes on existing tables need Alembic.

### Seed data (optional)

```bash
psql gavhealth < seed.sql
```

---

## Authentication

Single API key. Every request needs:

```
X-API-Key: your-secret-key-here
```

Unauthenticated: `GET /api/health` only.

---

## API Endpoints

### Reads (`data.py`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/weight` | Paginated weight logs (date-filtered) |
| GET | `/api/sleep` | Paginated sleep logs (date-filtered) |
| GET | `/api/activity` | Paginated activity logs (date-filtered) |
| GET | `/api/rhr` | Paginated RHR logs (date-filtered) |
| GET | `/api/dexa` | DEXA scans |
| POST | `/api/dexa` | Create DEXA scan |
| GET | `/api/streaks` | Breathing/devotions/sauna/training streaks |
| GET | `/api/settings` | User settings |
| PATCH | `/api/settings` | Update user settings (partial) |

### Aggregates (`summary.py`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/summary/daily` | Daily summary for a date |
| GET | `/api/readiness` | Readiness score + components + recommendation |

### Writes (`logging.py`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/log/food` | Parse food text via Claude → returns macros |
| POST | `/api/log/food/confirm` | Save confirmed macros |
| POST | `/api/log/strength` | Parse workout text via Claude → returns sets |
| POST | `/api/log/strength/confirm` | Save confirmed session + sets |
| POST | `/api/log/sauna` | Log sauna session |
| POST | `/api/log/habits` | Upsert daily habits |
| POST | `/api/log/weight` | Log weight |
| POST | `/api/log/sleep` | Log sleep |
| POST | `/api/log/activity` | Log activity |
| POST | `/api/log/rhr` | Log resting heart rate |

### Diagnostics

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | No | Health check |
| GET | `/api/test` | Yes | Sample row + count from every table |

---

## Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app, lifespan, router registration
│   ├── config.py            # Settings via pydantic-settings
│   ├── auth.py              # API key verification
│   ├── database.py          # Async SQLAlchemy engine + session
│   ├── models/
│   │   ├── base.py          # DeclarativeBase
│   │   └── health.py        # 14 ORM models (authoritative schema)
│   ├── schemas/
│   │   ├── health.py        # Pydantic request/response models
│   │   └── common.py        # PaginatedResponse, DateRangeParams
│   ├── routers/
│   │   ├── test.py          # /api/test
│   │   ├── data.py          # Read endpoints
│   │   ├── summary.py       # Aggregates + readiness
│   │   └── logging.py       # Write endpoints
│   └── services/
│       ├── claude_service.py # Claude Haiku food/strength parsing
│       └── readiness.py     # Deterministic readiness score
├── migrations/              # Alembic migrations
├── alembic.ini
├── pyproject.toml
├── WIRING_GUIDE.md          # How every component connects
└── .env                     # Local config (not committed)
```

---

## Testing

```bash
poetry run pytest
```

---

## Deployment (Railway)

1. Connect repo to Railway
2. Set all required env vars in Railway dashboard
3. Build command: `poetry install --no-dev`
4. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add PostgreSQL plugin, copy `DATABASE_URL` (swap `postgresql://` prefix with `postgresql+asyncpg://`)
6. Set `CORS_ALLOW_ORIGINS` to your frontend domain
7. Set `ENVIRONMENT=production`

---

## Further Reading

- [WIRING_GUIDE.md](./WIRING_GUIDE.md) — detailed architecture and component wiring
