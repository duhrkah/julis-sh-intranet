"""add teilnehmer_eingeladene_auswahl to meetings

Revision ID: 20250217_teilnehmer_ausw
Revises: 20250217_protokoll
Create Date: 2025-02-17

"""
from alembic import op
import sqlalchemy as sa


revision = '20250217_teilnehmer_ausw'
down_revision = '20250217_protokoll'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('meetings', sa.Column('teilnehmer_eingeladene_auswahl', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('meetings', 'teilnehmer_eingeladene_auswahl')
