#!/bin/bash
set -e

echo "Creating tables if not present (so migrations have base schema)..."
python -c "
from app.database import engine, Base
from app.models import *
Base.metadata.create_all(bind=engine)
"

echo "Running database migrations..."
alembic upgrade head

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
