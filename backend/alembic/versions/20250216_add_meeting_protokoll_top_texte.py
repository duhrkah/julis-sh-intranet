"""add protokoll_top_texte to meetings

Revision ID: 20250216_protokoll_tops
Revises: 20250216_mitgliedsnummer
Create Date: 2025-02-16

"""
from alembic import op
import sqlalchemy as sa


revision = '20250216_protokoll_tops'
down_revision = '20250216_mitgliedsnummer'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('meetings', sa.Column('protokoll_top_texte', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('meetings', 'protokoll_top_texte')
