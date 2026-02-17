"""member_changes: hausnummer

Revision ID: 20250217_mch
Revises: 20250217_eta
Create Date: 2025-02-17

"""
from alembic import op
import sqlalchemy as sa


revision = "20250217_mch"
down_revision = "20250217_eta"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "member_changes",
        sa.Column("hausnummer", sa.String(20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("member_changes", "hausnummer")
