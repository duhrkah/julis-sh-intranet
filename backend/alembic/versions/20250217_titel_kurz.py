"""add titel_kurz to meetings

Revision ID: 20250217_titel_kurz
Revises: 20250217_teilnehmer_ausw
Create Date: 2025-02-17

"""
from alembic import op
import sqlalchemy as sa


revision = '20250217_titel_kurz'
down_revision = '20250217_teilnehmer_ausw'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('meetings', sa.Column('titel_kurz', sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column('meetings', 'titel_kurz')
