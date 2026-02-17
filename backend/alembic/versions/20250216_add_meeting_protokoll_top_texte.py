"""add protokoll_top_texte to meetings

Revision ID: 20250216_protokoll_tops
Revises: 20250216_mitgliedsnummer
Create Date: 2025-02-16

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision = '20250216_protokoll_tops'
down_revision = '20250216_mitgliedsnummer'
branch_labels = None
depends_on = None


def _column_exists(conn, table: str, column: str) -> bool:
    if conn.dialect.name != "sqlite":
        return True  # run add_column; other DBs handle duplicate gracefully or we could use inspect
    r = conn.execute(text(f"PRAGMA table_info({table})"))
    return any(row[1] == column for row in r.fetchall())


def upgrade() -> None:
    conn = op.get_bind()
    if not _column_exists(conn, "meetings", "protokoll_top_texte"):
        op.add_column('meetings', sa.Column('protokoll_top_texte', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('meetings', 'protokoll_top_texte')
