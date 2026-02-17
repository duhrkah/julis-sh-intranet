"""Tests for authentication API endpoints."""
from tests.conftest import auth_header


class TestLogin:
    def test_login_success(self, client, admin_user):
        response = client.post(
            "/api/v1/auth/login",
            data={"username": "testadmin", "password": "TestPass123"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password(self, client, admin_user):
        response = client.post(
            "/api/v1/auth/login",
            data={"username": "testadmin", "password": "WrongPass1"},
        )
        assert response.status_code == 401

    def test_login_nonexistent_user(self, client, admin_user):
        response = client.post(
            "/api/v1/auth/login",
            data={"username": "nouser", "password": "Pass1234"},
        )
        assert response.status_code == 401


class TestMe:
    def test_get_current_user(self, client, admin_user, admin_token):
        response = client.get("/api/v1/auth/me", headers=auth_header(admin_token))
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "testadmin"
        assert data["role"] == "admin"

    def test_me_without_token(self, client):
        response = client.get("/api/v1/auth/me")
        assert response.status_code == 401

    def test_me_with_invalid_token(self, client):
        response = client.get(
            "/api/v1/auth/me",
            headers=auth_header("invalid.token.here"),
        )
        assert response.status_code == 401
