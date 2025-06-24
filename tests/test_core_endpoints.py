import json
from unittest.mock import MagicMock

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
    
    def test_agent_question_success(self, client, mock_httpx_client):
        """Test successful agent question trigger"""
        mock_client, mock_sync_client = mock_httpx_client
        
        # Mock the sync client response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_sync_client.return_value.__enter__.return_value.get.return_value = mock_response
        
        response = client.get("/agent?question=test question")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "triggered"
        assert data["question"] == "test question"
        assert "session_id" in data
    
    def test_agent_question_missing_param(self, client):
        """Test agent endpoint without question parameter"""
        response = client.get("/agent")
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestAssetEndpoints:
    """Test asset-related API endpoints"""
    
    @pytest.mark.asyncio
    async def test_get_asset_info_success(self, client, mock_httpx_client):
        """Test successful asset info retrieval"""
        mock_client, _ = mock_httpx_client
        
        # Mock async client response
        mock_response = MagicMock()
        mock_response.json.return_value = {"id": "asset_001", "name": "Test Asset"}
        mock_response.raise_for_status = MagicMock()
        
        mock_client.return_value.__aenter__.return_value.get.return_value = mock_response
        
        response = client.get("/api/asset/asset_001")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == "asset_001"
    
    @pytest.mark.asyncio
    async def test_get_neighbor_assets(self, client, mock_httpx_client):
        """Test neighboring assets retrieval"""
        mock_client, _ = mock_httpx_client
        
        mock_response = MagicMock()
        mock_response.json.return_value = {"neighbors": ["asset_002", "asset_003"]}
        mock_response.raise_for_status = MagicMock()
        
        mock_client.return_value.__aenter__.return_value.get.return_value = mock_response
        
        response = client.get("/api/neighbor/asset_001")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "neighbors" in data
    
    @pytest.mark.asyncio
    async def test_get_name_from_id(self, client, mock_httpx_client):
        """Test asset name retrieval by ID"""
        mock_client, _ = mock_httpx_client
        
        mock_response = MagicMock()
        mock_response.json.return_value = {"name": "Temperature Sensor 1"}
        mock_response.raise_for_status = MagicMock()
        
        mock_client.return_value.__aenter__.return_value.get.return_value = mock_response
        
        response = client.get("/api/name/asset_001")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == "Temperature Sensor 1"
    
    @pytest.mark.asyncio
    async def test_get_id_from_name(self, client, mock_httpx_client):
        """Test asset ID retrieval by name"""
        mock_client, _ = mock_httpx_client
        
        mock_response = MagicMock()
        mock_response.json.return_value = {"id": "asset_001"}
        mock_response.raise_for_status = MagicMock()
        
        mock_client.return_value.__aenter__.return_value.get.return_value = mock_response
        
        response = client.get("/api/id/Temperature%20Sensor%201")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == "asset_001"


class TestLookupEndpoints:
    """Test lookup endpoints using local asset data"""
    
    def test_get_lookup_assets(self, client):
        """Test retrieving all lookup assets"""
        response = client.get("/lookup/assets")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "assets" in data
        assert "count" in data
        assert data["count"] == 3
        assert len(data["assets"]) == 3
    
    def test_search_assets_by_name(self, client):
        """Test searching assets by name"""
        response = client.get("/lookup/search?name=Temperature")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_count"] == 1
        assert data["assets"][0]["name"] == "Temperature Sensor 1"
    
    def test_search_assets_by_type(self, client):
        """Test searching assets by asset_type"""
        response = client.get("/lookup/search?asset_type=sensor")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_count"] == 1
        assert data["assets"][0]["asset_type"] == "sensor"
    
    def test_search_assets_pagination(self, client):
        """Test asset search with pagination"""
        response = client.get("/lookup/search?limit=2&page=1")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["limit"] == 2
        assert data["page"] == 1
        assert len(data["assets"]) == 2
        assert data["total_pages"] == 2
    
    def test_search_assets_no_results(self, client):
        """Test asset search with no matching results"""
        response = client.get("/lookup/search?name=NonExistent")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_count"] == 0
        assert len(data["assets"]) == 0


class TestErrorHandling:
    """Test error handling scenarios"""
    
    @pytest.mark.asyncio
    async def test_external_api_failure(self, client, mock_httpx_client):
        """Test handling of external API failures"""
        mock_client, _ = mock_httpx_client
        
        # Mock client to raise an exception
        mock_client.return_value.__aenter__.return_value.get.side_effect = Exception("API Error")
        
        response = client.get("/api/asset/asset_001")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "error" in data
        assert data["asset_id"] == "asset_001"