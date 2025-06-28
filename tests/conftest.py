import json
import os
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from src.app.config import ConfigService, get_config_service
from src.app.main import get_application


@pytest.fixture
def mock_env():
    """Mock environment variables for testing"""
    env_vars = {
        "agent_ws_base": "ws://test.example.com",
        "agent_url": "/test/agent",
        "agent_base": "http://test.example.com",
        "api_base": "http://api.test.com",
        "api_asset_url": "/assets",
        "api_neighbor_url": "/neighbors", 
        "api_name_url": "/names",
        "api_id_url": "/ids",
    }
    with patch.dict(os.environ, env_vars):
        yield env_vars


@pytest.fixture
def test_config():
    """Create test configuration with mocked environment variables"""
    test_env_vars = {
        "FASTAPI_ENV": "TEST",
        "VERSION": "0.1.0-test",
        "DEBUG": "true",
        "CONFIG_NAME": "TEST",
        "JWT_SECRET_KEY": "test-secret-key",
        "JWT_ALGORITHM": "HS256",
        "JWT_EXPIRATION_HOURS": "24",
        "DB_USER": "test_user",
        "DB_HOST": "localhost",
        "DB_PORT": "5432",
        "DB_NAME": "test_db",
        "PGPASSWORD": "test_password",
        "agent_ws_base": "ws://test.example.com",
        "agent_url": "/test/agent",
        "agent_base": "http://test.example.com",
        "api_base": "http://api.test.com",
        "api_asset_url": "/assets",
        "api_neighbor_url": "/neighbors",
        "api_name_url": "/names",
        "api_id_url": "/ids",
        "semantic_base": "http://semantic.test.com",
        "semantic_emb_url": "/embedding",
        "semantic_search_url": "/search",
        "semantic_rank_url": "/ranking",
        "semantic_table": "test_table",
        "smtp_host": "smtp.test.com",
        "smtp_port": "587",
        "sender_email": "test@example.com",
        "app_password": "test-password",
        "organisation_name": "Test Organization"
    }
    
    with patch.dict(os.environ, test_env_vars):
        # Reset the global config service
        import src.app.config
        src.app.config._config_service = None
        config = ConfigService()
        yield config


@pytest.fixture
def mock_lookup_assets():
    """Mock lookup assets data"""
    return [
        {
            "id": "asset_001",
            "name": "Temperature Sensor 1",
            "asset_type": "sensor",
            "type": "temperature"
        },
        {
            "id": "asset_002", 
            "name": "Pressure Valve 2",
            "asset_type": "valve",
            "type": "pressure"
        },
        {
            "id": "asset_003",
            "name": "Flow Meter 1", 
            "asset_type": "meter",
            "type": "flow"
        }
    ]


@pytest.fixture
def app(test_config, mock_lookup_assets):
    """Create FastAPI test application"""
    with patch('src.app.main.load_lookup_assets', return_value=mock_lookup_assets):
        # Set the global config for the application to use
        import src.app.config
        src.app.config._config_service = test_config
        application = get_application()
        yield application


@pytest.fixture
def client(app):
    """Create test client"""
    return TestClient(app)


@pytest.fixture
def mock_httpx_client():
    """Mock httpx client for external API calls"""
    with patch('httpx.AsyncClient') as mock_client, \
         patch('httpx.Client') as mock_sync_client:
        yield mock_client, mock_sync_client


@pytest.fixture
def mock_auth_token():
    """Mock authentication token for testing"""
    from src.app.auth.jwt_utils import TokenData
    
    # Mock the verify_token function to return valid token data
    mock_token_data = TokenData(
        user_id="test-user-123",
        email="test@example.com"
    )
    
    with patch('src.app.auth.dependencies.verify_token', return_value=mock_token_data):
        yield "mock-jwt-token"


@pytest.fixture
def auth_headers(mock_auth_token):
    """Create authorization headers for testing"""
    return {"Authorization": f"Bearer {mock_auth_token}"}