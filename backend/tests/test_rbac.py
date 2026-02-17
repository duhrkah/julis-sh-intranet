"""Tests for RBAC (Role-Based Access Control) system."""
from app.core.rbac import get_role_level, has_min_role, ROLE_HIERARCHY, VALID_ROLES


class TestRoleHierarchy:
    def test_admin_is_highest(self):
        assert get_role_level("admin") == max(ROLE_HIERARCHY.values())

    def test_mitarbeiter_is_lowest(self):
        assert get_role_level("mitarbeiter") == min(ROLE_HIERARCHY.values())

    def test_hierarchy_order(self):
        assert get_role_level("admin") > get_role_level("leitung")
        assert get_role_level("leitung") > get_role_level("vorstand")
        assert get_role_level("vorstand") > get_role_level("mitarbeiter")

    def test_unknown_role_returns_zero(self):
        assert get_role_level("unknown") == 0

    def test_valid_roles_contains_all(self):
        assert "admin" in VALID_ROLES
        assert "leitung" in VALID_ROLES
        assert "vorstand" in VALID_ROLES
        assert "mitarbeiter" in VALID_ROLES


class TestHasMinRole:
    def test_admin_has_all_roles(self):
        for role in VALID_ROLES:
            assert has_min_role("admin", role)

    def test_mitarbeiter_only_has_own_role(self):
        assert has_min_role("mitarbeiter", "mitarbeiter")
        assert not has_min_role("mitarbeiter", "vorstand")
        assert not has_min_role("mitarbeiter", "leitung")
        assert not has_min_role("mitarbeiter", "admin")

    def test_vorstand_has_vorstand_and_below(self):
        assert has_min_role("vorstand", "mitarbeiter")
        assert has_min_role("vorstand", "vorstand")
        assert not has_min_role("vorstand", "leitung")

    def test_same_role_passes(self):
        for role in VALID_ROLES:
            assert has_min_role(role, role)
