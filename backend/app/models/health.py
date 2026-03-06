"""All health tracking SQLAlchemy models.

Tables from IMPLEMENTATION_SPEC.md Section 1, plus data-pipeline-spec additions.
"""

import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.models.base import Base


# ---------------------------------------------------------------------------
# weight_logs
# ---------------------------------------------------------------------------
class WeightLog(Base):
    __tablename__ = "weight_logs"
    __table_args__ = (UniqueConstraint("recorded_at", "source", name="uq_weight_recorded_source"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    weight_kg: Mapped[float] = mapped_column(Float, nullable=False)
    fat_mass_kg: Mapped[float | None] = mapped_column(Float)
    muscle_mass_kg: Mapped[float | None] = mapped_column(Float)
    bone_mass_kg: Mapped[float | None] = mapped_column(Float)
    hydration_kg: Mapped[float | None] = mapped_column(Float)
    bmi: Mapped[float | None] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="manual")


# ---------------------------------------------------------------------------
# sleep_logs  (base + data-pipeline extensions)
# ---------------------------------------------------------------------------
class SleepLog(Base):
    __tablename__ = "sleep_logs"
    __table_args__ = (UniqueConstraint("sleep_date", "source", name="uq_sleep_date_source"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sleep_date: Mapped[date] = mapped_column(Date, nullable=False)
    bed_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    wake_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    total_sleep_hrs: Mapped[float | None] = mapped_column(Float)
    deep_sleep_hrs: Mapped[float | None] = mapped_column(Float)
    light_sleep_hrs: Mapped[float | None] = mapped_column(Float)
    awake_hrs: Mapped[float | None] = mapped_column(Float)
    sleep_hr_avg: Mapped[float | None] = mapped_column(Float)
    sleep_hr_min: Mapped[float | None] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="manual")
    # data-pipeline extensions
    hrv_ms: Mapped[float | None] = mapped_column(Float)
    spo2_avg: Mapped[float | None] = mapped_column(Float)
    spo2_min: Mapped[float | None] = mapped_column(Float)
    rem_sleep_hrs: Mapped[float | None] = mapped_column(Float)
    rem_source: Mapped[str | None] = mapped_column(String(50))
    sleep_quality_pct: Mapped[float | None] = mapped_column(Float)
    sleep_efficiency_pct: Mapped[float | None] = mapped_column(Float)
    sleep_score: Mapped[float | None] = mapped_column(Float)
    respiratory_rate: Mapped[float | None] = mapped_column(Float)
    upload_batch_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))


# ---------------------------------------------------------------------------
# activity_logs  (base + data-pipeline extensions)
# ---------------------------------------------------------------------------
class ActivityLog(Base):
    __tablename__ = "activity_logs"
    __table_args__ = (UniqueConstraint("external_id", "source", name="uq_activity_ext_source"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    activity_date: Mapped[date] = mapped_column(Date, nullable=False)
    activity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    duration_mins: Mapped[float | None] = mapped_column(Float)
    distance_km: Mapped[float | None] = mapped_column(Float)
    avg_pace_secs: Mapped[float | None] = mapped_column(Float)
    avg_hr: Mapped[int | None] = mapped_column(Integer)
    max_hr: Mapped[int | None] = mapped_column(Integer)
    calories_burned: Mapped[int | None] = mapped_column(Integer)
    elevation_m: Mapped[float | None] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="manual")
    external_id: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text)
    # data-pipeline extensions
    route_polyline: Mapped[str | None] = mapped_column(Text)
    zone_seconds: Mapped[dict | None] = mapped_column(JSONB)


# ---------------------------------------------------------------------------
# rhr_logs
# ---------------------------------------------------------------------------
class RhrLog(Base):
    __tablename__ = "rhr_logs"
    __table_args__ = (UniqueConstraint("log_date", "source", name="uq_rhr_date_source"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    log_date: Mapped[date] = mapped_column(Date, nullable=False)
    rhr_bpm: Mapped[int] = mapped_column(Integer, nullable=False)
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="manual")


# ---------------------------------------------------------------------------
# sauna_logs
# ---------------------------------------------------------------------------
class SaunaLog(Base):
    __tablename__ = "sauna_logs"
    __table_args__ = (
        CheckConstraint(
            "session_type IN ('traditional', 'infrared')", name="ck_sauna_type"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_datetime: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    session_type: Mapped[str] = mapped_column(String(20), nullable=False, default="traditional")
    duration_mins: Mapped[int] = mapped_column(Integer, nullable=False)
    temperature_c: Mapped[int | None] = mapped_column(Integer)
    did_breathing: Mapped[bool] = mapped_column(Boolean, default=False)
    did_devotions: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text)
    withings_activity_id: Mapped[int | None] = mapped_column(Integer)
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="manual")


# ---------------------------------------------------------------------------
# daily_habits
# ---------------------------------------------------------------------------
class DailyHabit(Base):
    __tablename__ = "daily_habits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    habit_date: Mapped[date] = mapped_column(Date, nullable=False, unique=True)
    did_breathing: Mapped[bool] = mapped_column(Boolean, default=False)
    did_devotions: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text)


# ---------------------------------------------------------------------------
# food_logs
# ---------------------------------------------------------------------------
class FoodLog(Base):
    __tablename__ = "food_logs"
    __table_args__ = (
        CheckConstraint(
            "meal_label IN ('breakfast','lunch','dinner','snack','post-workout')",
            name="ck_food_meal_label",
        ),
        CheckConstraint(
            "confidence IN ('high','medium','low')", name="ck_food_confidence"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    log_date: Mapped[date] = mapped_column(Date, nullable=False)
    meal_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    meal_label: Mapped[str] = mapped_column(String(20), nullable=False)
    description_raw: Mapped[str] = mapped_column(Text, nullable=False)
    protein_g: Mapped[float | None] = mapped_column(Float)
    carbs_g: Mapped[float | None] = mapped_column(Float)
    fat_g: Mapped[float | None] = mapped_column(Float)
    calories_kcal: Mapped[int | None] = mapped_column(Integer)
    confidence: Mapped[str] = mapped_column(String(10), nullable=False, default="medium")
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="manual")
    notes: Mapped[str | None] = mapped_column(Text)


# ---------------------------------------------------------------------------
# exercises
# ---------------------------------------------------------------------------
class Exercise(Base):
    __tablename__ = "exercises"
    __table_args__ = (
        CheckConstraint(
            "category IN ('upper_push','upper_pull','lower','core','carry','full_body','other')",
            name="ck_exercise_category",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    uses_bodyweight: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text)

    sets: Mapped[list["StrengthSet"]] = relationship(back_populates="exercise")


# ---------------------------------------------------------------------------
# strength_sessions
# ---------------------------------------------------------------------------
class StrengthSession(Base):
    __tablename__ = "strength_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_datetime: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    session_label: Mapped[str | None] = mapped_column(String(100))
    notes: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="manual")
    activity_log_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    sets: Mapped[list["StrengthSet"]] = relationship(back_populates="session", cascade="all, delete-orphan")


# ---------------------------------------------------------------------------
# strength_sets
# ---------------------------------------------------------------------------
class StrengthSet(Base):
    __tablename__ = "strength_sets"
    __table_args__ = (
        CheckConstraint("rpe >= 1 AND rpe <= 10", name="ck_set_rpe"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("strength_sessions.id", ondelete="CASCADE"), nullable=False)
    exercise_id: Mapped[int] = mapped_column(ForeignKey("exercises.id"), nullable=False)
    set_number: Mapped[int] = mapped_column(Integer, nullable=False)
    reps: Mapped[int] = mapped_column(Integer, nullable=False)
    weight_kg: Mapped[float | None] = mapped_column(Float)
    is_bodyweight: Mapped[bool] = mapped_column(Boolean, default=False)
    bodyweight_at_session: Mapped[float | None] = mapped_column(Float)
    rpe: Mapped[float | None] = mapped_column(Float)
    notes: Mapped[str | None] = mapped_column(Text)

    session: Mapped["StrengthSession"] = relationship(back_populates="sets")
    exercise: Mapped["Exercise"] = relationship(back_populates="sets")


# ---------------------------------------------------------------------------
# dexa_scans
# ---------------------------------------------------------------------------
class DexaScan(Base):
    __tablename__ = "dexa_scans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scan_date: Mapped[date] = mapped_column(Date, nullable=False, unique=True)
    body_fat_pct: Mapped[float | None] = mapped_column(Float)
    lean_mass_kg: Mapped[float | None] = mapped_column(Float)
    fat_mass_kg: Mapped[float | None] = mapped_column(Float)
    bmc_g: Mapped[float | None] = mapped_column(Float)
    total_bmd: Mapped[float | None] = mapped_column(Float)
    lumbar_bmd: Mapped[float | None] = mapped_column(Float)
    vat_area_cm2: Mapped[float | None] = mapped_column(Float)
    rmr_kcal: Mapped[int | None] = mapped_column(Integer)
    appendicular_lean_height2: Mapped[float | None] = mapped_column(Float)
    r_leg_fat_pct: Mapped[float | None] = mapped_column(Float)
    l_leg_fat_pct: Mapped[float | None] = mapped_column(Float)
    notes: Mapped[str | None] = mapped_column(Text)


# ---------------------------------------------------------------------------
# sync_log
# ---------------------------------------------------------------------------
class SyncLog(Base):
    __tablename__ = "sync_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source: Mapped[str] = mapped_column(String(50), nullable=False)
    sync_type: Mapped[str] = mapped_column(String(50), nullable=False)
    last_sync_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    records_synced: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="success")
    error_message: Mapped[str | None] = mapped_column(Text)


# ---------------------------------------------------------------------------
# sync_events  (from data-pipeline-spec)
# ---------------------------------------------------------------------------
class SyncEvent(Base):
    __tablename__ = "sync_events"
    __table_args__ = (
        Index("ix_sync_events_source_status", "source", "status"),
        Index("ix_sync_events_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source: Mapped[str] = mapped_column(String(50), nullable=False)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    external_id: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    error_message: Mapped[str | None] = mapped_column(Text)
    raw_payload: Mapped[dict | None] = mapped_column(JSONB)
    records_created: Mapped[int] = mapped_column(Integer, default=0)
    records_updated: Mapped[int] = mapped_column(Integer, default=0)
    records_skipped: Mapped[int] = mapped_column(Integer, default=0)
    batch_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


# ---------------------------------------------------------------------------
# sync_state  (from data-pipeline-spec)
# ---------------------------------------------------------------------------
class SyncState(Base):
    __tablename__ = "sync_state"

    source: Mapped[str] = mapped_column(String(50), primary_key=True)
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_backfill_date: Mapped[date | None] = mapped_column(Date)
    backfill_complete: Mapped[bool] = mapped_column(Boolean, default=False)
    token_status: Mapped[str | None] = mapped_column(String(20))
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    access_token: Mapped[str | None] = mapped_column(Text)
    refresh_token: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


# ---------------------------------------------------------------------------
# daily_summary  (from data-pipeline-spec)
# ---------------------------------------------------------------------------
class DailySummary(Base):
    __tablename__ = "daily_summary"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    summary_date: Mapped[date] = mapped_column(Date, nullable=False, unique=True)
    recovery_score: Mapped[float | None] = mapped_column(Float)
    strain_score: Mapped[float | None] = mapped_column(Float)
    strain_score_pct: Mapped[float | None] = mapped_column(Float)
    readiness_score: Mapped[float | None] = mapped_column(Float)
    rhr_bpm: Mapped[int | None] = mapped_column(Integer)
    hrv_ms: Mapped[float | None] = mapped_column(Float)
    spo2_avg: Mapped[float | None] = mapped_column(Float)
    skin_temp_c: Mapped[float | None] = mapped_column(Float)
    avg_hr_day: Mapped[int | None] = mapped_column(Integer)
    max_hr_day: Mapped[int | None] = mapped_column(Integer)
    active_calories: Mapped[int | None] = mapped_column(Integer)
    total_sleep_hrs: Mapped[float | None] = mapped_column(Float)
    deep_sleep_hrs: Mapped[float | None] = mapped_column(Float)
    rem_sleep_hrs: Mapped[float | None] = mapped_column(Float)
    sleep_score: Mapped[float | None] = mapped_column(Float)
    weight_kg: Mapped[float | None] = mapped_column(Float)
    body_fat_pct: Mapped[float | None] = mapped_column(Float)
    protein_g: Mapped[float | None] = mapped_column(Float)
    carbs_g: Mapped[float | None] = mapped_column(Float)
    fat_g: Mapped[float | None] = mapped_column(Float)
    calories_kcal: Mapped[int | None] = mapped_column(Integer)
    activity_count: Mapped[int] = mapped_column(Integer, default=0)
    training_load_mins: Mapped[float | None] = mapped_column(Float)
    sources: Mapped[dict | None] = mapped_column(JSONB)
    computed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ---------------------------------------------------------------------------
# user_settings (single-row, from gavhealth-api-spec)
# ---------------------------------------------------------------------------
class UserSettings(Base):
    __tablename__ = "user_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    height_cm: Mapped[float | None] = mapped_column(Float)
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    calorie_target: Mapped[int | None] = mapped_column(Integer)
    protein_target_g: Mapped[int | None] = mapped_column(Integer)
    water_target_ml: Mapped[int | None] = mapped_column(Integer)
    sleep_target_hours: Mapped[float | None] = mapped_column(Float, default=7.6)
    weight_goal_kg: Mapped[float | None] = mapped_column(Float)
    body_fat_goal_pct: Mapped[float | None] = mapped_column(Float)
    max_heart_rate: Mapped[int | None] = mapped_column(Integer)
    timezone: Mapped[str] = mapped_column(String(50), default="Australia/Sydney")
