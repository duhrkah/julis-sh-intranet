"""event_attachments table

Revision ID: 20250225_evt_att
Revises: 20250217_mc_aw
Create Date: 2025-02-25

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision = "20250225_evt_att"
down_revision = "20250217_mc_aw"
branch_labels = None
depends_on = None


def _table_exists(conn, table: str) -> bool:
    if conn.dialect.name != "sqlite":
        return False
    r = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name=:t"), {"t": table})
    return r.fetchone() is not None


def upgrade() -> None:
    conn = op.get_bind()
    if not _table_exists(conn, "event_attachments"):
        op.create_table(
            "event_attachments",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("event_id", sa.Integer(), nullable=False),
            sa.Column("original_name", sa.String(255), nullable=False),
            sa.Column("file_path", sa.String(500), nullable=False),
            sa.Column("file_size", sa.Integer(), nullable=False),
            sa.Column("content_type", sa.String(100), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(
                ["event_id"],
                ["events.id"],
                ondelete="CASCADE",
            ),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_event_attachments_event_id",
            "event_attachments",
            ["event_id"],
            unique=False,
        )


def downgrade() -> None:
    op.drop_index("ix_event_attachments_event_id", table_name="event_attachments")
    op.drop_table("event_attachments")
