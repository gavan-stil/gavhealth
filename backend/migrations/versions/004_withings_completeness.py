"""Add body comp, workout fields, sleep hr_max, and activity intensity columns.

Revision ID: 004
Revises: 003
Create Date: 2026-03-14
"""

import sqlalchemy as sa
from alembic import op

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # sleep_logs: hr_max from sleep summary
    op.add_column("sleep_logs", sa.Column("sleep_hr_max", sa.Float, nullable=True))

    # activity_logs: workout detail fields
    op.add_column("activity_logs", sa.Column("spo2_avg", sa.Float, nullable=True))
    op.add_column("activity_logs", sa.Column("pause_duration_mins", sa.Float, nullable=True))
    op.add_column("activity_logs", sa.Column("pool_laps", sa.Integer, nullable=True))
    op.add_column("activity_logs", sa.Column("strokes", sa.Integer, nullable=True))
    # activity_logs: intensity breakdown from daily summary
    op.add_column("activity_logs", sa.Column("soft_mins", sa.Float, nullable=True))
    op.add_column("activity_logs", sa.Column("moderate_mins", sa.Float, nullable=True))
    op.add_column("activity_logs", sa.Column("intense_mins", sa.Float, nullable=True))

    # weight_logs: body composition from scale
    op.add_column("weight_logs", sa.Column("fat_ratio_pct", sa.Float, nullable=True))
    op.add_column("weight_logs", sa.Column("fat_free_mass_kg", sa.Float, nullable=True))


def downgrade() -> None:
    op.drop_column("sleep_logs", "sleep_hr_max")

    op.drop_column("activity_logs", "spo2_avg")
    op.drop_column("activity_logs", "pause_duration_mins")
    op.drop_column("activity_logs", "pool_laps")
    op.drop_column("activity_logs", "strokes")
    op.drop_column("activity_logs", "soft_mins")
    op.drop_column("activity_logs", "moderate_mins")
    op.drop_column("activity_logs", "intense_mins")

    op.drop_column("weight_logs", "fat_ratio_pct")
    op.drop_column("weight_logs", "fat_free_mass_kg")
