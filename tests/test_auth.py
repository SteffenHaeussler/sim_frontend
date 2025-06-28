from unittest.mock import MagicMock

from fastapi import status


class TestAuthenticationEndpoints:
    """Test authentication-related endpoints"""

    def test_health_endpoint_no_auth_required(self, client):
        """Test that health endpoint doesn't require authentication"""
        response = client.get("/health")
        assert response.status_code == status.HTTP_200_OK

    def test_frontend_endpoint_no_auth_required(self, client):
        """Test that frontend endpoint doesn't require authentication"""
        response = client.get("/")
        assert response.status_code == status.HTTP_200_OK

    def test_agent_endpoint_requires_auth(self, client):
        """Test that agent endpoint requires authentication"""
        response = client.get("/agent?question=test")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_asset_endpoints_require_auth(self, client):
        """Test that asset endpoints require authentication"""
        endpoints = [
            "/api/asset/test_id",
            "/api/neighbor/test_id",
            "/api/name/test_id",
            "/api/id/test_name",
        ]

        for endpoint in endpoints:
            response = client.get(endpoint)
            assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_lookup_endpoints_require_auth(self, client):
        """Test that lookup endpoints require authentication"""
        endpoints = ["/lookup/assets", "/lookup/search"]

        for endpoint in endpoints:
            response = client.get(endpoint)
            assert response.status_code == status.HTTP_403_FORBIDDEN


class TestAuthenticationFlow:
    """Test authentication flow with valid tokens"""

    def test_agent_endpoint_with_valid_token(
        self, client, auth_headers, mock_httpx_client
    ):
        """Test agent endpoint with valid authentication"""
        mock_client, mock_sync_client = mock_httpx_client

        # Mock the sync client response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_sync_client.return_value.__enter__.return_value.get.return_value = (
            mock_response
        )

        response = client.get("/agent?question=test question", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "triggered"
        assert data["question"] == "test question"

    def test_lookup_assets_with_valid_token(self, client, auth_headers):
        """Test lookup assets endpoint with valid authentication"""
        response = client.get("/lookup/assets", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "assets" in data
        assert "count" in data

    def test_asset_search_with_valid_token(self, client, auth_headers):
        """Test asset search endpoint with valid authentication"""
        response = client.get("/lookup/search?name=test", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "assets" in data
        assert "total_count" in data


class TestTokenValidation:
    """Test token validation behavior"""

    def test_invalid_token_format(self, client):
        """Test endpoint with invalid token format"""
        headers = {"Authorization": "Bearer invalid-token"}
        response = client.get("/agent?question=test", headers=headers)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_missing_bearer_prefix(self, client):
        """Test endpoint with missing Bearer prefix"""
        headers = {"Authorization": "some-token"}
        response = client.get("/agent?question=test", headers=headers)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_empty_authorization_header(self, client):
        """Test endpoint with empty authorization header"""
        headers = {"Authorization": ""}
        response = client.get("/agent?question=test", headers=headers)
        assert response.status_code == status.HTTP_403_FORBIDDEN
