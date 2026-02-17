"""Development seed: Admin, LV, alle Kreisverbände, Test-User (leitung/vorstand/mitarbeiter), oeffentlich."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.database import SessionLocal, engine, Base
from app.models import *
from app.core.security import get_password_hash


def run_seed_dev():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Admin
        if not db.query(User).filter(User.username == "admin").first():
            admin = User(
                username="admin",
                email="admin@julis-sh.de",
                full_name="Administrator",
                password_hash=get_password_hash("admin"),
                role="admin",
                is_active=True,
            )
            db.add(admin)
            db.flush()

        # Tenants: LV + Kreisverbände
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

            kreise = [
                ("Dithmarschen", "hei"),
                ("Flensburg", "fl"),
                ("Herzogtum-Lauenburg", "rz"),
                ("Kiel", "ki"),
                ("Lübeck", "hl"),
                ("Neumünster", "nms"),
                ("Nordfriesland", "nf"),
                ("Ostholstein", "oh"),
                ("Pinneberg", "pi"),
                ("Plön", "pl"),
                ("Rendsburg-Eckernförde", "re"),
                ("Schleswig-Flensburg", "sf"),
                ("Steinburg", "st"),
                ("Stormarn", "sm"),
            ]
            for name, slug in kreise:
                kv_tenant = Tenant(
                    name=f"JuLis {name}",
                    slug=f"julis-{slug}",
                    level="kreisverband",
                    parent_id=lv.id,
                    is_active=True,
                )
                db.add(kv_tenant)
                db.flush()
                kv = Kreisverband(
                    name=f"KV {name}",
                    kuerzel=slug.upper(),
                    ist_aktiv=True,
                    tenant_id=kv_tenant.id,
                )
                db.add(kv)

            admin = db.query(User).filter(User.username == "admin").first()
            if admin:
                admin.tenant_id = lv.id

            # Test-User (nur Dev)
            test_users = [
                ("leitung", "leitung@julis-sh.de", "Leitung User", "leitung", lv.id),
                ("vorstand", "vorstand@julis-sh.de", "Vorstand User", "vorstand", lv.id),
                ("mitarbeiter", "mitarbeiter@julis-sh.de", "Mitarbeiter User", "mitarbeiter", lv.id),
            ]
            for username, email, full_name, role, tenant_id in test_users:
                if not db.query(User).filter(User.username == username).first():
                    user = User(
                        username=username,
                        email=email,
                        full_name=full_name,
                        password_hash=get_password_hash(username),
                        role=role,
                        is_active=True,
                        tenant_id=tenant_id,
                    )
                    db.add(user)

        # User für öffentliche Termin-Einreichung
        lv = db.query(Tenant).filter(Tenant.parent_id.is_(None)).first()
        if not db.query(User).filter(User.username == "oeffentlich").first() and lv:
            oeffentlich = User(
                username="oeffentlich",
                email="kalender@julis-sh.de",
                full_name="Öffentliche Einreichung",
                password_hash=get_password_hash("oeffentlich"),
                role="mitarbeiter",
                is_active=True,
                tenant_id=lv.id,
            )
            db.add(oeffentlich)

        db.commit()
        print("Dev seed completed.")
        pub = db.query(User).filter(User.username == "oeffentlich").first()
        if pub:
            print(f"  → PUBLIC_SUBMITTER_USER_ID={pub.id}")

    except Exception as e:
        db.rollback()
        raise
    finally:
        db.close()
