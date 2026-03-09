"""Add hr_intraday table for hourly HR buckets from Withings getintradayactivity.

Revision ID: 003
Revises: 002
Create Date: 2026-03-09
"""

import sqlalchemy as sa
from alembic import op

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "hr_intraday",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("log_date", sa.Date, nullable=False),
        sa.Column("hour", sa.Integer, nullable=False),  # 0–23 local (Brisbane)
        sa.Column("hr_avg", sa.Float, nullable=True),
        sa.Column("hr_min", sa.Integer, nullable=True),
        sa.Column("hr_max", sa.Integer, nullable=True),
        sa.Column("readings_count", sa.Integer, nullable=True),
        sa.Column("source", sa.String(50), nullable=False, server_default="withings"),
        sa.UniqueConstraint("log_date", "hour", "source", name="uq_hr_intraday_date_hour_source"),
    )
    op.create_index("ix_hr_intraday_log_date", "hr_intraday", ["log_date"])


def downgrade() -> None:
    op.drop_index("ix_hr_intraday_log_date", table_name="hr_intraday")
    op.drop_table("hr_intraday")
