import json
import os
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from src.app.config import Config
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
    """Create test configuration"""
    config_data = {
        "FASTAPI_ENV": "TEST",
        "VERSION": "0.1.0-test",
        "TEST": {
            "CONFIG_NAME": "TEST",
            "DEBUG": True
        },
        "DEV": {
            "CONFIG_NAME": "DEV", 
            "DEBUG": True
        },
        "PROD": {
            "CONFIG_NAME": "PROD",
            "DEBUG": False
        },
        "STAGE": {
            "CONFIG_NAME": "STAGE",
            "DEBUG": False
        }
    }
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.toml', delete=False) as f:
        import toml
        toml.dump(config_data, f)
        config_file = f.name
    
    # Mock the config file path
    with patch.object(Config, '_toml_file', config_file):
        config = Config()
        yield config
    
    # Cleanup
    os.unlink(config_file)


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
def app(test_config, mock_lookup_assets, mock_env):
    """Create FastAPI test application"""
    with patch('src.app.main.load_lookup_assets', return_value=mock_lookup_assets):
        application = get_application(test_config)
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