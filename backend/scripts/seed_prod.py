"""Production seed: Nur Admin, Landesverband-Tenant und User „oeffentlich“. Keine Test-User, keine Kreisverbände."""
import os
import secrets
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.database import SessionLocal, engine, Base
from app.models import *
from app.core.security import get_password_hash


def run_seed_prod():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    admin_password = os.environ.get("ADMIN_INITIAL_PASSWORD") or secrets.token_urlsafe(24)

    try:
        # Admin (Passwort aus Env oder einmalig generiert)
        if not db.query(User).filter(User.username == "admin").first():
            admin = User(
                username="admin",
                email=os.environ.get("ADMIN_INITIAL_EMAIL", "admin@julis-sh.de"),
                full_name="Administrator",
                password_hash=get_password_hash(admin_password),
                role="admin",
                is_active=True,
            )
            db.add(admin)
            db.flush()
            if not os.environ.get("ADMIN_INITIAL_PASSWORD"):
                print("  ! ADMIN_INITIAL_PASSWORD war nicht gesetzt – bitte dieses Passwort notieren und in den Einstellungen ändern:")
                print(f"  ! Admin-Passwort: {admin_password}")

        # Nur Landesverband-Tenant (keine Kreisverbände – werden in der Verwaltung angelegt)
        if not db.query(Tenant).first():
            lv = Tenant(
                name="JuLis Schleswig-Holstein",
                slug="julis-sh",
                level="landesverband",
                description="Landesverband Schleswig-Holstein",
                is_active=True,
            )
            db.add(lv)
            db.flush()
            admin = db.query(User).filter(User.username == "admin").first()
            if admin:
                admin.tenant_id = lv.id

        # User für öffentliche Termin-Einreichung
        lv = db.query(Tenant).filter(Tenant.parent_id.is_(None)).first()
        if not db.query(User).filter(User.username == "oeffentlich").first() and lv:
            oeffentlich = User(
                username="oeffentlich",
                email=os.environ.get("PUBLIC_SUBMITTER_EMAIL", "kalender@julis-sh.de"),
                full_name="Öffentliche Einreichung",
                password_hash=get_password_hash(secrets.token_urlsafe(32)),
                role="mitarbeiter",
                is_active=True,
                tenant_id=lv.id,
            )
            db.add(oeffentlich)

        db.commit()
        print("Prod seed completed.")
        pub = db.query(User).filter(User.username == "oeffentlich").first()
        if pub:
            print(f"  → PUBLIC_SUBMITTER_USER_ID={pub.id}")

    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close()
