"""member_changes: hausnummer

Revision ID: 20250217_mch
Revises: 20250217_eta
Create Date: 2025-02-17

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision = "20250217_mch"
down_revision = "20250217_eta"
branch_labels = None
depends_on = None


def _column_exists(conn, table: str, column: str) -> bool:
    if conn.dialect.name != "sqlite":
        return True
    r = conn.execute(text(f"PRAGMA table_info({table})"))
    return any(row[1] == column for row in r.fetchall())


def upgrade() -> None:
    conn = op.get_bind()
    if not _column_exists(conn, "member_changes", "hausnummer"):
        op.add_column(
            "member_changes",
            sa.Column("hausnummer", sa.String(20), nullable=True),
        )


def downgrade() -> None:
    op.drop_column("member_changes", "hausnummer")
