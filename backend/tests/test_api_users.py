"""Tests for user management API endpoints and RBAC enforcement."""
from tests.conftest import auth_header


class TestListUsers:
    def test_admin_can_list_users(self, client, admin_user, admin_token):
        response = client.get("/api/v1/users/", headers=auth_header(admin_token))
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_mitarbeiter_cannot_list_users(self, client, mitarbeiter_user, mitarbeiter_token):
        response = client.get("/api/v1/users/", headers=auth_header(mitarbeiter_token))
        assert response.status_code == 403

    def test_unauthenticated_cannot_list_users(self, client):
        response = client.get("/api/v1/users/")
        assert response.status_code == 401


class TestCreateUser:
    def test_admin_can_create_user(self, client, admin_user, admin_token, tenant):
        response = client.post(
            "/api/v1/users/",
            headers=auth_header(admin_token),
            json={
                "username": "newuser",
                "email": "new@test.de",
                "role": "mitarbeiter",
                "full_name": "New User",
                "tenant_id": tenant.id,
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["username"] == "newuser"
        assert data["role"] == "mitarbeiter"

    def test_vorstand_cannot_create_user(self, client, vorstand_user, vorstand_token, tenant):
        response = client.post(
            "/api/v1/users/",
            headers=auth_header(vorstand_token),
            json={
                "username": "anotheruser",
                "email": "another@test.de",
                "role": "mitarbeiter",
                "full_name": "Another User",
                "tenant_id": tenant.id,
            },
        )
        assert response.status_code == 403

    def test_duplicate_username_fails(self, client, admin_user, admin_token, tenant):
        client.post(
            "/api/v1/users/",
            headers=auth_header(admin_token),
            json={
                "username": "dupeuser",
                "email": "dupe1@test.de",
                "role": "mitarbeiter",
                "full_name": "Dupe User",
                "tenant_id": tenant.id,
            },
        )
        response = client.post(
            "/api/v1/users/",
            headers=auth_header(admin_token),
            json={
                "username": "dupeuser",
                "email": "dupe2@test.de",
                "role": "mitarbeiter",
                "full_name": "Dupe User 2",
                "tenant_id": tenant.id,
            },
        )
        assert response.status_code in (400, 409, 422, 500)


class TestHealthCheck:
    def test_health_returns_healthy(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"

    def test_root_returns_info(self, client):
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "JuLis" in data["message"]
