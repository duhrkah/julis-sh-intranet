"""Tests for calendar event API endpoints and role-based access."""
from tests.conftest import auth_header


class TestListEvents:
    def test_authenticated_user_can_list_events(self, client, mitarbeiter_user, mitarbeiter_token):
        response = client.get("/api/v1/events/", headers=auth_header(mitarbeiter_token))
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_unauthenticated_cannot_list_events(self, client):
        response = client.get("/api/v1/events/")
        assert response.status_code == 401


class TestPublicEndpoints:
    def test_public_calendars_no_auth_needed(self, client):
        response = client.get("/api/v1/public/calendars")
        assert response.status_code == 200

    def test_public_events_no_auth_needed(self, client):
        response = client.get("/api/v1/public/events")
        assert response.status_code == 200

    def test_public_categories_no_auth_needed(self, client):
        response = client.get("/api/v1/public/categories")
        assert response.status_code == 200
