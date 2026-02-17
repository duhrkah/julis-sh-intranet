"""Tenant CRUD endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.api.deps import get_db, get_current_user, get_accessible_tenant_ids
from app.core.rbac import require_role
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.tenant import TenantCreate, TenantUpdate, TenantResponse, TenantTree

router = APIRouter()


@router.get("/", response_model=List[TenantResponse])
async def list_tenants(
    level: Optional[str] = Query(None, description="Filter by level"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List tenants accessible to the current user."""
    accessible_ids = get_accessible_tenant_ids(db, current_user)
    if not accessible_ids:
        return []

    query = db.query(Tenant).filter(
        Tenant.id.in_(accessible_ids),
        Tenant.is_active == True,
    )

    if level:
        query = query.filter(Tenant.level == level)

    query = query.order_by(Tenant.name)
    return query.all()


@router.get("/tree", response_model=List[TenantTree])
async def get_tenant_tree(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get tenant hierarchy as a tree structure."""
    accessible_ids = get_accessible_tenant_ids(db, current_user)
    if not accessible_ids:
        return []

    all_tenants = (
        db.query(Tenant)
        .filter(Tenant.id.in_(accessible_ids), Tenant.is_active == True)
        .all()
    )

    tenant_map = {t.id: t for t in all_tenants}
    roots = []

    for tenant in all_tenants:
        if tenant.parent_id is None or tenant.parent_id not in tenant_map:
            roots.append(tenant)

    def build_tree(tenant: Tenant) -> TenantTree:
        children_models = [t for t in all_tenants if t.parent_id == tenant.id]
        return TenantTree(
            id=tenant.id,
            name=tenant.name,
            slug=tenant.slug,
            description=tenant.description,
            level=tenant.level,
            parent_id=tenant.parent_id,
            is_active=tenant.is_active,
            logo_url=tenant.logo_url,
            primary_color=tenant.primary_color,
            created_at=tenant.created_at,
            updated_at=tenant.updated_at,
            children=[build_tree(c) for c in children_models],
        )

    return [build_tree(r) for r in roots]


@router.post("/", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
async def create_tenant(
    tenant_data: TenantCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Create a new tenant. Admin only."""
    existing = db.query(Tenant).filter(Tenant.slug == tenant_data.slug).first()
    if existing:
        raise HTTPException(status_code=400, detail="Tenant with this slug already exists")

    if tenant_data.parent_id is not None:
        parent = db.query(Tenant).filter(Tenant.id == tenant_data.parent_id).first()
        if not parent:
            raise HTTPException(status_code=400, detail="Parent tenant not found")

    db_tenant = Tenant(
        name=tenant_data.name,
        slug=tenant_data.slug,
        description=tenant_data.description,
        level=tenant_data.level,
        parent_id=tenant_data.parent_id,
        is_active=tenant_data.is_active,
        logo_url=tenant_data.logo_url,
        primary_color=tenant_data.primary_color,
    )
    db.add(db_tenant)
    db.commit()
    db.refresh(db_tenant)
    return db_tenant


@router.get("/{tenant_id}", response_model=TenantResponse)
async def get_tenant(
    tenant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single tenant by ID."""
    accessible_ids = get_accessible_tenant_ids(db, current_user)
    if tenant_id not in accessible_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to this tenant")

    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    return tenant


@router.put("/{tenant_id}", response_model=TenantResponse)
async def update_tenant(
    tenant_id: int,
    tenant_data: TenantUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Update a tenant. Admin only."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    update_data = tenant_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(tenant, field, value)

    db.commit()
    db.refresh(tenant)
    return tenant


@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tenant(
    tenant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Deactivate a tenant. Admin only."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Check for child tenants
    children = db.query(Tenant).filter(Tenant.parent_id == tenant_id, Tenant.is_active == True).count()
    if children > 0:
        raise HTTPException(status_code=400, detail="Cannot deactivate tenant with active child tenants")

    tenant.is_active = False
    db.commit()
    return None
