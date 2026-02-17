"""API dependencies for database and authentication"""
from typing import Generator, Optional, List
from fastapi import Depends, HTTPException, status, Header, Query
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.user import User
from app.models.tenant import Tenant
from app.core.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    user_id: Optional[int] = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )

    return user


def get_tenant_filter(
    db: Session,
    user: User,
    requested_tenant_id: Optional[int] = None,
    include_children: bool = False
) -> List[int]:
    from app.core.rbac import has_min_role
    if has_min_role(user.role, "admin"):
        if requested_tenant_id is not None:
            return [requested_tenant_id]
        all_tenants = db.query(Tenant.id).all()
        return [t.id for t in all_tenants]

    if user.tenant_id is None:
        return []

    visible_ids = [user.tenant_id]

    if include_children:
        visible_ids.extend(_get_all_child_tenant_ids(db, user.tenant_id))

    if requested_tenant_id is not None:
        if requested_tenant_id in visible_ids:
            return [requested_tenant_id]
        return []

    return visible_ids


def get_required_tenant_filter(
    db: Session,
    user: User,
    requested_tenant_id: Optional[int] = None,
    include_children: bool = False
) -> List[int]:
    tenant_ids = get_tenant_filter(db, user, requested_tenant_id, include_children)
    if not tenant_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tenant access"
        )
    return tenant_ids


def _get_all_child_tenant_ids(db: Session, tenant_id: int) -> List[int]:
    child_ids = []
    children = db.query(Tenant).filter(Tenant.parent_id == tenant_id).all()
    for child in children:
        child_ids.append(child.id)
        child_ids.extend(_get_all_child_tenant_ids(db, child.id))
    return child_ids


def get_accessible_tenant_ids(db: Session, user: User) -> List[int]:
    from app.core.rbac import has_min_role
    if has_min_role(user.role, "admin"):
        all_tenants = db.query(Tenant.id).filter(Tenant.is_active == True).all()
        return [t.id for t in all_tenants]

    if user.tenant_id is None:
        return []

    accessible = [user.tenant_id]
    accessible.extend(_get_all_child_tenant_ids(db, user.tenant_id))
    return accessible


async def get_tenant_context(
    tenant_slug: Optional[str] = Header(None, alias="X-Tenant-Slug"),
    tenant_id: Optional[int] = Query(None, description="Tenant ID filter"),
    db: Session = Depends(get_db)
) -> Optional[int]:
    if tenant_slug:
        tenant = db.query(Tenant).filter(
            Tenant.slug == tenant_slug,
            Tenant.is_active == True
        ).first()
        if tenant:
            return tenant.id
    if tenant_id:
        return tenant_id
    return None


async def get_visible_tenant_ids_for_public(
    tenant_id: Optional[int] = Depends(get_tenant_context),
    db: Session = Depends(get_db)
) -> List[int]:
    if tenant_id is None:
        tenants = db.query(Tenant.id).filter(Tenant.is_active == True).all()
        return [t.id for t in tenants]
    visible_ids = [tenant_id]
    visible_ids.extend(_get_all_child_tenant_ids(db, tenant_id))
    return visible_ids


def get_public_calendar_tenant_ids(
    db: Session,
    calendar: Optional[str],
) -> List[int]:
    """
    Für öffentliche Kalenderansicht: tenant_ids nach Kalender-Typ filtern.
    - landesverband: nur Root-Tenants (parent_id is None) = Landesverband
    - kreisverband: nur Tenants mit parent_id gesetzt = Kreisverbände
    - sonst: alle aktiven Tenants
    """
    if calendar == "landesverband":
        rows = (
            db.query(Tenant.id)
            .filter(Tenant.parent_id.is_(None), Tenant.is_active == True)
            .all()
        )
        return [r.id for r in rows]
    if calendar == "kreisverband":
        rows = (
            db.query(Tenant.id)
            .filter(Tenant.parent_id.isnot(None), Tenant.is_active == True)
            .all()
        )
        return [r.id for r in rows]
    rows = db.query(Tenant.id).filter(Tenant.is_active == True).all()
    return [r.id for r in rows]


def is_tenant_kreisverband(db: Session, tenant_id: int) -> bool:
    """True, wenn Tenant ein Kreisverband ist (hat parent)."""
    t = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    return t is not None and t.parent_id is not None


def is_tenant_landesverband(db: Session, tenant_id: int) -> bool:
    """True, wenn Tenant Landesverband ist (Root)."""
    t = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    return t is not None and t.parent_id is None
