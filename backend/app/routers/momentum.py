"""Momentum router — goals system and momentum signal endpoints."""

from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import verify_api_key
from app.database import get_db
from app.schemas.health import (
    GoalCreate,
    GoalHistoryResponse,
    GoalResponse,
    MomentumDayResponse,
    MomentumResponse,
    MomentumSignalResponse,
    MomentumSignalsResponse,
)
from app.services.momentum import SIGNAL_META, SIGNALS, compute_momentum, get_signal_history

router = APIRouter(prefix="/api", tags=["momentum"], dependencies=[Depends(verify_api_key)])


# ---------------------------------------------------------------------------
# GET /api/momentum
# ---------------------------------------------------------------------------
@router.get("/momentum", response_model=MomentumResponse)
async def get_momentum(
    target_date: date | None = Query(None, description="Override today's date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
):
    data = await compute_momentum(db, target_date=target_date)
    signals = [
        MomentumSignalResponse(
            signal=s["signal"],
            label=s["label"],
            unit=s["unit"],
            group=s["group"],
            target_min=s["target_min"],
            target_max=s["target_max"],
            baseline_28d=s["baseline_28d"],
            today=s["today"],
            avg_7d=s["avg_7d"],
            trend_7d=s["trend_7d"],
            gap_pct=s["gap_pct"],
            status=s["status"],
        )
        for s in data["signals"]
    ]
    return MomentumResponse(
        overall_trend=data["overall_trend"],
        signals_on_track=data["signals_on_track"],
        signals_total=data["signals_total"],
        signals=signals,
    )


# ---------------------------------------------------------------------------
# GET /api/momentum/signals
# ---------------------------------------------------------------------------
@router.get("/momentum/signals", response_model=MomentumSignalsResponse)
async def get_momentum_signals(
    days: int = Query(7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
):
    data = await get_signal_history(db, days=days)
    day_responses = [MomentumDayResponse(**d) for d in data["days"]]
    return MomentumSignalsResponse(
        baselines=data["baselines"],
        targets=data["targets"],
        days=day_responses,
    )


# ---------------------------------------------------------------------------
# GET /api/goals
# ---------------------------------------------------------------------------
@router.get("/goals", response_model=list[GoalResponse])
async def get_goals(db: AsyncSession = Depends(get_db)):
    rows = await db.execute(text("""
        SELECT DISTINCT ON (signal)
               id, signal, target_min, target_max, set_at, notes
        FROM health_goals
        ORDER BY signal, set_at DESC
    """))
    results = []
    seen = set()
    for r in rows:
        meta = SIGNAL_META.get(r.signal, {})
        results.append(GoalResponse(
            id=r.id,
            signal=r.signal,
            label=meta.get("label", r.signal),
            unit=meta.get("unit", ""),
            group=meta.get("group", ""),
            target_min=float(r.target_min) if r.target_min is not None else None,
            target_max=float(r.target_max) if r.target_max is not None else None,
            set_at=r.set_at,
            notes=r.notes,
        ))
        seen.add(r.signal)
    # Include any signals that have no goal row yet (use defaults)
    from app.services.momentum import SIGNAL_DEFAULTS
    for sig in SIGNALS:
        if sig not in seen:
            meta = SIGNAL_META[sig]
            defaults = SIGNAL_DEFAULTS[sig]
            results.append(GoalResponse(
                id=0,
                signal=sig,
                label=meta["label"],
                unit=meta["unit"],
                group=meta["group"],
                target_min=defaults["min"],
                target_max=defaults["max"],
                set_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
                notes="Default target",
            ))
    # Sort by canonical signal order
    order = {s: i for i, s in enumerate(SIGNALS)}
    results.sort(key=lambda r: order.get(r.signal, 99))
    return results


# ---------------------------------------------------------------------------
# POST /api/goals
# ---------------------------------------------------------------------------
@router.post("/goals", response_model=GoalResponse, status_code=201)
async def create_goal(payload: GoalCreate, db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    result = await db.execute(text("""
        INSERT INTO health_goals (signal, target_min, target_max, set_at, notes)
        VALUES (:signal, :target_min, :target_max, :set_at, :notes)
        RETURNING id, signal, target_min, target_max, set_at, notes
    """), {
        "signal": payload.signal,
        "target_min": payload.target_min,
        "target_max": payload.target_max,
        "set_at": now,
        "notes": payload.notes,
    })
    await db.commit()
    row = result.fetchone()
    meta = SIGNAL_META.get(row.signal, {})
    return GoalResponse(
        id=row.id,
        signal=row.signal,
        label=meta.get("label", row.signal),
        unit=meta.get("unit", ""),
        group=meta.get("group", ""),
        target_min=float(row.target_min) if row.target_min is not None else None,
        target_max=float(row.target_max) if row.target_max is not None else None,
        set_at=row.set_at,
        notes=row.notes,
    )


# ---------------------------------------------------------------------------
# GET /api/goals/{signal}/history
# ---------------------------------------------------------------------------
@router.get("/goals/{signal}/history", response_model=list[GoalHistoryResponse])
async def get_goal_history(signal: str, db: AsyncSession = Depends(get_db)):
    rows = await db.execute(text("""
        SELECT id, target_min, target_max, set_at, notes
        FROM health_goals
        WHERE signal = :signal
        ORDER BY set_at DESC
    """), {"signal": signal})
    return [
        GoalHistoryResponse(
            id=r.id,
            target_min=float(r.target_min) if r.target_min is not None else None,
            target_max=float(r.target_max) if r.target_max is not None else None,
            set_at=r.set_at,
            notes=r.notes,
        )
        for r in rows
    ]
