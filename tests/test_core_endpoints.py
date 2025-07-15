from unittest.mock import MagicMock, patch

import pytest
from fastapi import status


class TestHealthEndpoints:
    """Test health check endpoints"""

    def test_get_health(self, client):
        """Test GET /health endpoint"""
        response = client.get("/health")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "version" in data
        assert "timestamp" in data
        assert data["version"] == "0.1.0-test"

    def test_post_health(self, client):
        """Test POST /health endpoint"""
        response = client.post("/health")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "version" in data
        assert "timestamp" in data


class TestFrontendEndpoint:
    """Test frontend HTML endpoint"""

    def test_frontend_renders(self, client):
        """Test frontend HTML page renders"""
        response = client.get("/")
        assert response.status_code == status.HTTP_200_OK
        assert "text/html" in response.headers["content-type"]


class TestAgentEndpoint:
    """Test agent question endpoint"""

    def test_agent_question_success(self, client, mock_httpx_client, auth_headers):
        """Test successful agent question trigger"""
        mock_client, mock_sync_client = mock_httpx_client

        # Mock the sync client response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_sync_client.return_value.__enter__.return_value.get.return_value = mock_response

        response = client.get("/agent?question=test question", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "triggered"
        assert data["question"] == "test question"
        assert "session_id" in data

    def test_agent_question_missing_param(self, client, auth_headers):
        """Test agent endpoint without question parameter"""
        response = client.get("/agent", headers=auth_headers)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestAssetEndpoints:
    """Test asset-related API endpoints"""

    @pytest.mark.asyncio
    async def test_get_asset_info_success(self, client, auth_headers):
        """Test successful asset info retrieval"""
        with patch("src.app.services.asset_service.http_client_pool") as mock_pool:
            # Create a mock client with async get method
            mock_client = MagicMock()
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"id": "asset_001", "name": "Test Asset"}
            mock_response.raise_for_status = MagicMock()

            # Make get return the response directly (not async)
            async def mock_get(*args, **kwargs):
                return mock_response

            mock_client.get = mock_get
            mock_pool.get_client.return_value = mock_client

            response = client.get("/api/asset/asset_001", headers=auth_headers)
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["id"] == "asset_001"
            assert data["name"] == "Test Asset"

    @pytest.mark.asyncio
    async def test_get_neighbor_assets(self, client, auth_headers):
        """Test neighboring assets retrieval"""
        with patch("src.app.services.asset_service.http_client_pool") as mock_pool:
            mock_client = MagicMock()
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"neighbors": ["asset_002", "asset_003"]}
            mock_response.raise_for_status = MagicMock()

            async def mock_get(*args, **kwargs):
                return mock_response

            mock_client.get = mock_get
            mock_pool.get_client.return_value = mock_client

            response = client.get("/api/neighbor/asset_001", headers=auth_headers)
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "neighbors" in data
            assert len(data["neighbors"]) == 2

    @pytest.mark.asyncio
    async def test_get_name_from_id(self, client, auth_headers):
        """Test asset name retrieval by ID"""
        with patch("src.app.services.asset_service.http_client_pool") as mock_pool:
            mock_client = MagicMock()
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"name": "Temperature Sensor 1"}
            mock_response.raise_for_status = MagicMock()

            async def mock_get(*args, **kwargs):
                return mock_response

            mock_client.get = mock_get
            mock_pool.get_client.return_value = mock_client

            response = client.get("/api/name/asset_001", headers=auth_headers)
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["name"] == "Temperature Sensor 1"

    @pytest.mark.asyncio
    async def test_get_id_from_name(self, client, auth_headers):
        """Test asset ID retrieval by name"""
        with patch("src.app.services.asset_service.http_client_pool") as mock_pool:
            mock_client = MagicMock()
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"id": "asset_001"}
            mock_response.raise_for_status = MagicMock()

            async def mock_get(*args, **kwargs):
                return mock_response

            mock_client.get = mock_get
            mock_pool.get_client.return_value = mock_client

            response = client.get("/api/id/Temperature%20Sensor%201", headers=auth_headers)
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["id"] == "asset_001"


class TestLookupEndpoints:
    """Test lookup endpoints using local asset data"""

    def test_get_lookup_assets(self, client, auth_headers):
        """Test retrieving all lookup assets"""
        response = client.get("/lookup/assets", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "assets" in data
        assert "count" in data
        assert data["count"] == 3
        assert len(data["assets"]) == 3

    def test_search_assets_by_name(self, client, auth_headers):
        """Test searching assets by name"""
        response = client.get("/lookup/search?name=Temperature", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_count"] == 1
        assert data["assets"][0]["name"] == "Temperature Sensor 1"

    def test_search_assets_by_type(self, client, auth_headers):
        """Test searching assets by asset_type"""
        response = client.get("/lookup/search?asset_type=sensor", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_count"] == 1
        assert data["assets"][0]["asset_type"] == "sensor"

    def test_search_assets_pagination(self, client, auth_headers):
        """Test asset search with pagination"""
        response = client.get("/lookup/search?limit=2&page=1", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["limit"] == 2
        assert data["page"] == 1
        assert len(data["assets"]) == 2
        assert data["total_pages"] == 2

    def test_search_assets_no_results(self, client, auth_headers):
        """Test asset search with no matching results"""
        response = client.get("/lookup/search?name=NonExistent", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_count"] == 0
        assert len(data["assets"]) == 0


class TestErrorHandling:
    """Test error handling scenarios"""

    @pytest.mark.asyncio
    async def test_external_api_failure(self, client, auth_headers):
        """Test handling of external API failures - should return mock data"""
        with patch("src.app.services.asset_service.http_client_pool") as mock_pool:
            mock_client = MagicMock()

            # Make get raise an exception
            async def mock_get_error(*args, **kwargs):
                raise Exception("API Error")

            mock_client.get = mock_get_error
            mock_pool.get_client.return_value = mock_client

            response = client.get("/api/asset/asset_001", headers=auth_headers)
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            # Should return mock data instead of error
            assert "id" in data
            assert data["id"] == "asset_001"
            assert "name" in data
            assert "status" in data
            assert data["status"] == "active"
