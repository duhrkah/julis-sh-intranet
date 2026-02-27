"""app_settings key-value table

Revision ID: 20250227_app_set
Revises: 20250225_evt_att
Create Date: 2025-02-27

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision = "20250227_app_set"
down_revision = "20250225_evt_att"
branch_labels = None
depends_on = None


def _table_exists(conn, table: str) -> bool:
    if conn.dialect.name != "sqlite":
        return False
    r = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name=:t"), {"t": table})
    return r.fetchone() is not None


def upgrade() -> None:
    conn = op.get_bind()
    if not _table_exists(conn, "app_settings"):
        op.create_table(
            "app_settings",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("key", sa.String(100), nullable=False),
            sa.Column("value", sa.String(500), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("key"),
        )
        op.create_index("ix_app_settings_key", "app_settings", ["key"], unique=True)

        # Seed initial version
        op.execute(
            sa.text("INSERT INTO app_settings (key, value) VALUES ('app_version', '1.0.0')")
        )


def downgrade() -> None:
    op.drop_index("ix_app_settings_key", table_name="app_settings")
    op.drop_table("app_settings")
