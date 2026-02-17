"""email_templates: Anhang-Felder

Revision ID: 20250217_eta
Revises: 20250217_doc_aend
Create Date: 2025-02-17

"""
from alembic import op
import sqlalchemy as sa


revision = "20250217_eta"
down_revision = "20250217_doc_aend"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "email_templates",
        sa.Column("attachment_original_filename", sa.String(255), nullable=True),
    )
    op.add_column(
        "email_templates",
        sa.Column("attachment_storage_path", sa.String(500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("email_templates", "attachment_storage_path")
    op.drop_column("email_templates", "attachment_original_filename")
