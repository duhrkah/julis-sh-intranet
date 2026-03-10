"""supporter_members table for Fördermitglieder

Revision ID: 20250310_sup_mem
Revises: 20250227_app_set
Create Date: 2025-03-10

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision = "20250310_sup_mem"
down_revision = "20250227_app_set"
branch_labels = None
depends_on = None


def _table_exists(conn, table: str) -> bool:
    if conn.dialect.name != "sqlite":
        return False
    r = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name=:t"), {"t": table})
    return r.fetchone() is not None


def upgrade() -> None:
    conn = op.get_bind()
    if not _table_exists(conn, "supporter_members"):
        op.create_table(
            "supporter_members",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("geschlecht", sa.String(20), nullable=False),
            sa.Column("titel", sa.String(50), nullable=True),
            sa.Column("vorname", sa.String(255), nullable=False),
            sa.Column("nachname", sa.String(255), nullable=False),
            sa.Column("kreisverband_id", sa.Integer(), sa.ForeignKey("kreisverband.id", ondelete="SET NULL"), nullable=True),
            sa.Column("beitragshoehe", sa.Numeric(10, 2), nullable=False),
            sa.Column("stufe", sa.String(50), nullable=False),
            sa.Column("verwendungszweck", sa.String(500), nullable=True),
            sa.Column("iban", sa.String(34), nullable=True),
            sa.Column("bankinstitut", sa.String(255), nullable=True),
            sa.Column("strasse_hausnummer", sa.String(255), nullable=True),
            sa.Column("plz", sa.String(10), nullable=True),
            sa.Column("ort", sa.String(255), nullable=True),
            sa.Column("telefon", sa.String(50), nullable=True),
            sa.Column("mobilnummer", sa.String(50), nullable=True),
            sa.Column("email", sa.String(255), nullable=True),
            sa.Column("ist_aktiv", sa.Boolean(), nullable=False, server_default=sa.text("1")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_supporter_members_id", "supporter_members", ["id"])
        op.create_index("ix_supporter_members_nachname", "supporter_members", ["nachname"])
        op.create_index("ix_supporter_members_kreisverband_id", "supporter_members", ["kreisverband_id"])


def downgrade() -> None:
    op.drop_index("ix_supporter_members_kreisverband_id", table_name="supporter_members")
    op.drop_index("ix_supporter_members_nachname", table_name="supporter_members")
    op.drop_index("ix_supporter_members_id", table_name="supporter_members")
    op.drop_table("supporter_members")
