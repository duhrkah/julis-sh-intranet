"""add graph_event_id to events

Revision ID: 20260417_evt_graph
Revises: 20250310_sup_mem
Create Date: 2026-04-17

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision = "20260417_evt_graph"
down_revision = "20250310_sup_mem"
branch_labels = None
depends_on = None


def _column_exists(conn, table: str, column: str) -> bool:
    if conn.dialect.name != "sqlite":
        return True
    r = conn.execute(text(f"PRAGMA table_info({table})"))
    return any(row[1] == column for row in r.fetchall())


def upgrade() -> None:
    conn = op.get_bind()
    if not _column_exists(conn, "events", "graph_event_id"):
        op.add_column(
            "events",
            sa.Column("graph_event_id", sa.String(255), nullable=True),
        )


def downgrade() -> None:
    op.drop_column("events", "graph_event_id")
