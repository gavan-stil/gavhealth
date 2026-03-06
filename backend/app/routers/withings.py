"""Withings OAuth2 and sync endpoints."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import verify_api_key
from app.config import settings
from app.database import get_db
from app.services.withings_service import (
    cleanup_anomalous_rhr,
    exchange_code,
    get_auth_url,
    run_full_sync,
    store_tokens,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/withings", tags=["withings"])

CALLBACK_PATH = "/api/withings/callback"


def _callback_url(request: Request) -> str:
    """Build the full callback URL from the incoming request."""
    # Use X-Forwarded headers if behind a proxy (Railway), else request.base_url
    scheme = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get("x-forwarded-host", request.url.netloc)
    return f"{scheme}://{host}{CALLBACK_PATH}"


# ---------------------------------------------------------------------------
# OAuth2 flow — no API key required (browser redirects)
# ---------------------------------------------------------------------------

@router.get("/auth")
async def withings_auth(request: Request):
    """Redirect user to Withings OAuth2 consent page."""
    if not settings.withings_client_id:
        raise HTTPException(status_code=500, detail="WITHINGS_CLIENT_ID not configured")

    callback = _callback_url(request)
    auth_url = get_auth_url(callback)
    logger.info("Redirecting to Withings OAuth — callback=%s", callback)
    return RedirectResponse(url=auth_url)


@router.get("/callback")
async def withings_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    request: Request = None,
    db: AsyncSession = Depends(get_db),
):
    """Handle Withings OAuth2 callback — exchange code for tokens."""
    if error:
        raise HTTPException(status_code=400, detail=f"Withings auth error: {error}")

    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code")

    callback = _callback_url(request)

    try:
        tokens = await exchange_code(code, callback)
        await store_tokens(db, tokens)
        await db.commit()
        logger.info("Withings OAuth complete — tokens stored (userid=%s)", tokens.get("userid"))
        return {
            "status": "connected",
            "message": "Withings account linked successfully.",
            "userid": tokens.get("userid"),
        }
    except Exception as e:
        logger.error("Withings OAuth callback failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Sync — API key required
# ---------------------------------------------------------------------------

@router.post("/sync", dependencies=[Depends(verify_api_key)])
async def withings_sync(db: AsyncSession = Depends(get_db)):
    """Pull latest data from Withings API into the database."""
    try:
        result = await run_full_sync(db)
        await db.commit()
        return result
    except Exception as e:
        logger.error("Withings sync failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cleanup-rhr", dependencies=[Depends(verify_api_key)])
async def withings_cleanup_rhr(db: AsyncSession = Depends(get_db)):
    """One-time cleanup: move anomalous RHR rows (≥115 bpm) to sauna_logs."""
    try:
        result = await cleanup_anomalous_rhr(db)
        await db.commit()
        return {"status": "success", **result}
    except Exception as e:
        logger.error("RHR cleanup failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
