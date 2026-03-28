"""GavHealth API — FastAPI application entrypoint."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine
from app.models.base import Base
from app.routers import data, export, logging, momentum, new_endpoints, summary, test, withings


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
            # T12: bridge manual strength logs to normalised tables
            "ALTER TABLE manual_strength_logs ADD COLUMN IF NOT EXISTS bridged_session_id INTEGER",
            # Drop old category check constraint so new body-part categories work
            "ALTER TABLE exercises DROP CONSTRAINT IF EXISTS ck_exercise_category",
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
            # activity_logs: start timestamp + min HR from Withings
            "ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ",
            "ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS min_hr INTEGER",
            # T16: HR zone seconds (integers) from Withings workoutv2
            "ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS hr_zone_0 INTEGER",
            "ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS hr_zone_1 INTEGER",
            "ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS hr_zone_2 INTEGER",
            "ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS hr_zone_3 INTEGER",
            # sleep_logs: sleep stage breakdown (JSONB)
            "ALTER TABLE sleep_logs ADD COLUMN IF NOT EXISTS stages JSONB",
            # activity_logs: steps from Withings daily summary
            "ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS steps INTEGER",
            # hr_intraday: steps count per hour bucket
            "ALTER TABLE hr_intraday ADD COLUMN IF NOT EXISTS steps_count INTEGER",
            # manual_strength_logs: backfill log_date column if missing
            "ALTER TABLE manual_strength_logs ADD COLUMN IF NOT EXISTS log_date DATE DEFAULT CURRENT_DATE",
            # T14-2: Fix exercise categories for names with explicit ' - Body part' suffix.
            # SPLIT_PART extracts everything after the first ' - ' and maps to category.
            # Idempotent — only touches rows whose name contains ' - '.
            """
            UPDATE exercises
            SET category =
              CASE
                WHEN LOWER(SPLIT_PART(name, ' - ', 2)) LIKE '%back%'
                  OR LOWER(SPLIT_PART(name, ' - ', 2)) LIKE '%lats%'
                  OR LOWER(SPLIT_PART(name, ' - ', 2)) LIKE '%traps%' THEN 'back'
                WHEN LOWER(SPLIT_PART(name, ' - ', 2)) LIKE '%chest%'
                  OR LOWER(SPLIT_PART(name, ' - ', 2)) LIKE '%pec%' THEN 'chest'
                WHEN LOWER(SPLIT_PART(name, ' - ', 2)) LIKE '%shoulder%' THEN 'shoulders'
                WHEN LOWER(SPLIT_PART(name, ' - ', 2)) LIKE '%leg%'
                  OR LOWER(SPLIT_PART(name, ' - ', 2)) LIKE '%quad%'
                  OR LOWER(SPLIT_PART(name, ' - ', 2)) LIKE '%hamstring%'
                  OR LOWER(SPLIT_PART(name, ' - ', 2)) LIKE '%glute%'
                  OR LOWER(SPLIT_PART(name, ' - ', 2)) LIKE '%calf%' THEN 'legs'
                WHEN LOWER(SPLIT_PART(name, ' - ', 2)) LIKE '%arm%'
                  OR LOWER(SPLIT_PART(name, ' - ', 2)) LIKE '%bicep%'
                  OR LOWER(SPLIT_PART(name, ' - ', 2)) LIKE '%tricep%' THEN 'arms'
                WHEN LOWER(SPLIT_PART(name, ' - ', 2)) LIKE '%abs%'
                  OR LOWER(SPLIT_PART(name, ' - ', 2)) LIKE '%core%' THEN 'core'
                ELSE category
              END
            WHERE name LIKE '% - %'
              AND SPLIT_PART(name, ' - ', 2) != ''
            """,
            # Recipes table (label scan + recipe feature)
            """
            CREATE TABLE IF NOT EXISTS recipes (
                id              SERIAL PRIMARY KEY,
                name            TEXT NOT NULL,
                total_weight_g  NUMERIC(8,1),
                servings        NUMERIC(6,2) DEFAULT 1,
                calories_kcal   INTEGER NOT NULL,
                protein_g       NUMERIC(6,1) NOT NULL DEFAULT 0,
                carbs_g         NUMERIC(6,1) NOT NULL DEFAULT 0,
                fat_g           NUMERIC(6,1) NOT NULL DEFAULT 0,
                ingredients     JSONB NOT NULL DEFAULT '[]',
                created_at      TIMESTAMPTZ DEFAULT NOW(),
                updated_at      TIMESTAMPTZ DEFAULT NOW()
            )
            """,
            # T22: health goals table (append-only, signal + target range)
            """
            CREATE TABLE IF NOT EXISTS health_goals (
                id          SERIAL PRIMARY KEY,
                signal      VARCHAR(50) NOT NULL,
                target_min  NUMERIC(10,2),
                target_max  NUMERIC(10,2),
                set_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                notes       TEXT
            )
            """,
            # T22: seed initial targets if table is empty
            """
            INSERT INTO health_goals (signal, target_min, target_max, notes)
            SELECT * FROM (VALUES
                ('sleep_hrs',   7.0,    8.5,    'Initial goal'),
                ('rhr_bpm',     45.0,   50.0,   'Initial goal'),
                ('weight_kg',   82.0,   86.0,   'Initial goal'),
                ('calories_in', 2000.0, 2400.0, 'Initial goal'),
                ('protein_g',   160.0,  200.0,  'Initial goal'),
                ('water_ml',    2500.0, 3500.0, 'Initial goal')
            ) AS seeds(signal, target_min, target_max, notes)
            WHERE NOT EXISTS (SELECT 1 FROM health_goals LIMIT 1)
            """,
            # T23: body comp fields from Withings scale
            "ALTER TABLE weight_logs ADD COLUMN IF NOT EXISTS fat_ratio_pct FLOAT",
            "ALTER TABLE weight_logs ADD COLUMN IF NOT EXISTS fat_free_mass_kg FLOAT",
            # T23: sleep hr_max from Withings sleep summary
            "ALTER TABLE sleep_logs ADD COLUMN IF NOT EXISTS sleep_hr_max FLOAT",
            # T23: workout detail fields (spo2, pause, pool, strokes)
            "ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS spo2_avg FLOAT",
            "ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS pause_duration_mins FLOAT",
            "ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS pool_laps INTEGER",
            "ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS strokes INTEGER",
            # T23: daily summary intensity breakdown
            "ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS soft_mins FLOAT",
            "ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS moderate_mins FLOAT",
            "ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS intense_mins FLOAT",
            # Withings workout IDs exceed int32 on older history — must be BIGINT
            "ALTER TABLE sauna_logs ALTER COLUMN withings_activity_id TYPE BIGINT",
            # activity_logs: workout split label (push/pull/legs)
            "ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS workout_split VARCHAR(20)",
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
app.include_router(momentum.router)


# ---------------------------------------------------------------------------
# Health check (no auth required)
# ---------------------------------------------------------------------------
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "environment": settings.environment}
