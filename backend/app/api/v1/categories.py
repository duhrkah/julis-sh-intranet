"""Category CRUD endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.api.deps import get_db, get_tenant_filter, get_required_tenant_filter
from app.core.rbac import require_role
from app.models.category import Category
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse

router = APIRouter()


@router.get("/", response_model=List[CategoryResponse])
async def list_categories(
    tenant_id: Optional[int] = Query(None, description="Filter by tenant"),
    include_inactive: bool = Query(False, description="Include inactive categories"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("vorstand")),
):
    """List categories for accessible tenants."""
    tenant_ids = get_tenant_filter(db, current_user, tenant_id, include_children=True)
    if not tenant_ids:
        return []

    query = db.query(Category).filter(Category.tenant_id.in_(tenant_ids))
    if not include_inactive:
        query = query.filter(Category.is_active == True)

    query = query.order_by(Category.name)
    return query.all()


@router.post("/", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    category_data: CategoryCreate,
    tenant_id: int = Query(..., description="Tenant to create category for"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("vorstand")),
):
    """Create a new category for a specific tenant."""
    accessible = get_required_tenant_filter(db, current_user, tenant_id)
    if tenant_id not in accessible:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to this tenant")

    existing = db.query(Category).filter(
        Category.name == category_data.name,
        Category.tenant_id == tenant_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Category with this name already exists for this tenant")

    db_category = Category(
        name=category_data.name,
        color=category_data.color,
        description=category_data.description,
        tenant_id=tenant_id,
        created_by=current_user.id,
    )
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category


@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("vorstand")),
):
    """Get a single category by ID."""
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    tenant_ids = get_tenant_filter(db, current_user, include_children=True)
    if category.tenant_id not in tenant_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to this category")

    return category


@router.put("/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: int,
    category_data: CategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("vorstand")),
):
    """Update an existing category."""
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    tenant_ids = get_tenant_filter(db, current_user, include_children=True)
    if category.tenant_id not in tenant_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to this category")

    update_data = category_data.model_dump(exclude_unset=True)

    # Check for name uniqueness within tenant if name is being changed
    if "name" in update_data and update_data["name"] != category.name:
        existing = db.query(Category).filter(
            Category.name == update_data["name"],
            Category.tenant_id == category.tenant_id,
            Category.id != category_id,
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Category with this name already exists for this tenant")

    for field, value in update_data.items():
        setattr(category, field, value)

    db.commit()
    db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Kategorie löschen (Soft-Delete durch Deaktivieren). Nur Admin."""
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    tenant_ids = get_tenant_filter(db, current_user, include_children=True)
    if category.tenant_id not in tenant_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to this category")

    category.is_active = False
    db.commit()
    return None
