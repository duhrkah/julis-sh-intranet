"""Shared fixtures for all tests."""
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.database import Base
from app.main import app
from app.api.deps import get_db
from app.core.security import get_password_hash, create_access_token
from app.models.user import User
from app.models.tenant import Tenant

# In-memory SQLite with StaticPool so all connections share the same DB
engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_database():
    """Create all tables before each test, drop after."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db(setup_database):
    """Get a test database session."""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db):
    """Get a test client with overridden DB dependency."""
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def tenant(db):
    """Create a test tenant."""
    t = Tenant(
        name="Test Landesverband",
        slug="test-lv",
        level="landesverband",
        is_active=True,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


@pytest.fixture
def admin_user(db, tenant):
    """Create an admin user."""
    user = User(
        username="testadmin",
        email="admin@test.de",
        password_hash=get_password_hash("TestPass123"),
        role="admin",
        full_name="Test Admin",
        is_active=True,
        tenant_id=tenant.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def vorstand_user(db, tenant):
    """Create a vorstand user."""
    user = User(
        username="testvorstand",
        email="vorstand@test.de",
        password_hash=get_password_hash("TestPass123"),
        role="vorstand",
        full_name="Test Vorstand",
        is_active=True,
        tenant_id=tenant.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def mitarbeiter_user(db, tenant):
    """Create a mitarbeiter user."""
    user = User(
        username="testmitarbeiter",
        email="mitarbeiter@test.de",
        password_hash=get_password_hash("TestPass123"),
        role="mitarbeiter",
        full_name="Test Mitarbeiter",
        is_active=True,
        tenant_id=tenant.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def admin_token(admin_user):
    """Get a valid JWT token for admin."""
    return create_access_token(data={"sub": str(admin_user.id)})


@pytest.fixture
def vorstand_token(vorstand_user):
    """Get a valid JWT token for vorstand."""
    return create_access_token(data={"sub": str(vorstand_user.id)})


@pytest.fixture
def mitarbeiter_token(mitarbeiter_user):
    """Get a valid JWT token for mitarbeiter."""
    return create_access_token(data={"sub": str(mitarbeiter_user.id)})


def auth_header(token: str) -> dict:
    """Helper to create Authorization header."""
    return {"Authorization": f"Bearer {token}"}
