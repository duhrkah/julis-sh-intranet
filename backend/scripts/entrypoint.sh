#!/bin/bash
set -e

echo "Creating tables if not present..."
python -c "
from app.database import engine, Base
from app.models import *
Base.metadata.create_all(bind=engine)
"

echo "Applying migrations or stamping fresh DB..."
python -c "
import subprocess
import sys
from sqlalchemy import text
from app.database import engine

with engine.connect() as conn:
    try:
        r = conn.execute(text(\"SELECT COUNT(*) FROM alembic_version\"))
        count = r.scalar()
    except Exception:
        count = 0
    if count == 0:
        print('Fresh DB: stamping head (no migrations run).')
        subprocess.check_call([sys.executable, '-m', 'alembic', 'stamp', 'head'])
    else:
        print('Existing DB: running migrations.')
        subprocess.check_call([sys.executable, '-m', 'alembic', 'upgrade', 'head'])
"

echo "Creating initial admin user if needed..."
python -c "
import os, secrets
from app.database import SessionLocal, engine, Base
from app.models import *
from app.core.security import get_password_hash

db = SessionLocal()
try:
    admin = db.query(User).filter(User.username == 'admin').first()
    if not admin:
        password = os.environ.get('ADMIN_INITIAL_PASSWORD') or secrets.token_urlsafe(24)
        admin = User(
            username='admin',
            email=os.environ.get('ADMIN_INITIAL_EMAIL', 'admin@julis-sh.de'),
            full_name='Administrator',
            password_hash=get_password_hash(password),
            role='admin',
            is_active=True,
        )
        db.add(admin)
        db.commit()
        if not os.environ.get('ADMIN_INITIAL_PASSWORD'):
            print(f'Admin user created (username: admin, password: {password})')
            print('WICHTIG: Dieses Passwort notieren und nach dem ersten Login aendern!')
        else:
            print('Admin user created (username: admin, password from ADMIN_INITIAL_PASSWORD)')
    else:
        print('Admin user already exists')
finally:
    db.close()
"

echo "Starting application..."
exec "$@"
