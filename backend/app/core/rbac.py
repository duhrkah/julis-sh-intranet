"""RBAC (Role-Based Access Control) system with 4 hierarchical roles"""
from fastapi import Depends, HTTPException, status
from app.models.user import User

# Rollen-Hierarchie: admin > leitung > vorstand > mitarbeiter
ROLE_HIERARCHY = {
    "admin": 4,
    "leitung": 3,
    "vorstand": 2,
    "mitarbeiter": 1,
}

VALID_ROLES = list(ROLE_HIERARCHY.keys())


def get_role_level(role: str) -> int:
    return ROLE_HIERARCHY.get(role, 0)


def has_min_role(user_role: str, min_role: str) -> bool:
    return get_role_level(user_role) >= get_role_level(min_role)


def require_role(min_role: str):
    """FastAPI Dependency: Prüft ob User mindestens die angegebene Rolle hat"""
    from app.api.deps import get_current_user

    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if not has_min_role(current_user.role, min_role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Mindestens die Rolle '{min_role}' ist erforderlich"
            )
        return current_user

    return role_checker


def require_admin():
    return require_role("admin")


def require_leitung():
    return require_role("leitung")


def require_vorstand():
    return require_role("vorstand")


def require_member_changes_access():
    """Nur Mitarbeiter, Leitung und Admin – Vorstand darf Mitgliederänderungen nicht aufrufen."""
    from app.api.deps import get_current_user

    async def checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in ("mitarbeiter", "leitung", "admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Zugriff auf Mitgliederänderungen nur für Mitarbeiter, Leitung oder Administrator",
            )
        return current_user

    return checker
