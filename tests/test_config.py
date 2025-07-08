import os
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

from src.app.config import ConfigService, ConfigurationError
from src.app.main import get_application, load_lookup_assets


class TestConfiguration:
    """Test application configuration"""

    def test_config_loads_basic_settings(self, test_config):
        """Test configuration loads basic settings"""
        assert test_config.fastapi_env == "TEST"
        assert test_config.version == "0.1.0-test"
        assert test_config.debug is True
        assert test_config.config_name == "TEST"

    def test_config_jwt_settings(self, test_config):
        """Test JWT configuration settings"""
        assert test_config.jwt_secret_key == "test-secret-key"
        assert test_config.jwt_algorithm == "HS256"
        assert test_config.jwt_expiration_hours == 24

    def test_config_database_settings(self, test_config):
        """Test database configuration settings"""
        assert test_config.db_user == "test_user"
        assert test_config.db_host == "localhost"
        assert test_config.db_port == 5432
        assert test_config.db_name == "test_db"
        assert test_config.db_password == "test_password"

    def test_config_agent_settings(self, test_config):
        """Test agent API configuration settings"""
        assert test_config.agent_ws_base == "ws://test.example.com"
        assert test_config.agent_url == "/test/agent"
        assert test_config.agent_base == "http://test.example.com"

    def test_config_missing_required_env_var(self):
        """Test configuration fails with missing required environment variable"""
        with patch.dict(os.environ, {}, clear=True):
            with pytest.raises(ConfigurationError, match="Missing required configuration"):
                ConfigService()

    def test_config_url_builders(self, test_config):
        """Test URL builder methods"""
        # Test agent API URL
        agent_url = test_config.get_agent_api_url()
        assert agent_url == "http://test.example.com/test/agent"

        # Test asset API URL
        asset_url = test_config.get_asset_api_url("asset")
        assert asset_url == "http://api.test.com/assets"

        # Test semantic API URL
        semantic_url = test_config.get_semantic_api_url("search")
        assert semantic_url == "http://semantic.test.com/search"


class TestApplicationSetup:
    """Test application initialization"""

    def test_app_creation_with_config(self, test_config):
        """Test FastAPI app creation with configuration"""
        with patch("src.app.main.load_lookup_assets", return_value=[]):
            # Set the global config for the application to use
            import src.app.config

            src.app.config._config_service = test_config
            app = get_application()
            assert app is not None
            assert hasattr(app, "state")
            assert app.state.VERSION == "0.1.0-test"

    def test_load_lookup_assets_success(self):
        """Test successful loading of lookup assets"""
        test_data = [{"id": "test", "name": "Test Asset"}]

        # Create temporary JSON file in a temporary directory
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_file = Path(temp_dir) / "data" / "lookup_asset.json"
            temp_file.parent.mkdir(parents=True, exist_ok=True)

            with open(temp_file, "w") as f:
                import json

                json.dump(test_data, f)

            # Mock BASEDIR to point to our temp directory
            with patch("src.app.main.BASEDIR", Path(temp_dir)):
                assets = load_lookup_assets()
                assert len(assets) == 1
                assert assets[0]["id"] == "test"

    def test_load_lookup_assets_file_not_found(self):
        """Test handling of missing lookup assets file"""
        with patch("src.app.main.BASEDIR", Path("/nonexistent")):
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

    def test_config_service_methods(self, test_config):
        """Test config service utility methods"""
        # Test JWT utils method
        jwt_config = test_config.get_jwt_utils()
        assert jwt_config["jwt_secret_key"] == "test-secret-key"
        assert jwt_config["jwt_expiration_hours"] == 24

        # Test database config method
        db_config = test_config.get_database()
        assert "postgresql+asyncpg://" in db_config["database_url"]

        # Test SMTP configuration check
        assert test_config.is_smtp_configured() is True
