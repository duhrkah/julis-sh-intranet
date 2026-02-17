"""add titel_kurz to meetings

Revision ID: 20250217_titel_kurz
Revises: 20250217_teilnehmer_ausw
Create Date: 2025-02-17

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision = '20250217_titel_kurz'
down_revision = '20250217_teilnehmer_ausw'
branch_labels = None
depends_on = None


def _column_exists(conn, table: str, column: str) -> bool:
    if conn.dialect.name != "sqlite":
        return True
    r = conn.execute(text(f"PRAGMA table_info({table})"))
    return any(row[1] == column for row in r.fetchall())


def upgrade() -> None:
    conn = op.get_bind()
    if not _column_exists(conn, "meetings", "titel_kurz"):
        op.add_column('meetings', sa.Column('titel_kurz', sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column('meetings', 'titel_kurz')
