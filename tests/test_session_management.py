import pytest
from fastapi import status
from unittest.mock import patch, MagicMock


class TestSessionManagement:
    """Test session ID generation and management"""
    
    def test_agent_endpoint_generates_session_id(self, client, auth_headers, mock_httpx_client):
        """Test that agent endpoint generates a session ID when not provided"""
        mock_client, mock_sync_client = mock_httpx_client
        
        # Mock the sync client response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_sync_client.return_value.__enter__.return_value.get.return_value = mock_response
        
        response = client.get("/agent?question=test question", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "session_id" in data
        assert len(data["session_id"]) > 0
        
    def test_agent_endpoint_accepts_custom_session_id(self, client, auth_headers, mock_httpx_client):
        """Test that agent endpoint accepts a custom session ID"""
        mock_client, mock_sync_client = mock_httpx_client
        
        # Mock the sync client response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_sync_client.return_value.__enter__.return_value.get.return_value = mock_response
        
        custom_session_id = "custom-session-123"
        response = client.get(
            f"/agent?question=test question&session_id={custom_session_id}", 
            headers=auth_headers
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["session_id"] == custom_session_id
        
    def test_asset_endpoints_support_session_id(self, client, auth_headers, mock_httpx_client):
        """Test that asset endpoints support session ID parameter"""
        mock_client, _ = mock_httpx_client
        
        # Mock async client response
        mock_response = MagicMock()
        mock_response.json.return_value = {"id": "asset_001", "name": "Test Asset"}
        mock_response.raise_for_status = MagicMock()
        mock_client.return_value.__aenter__.return_value.get.return_value = mock_response
        
        custom_session_id = "test-session-456"
        response = client.get(
            f"/api/asset/asset_001?session_id={custom_session_id}", 
            headers=auth_headers
        )
        assert response.status_code == status.HTTP_200_OK
        
    def test_lookup_endpoints_support_session_id(self, client, auth_headers):
        """Test that lookup endpoints support session ID parameter"""
        custom_session_id = "lookup-session-789"
        response = client.get(
            f"/lookup/assets?session_id={custom_session_id}", 
            headers=auth_headers
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "assets" in data


class TestFrontendTemplateContext:
    """Test frontend template context and configuration"""
    
    def test_frontend_includes_environment_variables(self, client, mock_env):
        """Test that frontend template includes environment variables"""
        response = client.get("/")
        assert response.status_code == status.HTTP_200_OK
        
        # Check that the response contains JavaScript with environment variables
        content = response.text
        assert "window.ENV" in content
        assert "AGENT_WS_BASE" in content
        assert "AGENT_URL" in content
        
    def test_frontend_includes_organisation_name(self, client):
        """Test that frontend template includes organisation name"""
        with patch('src.app.config.config_service.organisation_name', "Test Organization"):
            response = client.get("/")
            assert response.status_code == status.HTTP_200_OK
            
            content = response.text
            assert "Test Organization" in content


class TestResetPasswordPage:
    """Test password reset page endpoint"""
    
    def test_reset_password_page_renders(self, client):
        """Test that password reset page renders successfully"""
        response = client.get("/reset-password")
        assert response.status_code == status.HTTP_200_OK
        assert "text/html" in response.headers["content-type"]
        
    def test_reset_password_page_includes_organisation_name(self, client):
        """Test that reset password page includes organisation name"""
        with patch('src.app.config.config_service.organisation_name', "Test Company"):
            response = client.get("/reset-password")
            assert response.status_code == status.HTTP_200_OK
            
            content = response.text
            assert "Test Company" in content