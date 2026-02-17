"""add teilnehmer_eingeladene_auswahl to meetings

Revision ID: 20250217_teilnehmer_ausw
Revises: 20250217_protokoll
Create Date: 2025-02-17

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision = '20250217_teilnehmer_ausw'
down_revision = '20250217_protokoll'
branch_labels = None
depends_on = None


def _column_exists(conn, table: str, column: str) -> bool:
    if conn.dialect.name != "sqlite":
        return True
    r = conn.execute(text(f"PRAGMA table_info({table})"))
    return any(row[1] == column for row in r.fetchall())


def upgrade() -> None:
    conn = op.get_bind()
    if not _column_exists(conn, "meetings", "teilnehmer_eingeladene_auswahl"):
        op.add_column('meetings', sa.Column('teilnehmer_eingeladene_auswahl', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('meetings', 'teilnehmer_eingeladene_auswahl')
