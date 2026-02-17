"""add sitzungsleitung, protokollfuehrer, teilnehmer_sonstige to meetings

Revision ID: 20250217_protokoll
Revises: 20250217_einladung
Create Date: 2025-02-17

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision = '20250217_protokoll'
down_revision = '20250217_einladung'
branch_labels = None
depends_on = None


def _column_exists(conn, table: str, column: str) -> bool:
    if conn.dialect.name != "sqlite":
        return True
    r = conn.execute(text(f"PRAGMA table_info({table})"))
    return any(row[1] == column for row in r.fetchall())


def upgrade() -> None:
    conn = op.get_bind()
    if not _column_exists(conn, "meetings", "teilnehmer_sonstige"):
        op.add_column('meetings', sa.Column('teilnehmer_sonstige', sa.Text(), nullable=True))
    if not _column_exists(conn, "meetings", "sitzungsleitung"):
        op.add_column('meetings', sa.Column('sitzungsleitung', sa.Text(), nullable=True))
    if not _column_exists(conn, "meetings", "protokollfuehrer"):
        op.add_column('meetings', sa.Column('protokollfuehrer', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('meetings', 'protokollfuehrer')
    op.drop_column('meetings', 'sitzungsleitung')
    op.drop_column('meetings', 'teilnehmer_sonstige')
