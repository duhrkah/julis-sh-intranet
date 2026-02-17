"""add einladung_variante and einladung_empfaenger_freitext to meetings

Revision ID: 20250217_einladung
Revises: 20250216_protokoll_tops
Create Date: 2025-02-17

"""
from alembic import op
import sqlalchemy as sa


revision = '20250217_einladung'
down_revision = '20250216_protokoll_tops'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('meetings', sa.Column('einladung_variante', sa.String(50), nullable=True))
    op.add_column('meetings', sa.Column('einladung_empfaenger_freitext', sa.Text(), nullable=True))
    op.execute("UPDATE meetings SET einladung_variante = 'freitext' WHERE einladung_variante IS NULL")


def downgrade() -> None:
    op.drop_column('meetings', 'einladung_empfaenger_freitext')
    op.drop_column('meetings', 'einladung_variante')
