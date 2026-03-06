"""Initial schema — all 17 tables.

Revision ID: 001
Revises:
Create Date: 2026-02-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- weight_logs ---
    op.create_table(
        "weight_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("weight_kg", sa.Float(), nullable=False),
        sa.Column("fat_mass_kg", sa.Float(), nullable=True),
        sa.Column("muscle_mass_kg", sa.Float(), nullable=True),
        sa.Column("bone_mass_kg", sa.Float(), nullable=True),
        sa.Column("hydration_kg", sa.Float(), nullable=True),
        sa.Column("bmi", sa.Float(), nullable=True),
        sa.Column("source", sa.String(50), nullable=False, server_default="manual"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("recorded_at", "source", name="uq_weight_recorded_source"),
    )

    # --- sleep_logs ---
    op.create_table(
        "sleep_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("sleep_date", sa.Date(), nullable=False),
        sa.Column("bed_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("wake_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("total_sleep_hrs", sa.Float(), nullable=True),
        sa.Column("deep_sleep_hrs", sa.Float(), nullable=True),
        sa.Column("light_sleep_hrs", sa.Float(), nullable=True),
        sa.Column("awake_hrs", sa.Float(), nullable=True),
        sa.Column("sleep_hr_avg", sa.Float(), nullable=True),
        sa.Column("sleep_hr_min", sa.Float(), nullable=True),
        sa.Column("source", sa.String(50), nullable=False, server_default="manual"),
        # data-pipeline extensions
        sa.Column("hrv_ms", sa.Float(), nullable=True),
        sa.Column("spo2_avg", sa.Float(), nullable=True),
        sa.Column("spo2_min", sa.Float(), nullable=True),
        sa.Column("rem_sleep_hrs", sa.Float(), nullable=True),
        sa.Column("rem_source", sa.String(50), nullable=True),
        sa.Column("sleep_quality_pct", sa.Float(), nullable=True),
        sa.Column("sleep_efficiency_pct", sa.Float(), nullable=True),
        sa.Column("sleep_score", sa.Float(), nullable=True),
        sa.Column("respiratory_rate", sa.Float(), nullable=True),
        sa.Column("upload_batch_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("sleep_date", "source", name="uq_sleep_date_source"),
    )

    # --- activity_logs ---
    op.create_table(
        "activity_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("activity_date", sa.Date(), nullable=False),
        sa.Column("activity_type", sa.String(100), nullable=False),
        sa.Column("duration_mins", sa.Float(), nullable=True),
        sa.Column("distance_km", sa.Float(), nullable=True),
        sa.Column("avg_pace_secs", sa.Float(), nullable=True),
        sa.Column("avg_hr", sa.Integer(), nullable=True),
        sa.Column("max_hr", sa.Integer(), nullable=True),
        sa.Column("calories_burned", sa.Integer(), nullable=True),
        sa.Column("elevation_m", sa.Float(), nullable=True),
        sa.Column("source", sa.String(50), nullable=False, server_default="manual"),
        sa.Column("external_id", sa.String(255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        # data-pipeline extensions
        sa.Column("route_polyline", sa.Text(), nullable=True),
        sa.Column("zone_seconds", postgresql.JSONB(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("external_id", "source", name="uq_activity_ext_source"),
    )

    # --- rhr_logs ---
    op.create_table(
        "rhr_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("log_date", sa.Date(), nullable=False),
        sa.Column("rhr_bpm", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(50), nullable=False, server_default="manual"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("log_date", "source", name="uq_rhr_date_source"),
    )

    # --- sauna_logs ---
    op.create_table(
        "sauna_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("session_datetime", sa.DateTime(timezone=True), nullable=False),
        sa.Column("session_type", sa.String(20), nullable=False, server_default="traditional"),
        sa.Column("duration_mins", sa.Integer(), nullable=False),
        sa.Column("temperature_c", sa.Integer(), nullable=True),
        sa.Column("did_breathing", sa.Boolean(), server_default="false"),
        sa.Column("did_devotions", sa.Boolean(), server_default="false"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("withings_activity_id", sa.Integer(), nullable=True),
        sa.Column("source", sa.String(50), nullable=False, server_default="manual"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "session_type IN ('traditional', 'infrared')", name="ck_sauna_type"
        ),
    )

    # --- daily_habits ---
    op.create_table(
        "daily_habits",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("habit_date", sa.Date(), nullable=False),
        sa.Column("did_breathing", sa.Boolean(), server_default="false"),
        sa.Column("did_devotions", sa.Boolean(), server_default="false"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("habit_date"),
    )

    # --- food_logs ---
    op.create_table(
        "food_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("log_date", sa.Date(), nullable=False),
        sa.Column("meal_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("meal_label", sa.String(20), nullable=False),
        sa.Column("description_raw", sa.Text(), nullable=False),
        sa.Column("protein_g", sa.Float(), nullable=True),
        sa.Column("carbs_g", sa.Float(), nullable=True),
        sa.Column("fat_g", sa.Float(), nullable=True),
        sa.Column("calories_kcal", sa.Integer(), nullable=True),
        sa.Column("confidence", sa.String(10), nullable=False, server_default="medium"),
        sa.Column("source", sa.String(50), nullable=False, server_default="manual"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "meal_label IN ('breakfast','lunch','dinner','snack','post-workout')",
            name="ck_food_meal_label",
        ),
        sa.CheckConstraint(
            "confidence IN ('high','medium','low')", name="ck_food_confidence"
        ),
    )

    # --- exercises ---
    op.create_table(
        "exercises",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("category", sa.String(20), nullable=False),
        sa.Column("uses_bodyweight", sa.Boolean(), server_default="false"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
        sa.CheckConstraint(
            "category IN ('upper_push','upper_pull','lower','core','carry','full_body','other')",
            name="ck_exercise_category",
        ),
    )

    # --- strength_sessions ---
    op.create_table(
        "strength_sessions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("session_datetime", sa.DateTime(timezone=True), nullable=False),
        sa.Column("session_label", sa.String(100), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("source", sa.String(50), nullable=False, server_default="manual"),
        sa.PrimaryKeyConstraint("id"),
    )

    # --- strength_sets (FK → strength_sessions, exercises) ---
    op.create_table(
        "strength_sets",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("strength_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("exercise_id", sa.Integer(), sa.ForeignKey("exercises.id"), nullable=False),
        sa.Column("set_number", sa.Integer(), nullable=False),
        sa.Column("reps", sa.Integer(), nullable=False),
        sa.Column("weight_kg", sa.Float(), nullable=True),
        sa.Column("is_bodyweight", sa.Boolean(), server_default="false"),
        sa.Column("bodyweight_at_session", sa.Float(), nullable=True),
        sa.Column("rpe", sa.Float(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("rpe >= 1 AND rpe <= 10", name="ck_set_rpe"),
    )

    # --- dexa_scans ---
    op.create_table(
        "dexa_scans",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("scan_date", sa.Date(), nullable=False),
        sa.Column("body_fat_pct", sa.Float(), nullable=True),
        sa.Column("lean_mass_kg", sa.Float(), nullable=True),
        sa.Column("fat_mass_kg", sa.Float(), nullable=True),
        sa.Column("bmc_g", sa.Float(), nullable=True),
        sa.Column("total_bmd", sa.Float(), nullable=True),
        sa.Column("lumbar_bmd", sa.Float(), nullable=True),
        sa.Column("vat_area_cm2", sa.Float(), nullable=True),
        sa.Column("rmr_kcal", sa.Integer(), nullable=True),
        sa.Column("appendicular_lean_height2", sa.Float(), nullable=True),
        sa.Column("r_leg_fat_pct", sa.Float(), nullable=True),
        sa.Column("l_leg_fat_pct", sa.Float(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("scan_date"),
    )

    # --- sync_log ---
    op.create_table(
        "sync_log",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("source", sa.String(50), nullable=False),
        sa.Column("sync_type", sa.String(50), nullable=False),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("records_synced", sa.Integer(), server_default="0"),
        sa.Column("status", sa.String(20), nullable=False, server_default="success"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    # --- sync_events ---
    op.create_table(
        "sync_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("source", sa.String(50), nullable=False),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("external_id", sa.String(255), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("raw_payload", postgresql.JSONB(), nullable=True),
        sa.Column("records_created", sa.Integer(), server_default="0"),
        sa.Column("records_updated", sa.Integer(), server_default="0"),
        sa.Column("records_skipped", sa.Integer(), server_default="0"),
        sa.Column("batch_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sync_events_source_status", "sync_events", ["source", "status"])
    op.create_index("ix_sync_events_created_at", "sync_events", ["created_at"])

    # --- sync_state ---
    op.create_table(
        "sync_state",
        sa.Column("source", sa.String(50), nullable=False),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_backfill_date", sa.Date(), nullable=True),
        sa.Column("backfill_complete", sa.Boolean(), server_default="false"),
        sa.Column("token_status", sa.String(20), nullable=True),
        sa.Column("token_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("source"),
    )

    # --- daily_summary ---
    op.create_table(
        "daily_summary",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("summary_date", sa.Date(), nullable=False),
        sa.Column("recovery_score", sa.Float(), nullable=True),
        sa.Column("strain_score", sa.Float(), nullable=True),
        sa.Column("strain_score_pct", sa.Float(), nullable=True),
        sa.Column("readiness_score", sa.Float(), nullable=True),
        sa.Column("rhr_bpm", sa.Integer(), nullable=True),
        sa.Column("hrv_ms", sa.Float(), nullable=True),
        sa.Column("spo2_avg", sa.Float(), nullable=True),
        sa.Column("skin_temp_c", sa.Float(), nullable=True),
        sa.Column("avg_hr_day", sa.Integer(), nullable=True),
        sa.Column("max_hr_day", sa.Integer(), nullable=True),
        sa.Column("active_calories", sa.Integer(), nullable=True),
        sa.Column("total_sleep_hrs", sa.Float(), nullable=True),
        sa.Column("deep_sleep_hrs", sa.Float(), nullable=True),
        sa.Column("rem_sleep_hrs", sa.Float(), nullable=True),
        sa.Column("sleep_score", sa.Float(), nullable=True),
        sa.Column("weight_kg", sa.Float(), nullable=True),
        sa.Column("body_fat_pct", sa.Float(), nullable=True),
        sa.Column("protein_g", sa.Float(), nullable=True),
        sa.Column("carbs_g", sa.Float(), nullable=True),
        sa.Column("fat_g", sa.Float(), nullable=True),
        sa.Column("calories_kcal", sa.Integer(), nullable=True),
        sa.Column("activity_count", sa.Integer(), server_default="0"),
        sa.Column("training_load_mins", sa.Float(), nullable=True),
        sa.Column("sources", postgresql.JSONB(), nullable=True),
        sa.Column("computed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("summary_date"),
    )

    # --- user_settings ---
    op.create_table(
        "user_settings",
        sa.Column("id", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("height_cm", sa.Float(), nullable=True),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("calorie_target", sa.Integer(), nullable=True),
        sa.Column("protein_target_g", sa.Integer(), nullable=True),
        sa.Column("water_target_ml", sa.Integer(), nullable=True),
        sa.Column("sleep_target_hours", sa.Float(), server_default="7.6"),
        sa.Column("weight_goal_kg", sa.Float(), nullable=True),
        sa.Column("body_fat_goal_pct", sa.Float(), nullable=True),
        sa.Column("max_heart_rate", sa.Integer(), nullable=True),
        sa.Column("timezone", sa.String(50), server_default="Australia/Sydney"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("user_settings")
    op.drop_table("daily_summary")
    op.drop_table("sync_state")
    op.drop_index("ix_sync_events_created_at", table_name="sync_events")
    op.drop_index("ix_sync_events_source_status", table_name="sync_events")
    op.drop_table("sync_events")
    op.drop_table("sync_log")
    op.drop_table("dexa_scans")
    op.drop_table("strength_sets")
    op.drop_table("strength_sessions")
    op.drop_table("exercises")
    op.drop_table("food_logs")
    op.drop_table("daily_habits")
    op.drop_table("sauna_logs")
    op.drop_table("rhr_logs")
    op.drop_table("activity_logs")
    op.drop_table("sleep_logs")
    op.drop_table("weight_logs")
