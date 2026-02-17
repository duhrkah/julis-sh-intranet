"""add sitzungsleitung, protokollfuehrer, teilnehmer_sonstige to meetings

Revision ID: 20250217_protokoll
Revises: 20250217_einladung
Create Date: 2025-02-17

"""
from alembic import op
import sqlalchemy as sa


revision = '20250217_protokoll'
down_revision = '20250217_einladung'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('meetings', sa.Column('teilnehmer_sonstige', sa.Text(), nullable=True))
    op.add_column('meetings', sa.Column('sitzungsleitung', sa.Text(), nullable=True))
    op.add_column('meetings', sa.Column('protokollfuehrer', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('meetings', 'protokollfuehrer')
    op.drop_column('meetings', 'sitzungsleitung')
    op.drop_column('meetings', 'teilnehmer_sonstige')
