"""GavHealth API — FastAPI application entrypoint."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine
from app.models.base import Base
from app.routers import data, export, logging, new_endpoints, summary, test, withings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables on startup (dev convenience — migrations are authoritative)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Patch sync_state table — create_all won't add columns to existing tables.
        # These are idempotent (IF NOT EXISTS).
        from sqlalchemy import text
        for stmt in [
            "ALTER TABLE sync_state ADD COLUMN IF NOT EXISTS access_token TEXT",
            "ALTER TABLE sync_state ADD COLUMN IF NOT EXISTS refresh_token TEXT",
            "ALTER TABLE sync_state ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ",
            "ALTER TABLE sync_state ADD COLUMN IF NOT EXISTS token_status VARCHAR(20)",
            "ALTER TABLE strength_sessions ADD COLUMN IF NOT EXISTS activity_log_id INTEGER",
            # activity_logs: add effort tracking columns
            "ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS effort VARCHAR(20)",
            "ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS effort_manually_set BOOLEAN DEFAULT false",
            # saved_meals: food library.
            # The table may have been created via Railway GUI without id/name columns.
            # Drop and recreate if the 'name' column is missing (table is empty so safe).
            """
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'saved_meals'
                ) AND NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'saved_meals'
                      AND column_name = 'name'
                ) THEN
                    DROP TABLE saved_meals;
                END IF;
            END $$
            """,
            """
            CREATE TABLE IF NOT EXISTS saved_meals (
                id            SERIAL PRIMARY KEY,
                name          TEXT NOT NULL,
                calories_kcal INTEGER NOT NULL,
                protein_g     NUMERIC(6,1) NOT NULL DEFAULT 0,
                carbs_g       NUMERIC(6,1) NOT NULL DEFAULT 0,
                fat_g         NUMERIC(6,1) NOT NULL DEFAULT 0,
                created_at    TIMESTAMPTZ DEFAULT NOW()
            )
            """,
            # manual_strength_logs: backfill log_date column if missing
            "ALTER TABLE manual_strength_logs ADD COLUMN IF NOT EXISTS log_date DATE DEFAULT CURRENT_DATE",
            # manual_strength_logs: strength workouts logged via app
            """
            CREATE TABLE IF NOT EXISTS manual_strength_logs (
                id                  SERIAL PRIMARY KEY,
                workout_split       TEXT NOT NULL,
                exercises           JSONB NOT NULL DEFAULT '[]',
                start_time          TIMESTAMPTZ,
                duration_minutes    INTEGER,
                notes               TEXT,
                log_date            DATE DEFAULT CURRENT_DATE,
                matched_activity_id INTEGER,
                match_confirmed     BOOLEAN DEFAULT false,
                created_at          TIMESTAMPTZ DEFAULT NOW()
            )
            """,
        ]:
            await conn.execute(text(stmt))
    yield
    await engine.dispose()


app = FastAPI(
    title="GavHealth API",
    version="0.1.0",
    description="Personal health tracking backend — single-user, API-key auth.",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS — wide open for dev (file:// and local server testing)
# ---------------------------------------------------------------------------
_origins = [o.strip() for o in settings.cors_allow_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(test.router)
app.include_router(summary.router)
app.include_router(data.router)
app.include_router(logging.router)
app.include_router(withings.router)
app.include_router(export.router)
app.include_router(new_endpoints.router)


# ---------------------------------------------------------------------------
# Health check (no auth required)
# ---------------------------------------------------------------------------
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "environment": settings.environment}
