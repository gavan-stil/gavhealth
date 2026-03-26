"""Add muscle_groups and exercise_muscles tables for multi-tag exercise categorisation.

Revision ID: 005
Revises: 004
Create Date: 2026-03-27
"""

import sqlalchemy as sa
from alembic import op

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None

# The 7 existing categories and their macro group mappings
SEED_GROUPS = [
    ("chest", "push"),
    ("back", "pull"),
    ("shoulders", "push"),
    ("arms", "push"),
    ("legs", "legs"),
    ("core", "abs"),
    ("other", "other"),
]


def upgrade() -> None:
    # 1. Create muscle_groups table
    op.create_table(
        "muscle_groups",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(30), nullable=False, unique=True),
        sa.Column("macro_group", sa.String(10), nullable=False),
    )

    # 2. Create exercise_muscles junction table
    op.create_table(
        "exercise_muscles",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "exercise_id",
            sa.Integer,
            sa.ForeignKey("exercises.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "muscle_group_id",
            sa.Integer,
            sa.ForeignKey("muscle_groups.id"),
            nullable=False,
        ),
        sa.Column("is_primary", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.UniqueConstraint("exercise_id", "muscle_group_id", name="uq_exercise_muscle"),
    )

    # 3. Drop the CHECK constraint on exercises.category
    op.drop_constraint("ck_exercise_category", "exercises", type_="check")

    # 4. Seed muscle_groups with the 7 existing categories
    muscle_groups = sa.table(
        "muscle_groups",
        sa.column("id", sa.Integer),
        sa.column("name", sa.String),
        sa.column("macro_group", sa.String),
    )
    op.bulk_insert(muscle_groups, [{"name": n, "macro_group": m} for n, m in SEED_GROUPS])

    # 5. Migrate existing exercises: create exercise_muscles rows from exercises.category
    op.execute(
        """
        INSERT INTO exercise_muscles (exercise_id, muscle_group_id, is_primary)
        SELECT e.id, mg.id, true
        FROM exercises e
        JOIN muscle_groups mg ON mg.name = e.category
        """
    )


def downgrade() -> None:
    # Re-add the CHECK constraint
    op.create_check_constraint(
        "ck_exercise_category",
        "exercises",
        "category IN ('chest','back','shoulders','arms','legs','core','other')",
    )
    op.drop_table("exercise_muscles")
    op.drop_table("muscle_groups")
