"""document_aenderungen (Stellen) + titel am Änderungsantrag

Revision ID: 20250217_doc_aend
Revises: 20250217_titel_kurz
Create Date: 2025-02-17

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision = "20250217_doc_aend"
down_revision = "20250217_titel_kurz"
branch_labels = None
depends_on = None


def _column_exists(conn, table: str, column: str) -> bool:
    if conn.dialect.name != "sqlite":
        return True
    r = conn.execute(text(f"PRAGMA table_info({table})"))
    return any(row[1] == column for row in r.fetchall())


def _table_exists(conn, table: str) -> bool:
    if conn.dialect.name != "sqlite":
        return False
    r = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name=:t"), {"t": table})
    return r.fetchone() is not None


def upgrade() -> None:
    conn = op.get_bind()
    if not _column_exists(conn, "document_aenderungsantraege", "titel"):
        op.add_column(
            "document_aenderungsantraege",
            sa.Column("titel", sa.String(500), nullable=True),
        )
    if not _table_exists(conn, "document_aenderungen"):
        op.create_table(
            "document_aenderungen",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("aenderungsantrag_id", sa.Integer(), nullable=False),
            sa.Column("position", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("bezug", sa.String(255), nullable=True),
            sa.Column("alte_fassung", sa.Text(), nullable=True),
            sa.Column("neue_fassung", sa.Text(), nullable=True),
            sa.Column("aenderungstext", sa.Text(), nullable=True),
            sa.ForeignKeyConstraint(
                ["aenderungsantrag_id"],
                ["document_aenderungsantraege.id"],
                ondelete="CASCADE",
            ),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_document_aenderungen_aenderungsantrag_id",
            "document_aenderungen",
            ["aenderungsantrag_id"],
            unique=False,
        )


def downgrade() -> None:
    op.drop_index("ix_document_aenderungen_aenderungsantrag_id", table_name="document_aenderungen")
    op.drop_table("document_aenderungen")
    op.drop_column("document_aenderungsantraege", "titel")
