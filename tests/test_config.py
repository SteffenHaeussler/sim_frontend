import os
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

from src.app.config import Config
from src.app.main import get_application, load_lookup_assets


class TestConfiguration:
    """Test application configuration"""
    
    def test_config_loads_environments(self, test_config):
        """Test configuration loads all environments"""
        assert test_config.FASTAPI_ENV == "TEST"
        assert test_config.current_version == "0.1.0-test"
        assert hasattr(test_config, 'TEST')
        assert hasattr(test_config, 'DEV')
        assert hasattr(test_config, 'PROD')
        assert hasattr(test_config, 'STAGE')
    
    def test_config_api_mode_property(self, test_config):
        """Test api_mode property returns correct environment"""
        api_mode = test_config.api_mode
        assert api_mode.CONFIG_NAME == "TEST"
        assert api_mode.DEBUG is True
    
    def test_config_different_environments(self):
        """Test configuration with different FASTAPI_ENV values"""
        config_data = {
            "FASTAPI_ENV": "PROD",
            "VERSION": "1.0.0",
            "PROD": {"CONFIG_NAME": "PROD", "DEBUG": False},
            "DEV": {"CONFIG_NAME": "DEV", "DEBUG": True},
            "TEST": {"CONFIG_NAME": "TEST", "DEBUG": True},
            "STAGE": {"CONFIG_NAME": "STAGE", "DEBUG": False}
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.toml', delete=False) as f:
            import toml
            toml.dump(config_data, f)
            config_file = f.name
        
        try:
            with patch.object(Config, '_toml_file', config_file), \
                 patch.dict(os.environ, {"FASTAPI_ENV": "PROD"}, clear=False):
                config = Config()
                assert config.FASTAPI_ENV == "PROD"
                assert config.api_mode.CONFIG_NAME == "PROD"
                assert config.api_mode.DEBUG is False
        finally:
            os.unlink(config_file)


class TestApplicationSetup:
    """Test application initialization"""
    
    def test_app_creation_with_config(self, test_config):
        """Test FastAPI app creation with configuration"""
        with patch('src.app.main.load_lookup_assets', return_value=[]):
            app = get_application(test_config)
            assert app is not None
            assert hasattr(app, 'state')
            assert app.state.VERSION == "0.1.0-test"
    
    def test_load_lookup_assets_success(self):
        """Test successful loading of lookup assets"""
        test_data = [{"id": "test", "name": "Test Asset"}]
        
        # Create temporary JSON file in a temporary directory
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_file = Path(temp_dir) / "data" / "lookup_asset.json"
            temp_file.parent.mkdir(parents=True, exist_ok=True)
            
            with open(temp_file, 'w') as f:
                import json
                json.dump(test_data, f)
            
            # Mock BASEDIR to point to our temp directory
            with patch('src.app.main.BASEDIR', Path(temp_dir)):
                assets = load_lookup_assets()
                assert len(assets) == 1
                assert assets[0]["id"] == "test"
    
    def test_load_lookup_assets_file_not_found(self):
        """Test handling of missing lookup assets file"""
        with patch('src.app.main.BASEDIR', Path("/nonexistent")):
            assets = load_lookup_assets()
            assert assets == []


class TestEnvironmentVariables:
    """Test environment variable handling"""
    
    def test_missing_env_vars_handled_gracefully(self, client):
        """Test app handles missing environment variables"""
        with patch.dict(os.environ, {}, clear=True):
            response = client.get("/")
            assert response.status_code == 200
            # Should still render the page even with missing env vars
    
    def test_env_vars_passed_to_template(self, client, mock_env):
        """Test environment variables are passed to frontend template"""
        response = client.get("/")
        assert response.status_code == 200
        # Template should render successfully with env vars
        assert "text/html" in response.headers["content-type"]