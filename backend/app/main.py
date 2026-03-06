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
