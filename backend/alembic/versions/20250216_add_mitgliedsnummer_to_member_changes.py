"""add mitgliedsnummer to member_changes

Revision ID: 20250216_mitgliedsnummer
Revises:
Create Date: 2025-02-16

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20250216_mitgliedsnummer'
down_revision = None
branch_labels = None
depends_on = None


def _column_exists(connection, table: str, column: str) -> bool:
    """Prüft, ob eine Spalte in der Tabelle existiert (SQLite). Tabellenname ist fest."""
    if table != "member_changes" or column != "mitgliedsnummer":
        return False
    cursor = connection.execute(sa.text("PRAGMA table_info(member_changes)"))
    return any(row[1] == "mitgliedsnummer" for row in cursor.fetchall())


def upgrade() -> None:
    conn = op.get_bind()
    if not _column_exists(conn, "member_changes", "mitgliedsnummer"):
        op.add_column('member_changes', sa.Column('mitgliedsnummer', sa.String(50), nullable=True))
        op.create_index(op.f('ix_member_changes_mitgliedsnummer'), 'member_changes', ['mitgliedsnummer'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_member_changes_mitgliedsnummer'), table_name='member_changes')
    op.drop_column('member_changes', 'mitgliedsnummer')
