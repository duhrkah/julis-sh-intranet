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


def upgrade() -> None:
    op.add_column('member_changes', sa.Column('mitgliedsnummer', sa.String(50), nullable=True))
    op.create_index(op.f('ix_member_changes_mitgliedsnummer'), 'member_changes', ['mitgliedsnummer'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_member_changes_mitgliedsnummer'), table_name='member_changes')
    op.drop_column('member_changes', 'mitgliedsnummer')
