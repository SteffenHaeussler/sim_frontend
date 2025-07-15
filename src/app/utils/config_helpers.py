"""Configuration helper utilities for centralized config access"""

from functools import cached_property
from typing import Any

from src.app.config import config_service


class ConfigHelper:
    """Centralized configuration access helper"""

    def __init__(self):
        self._config = config_service

    @cached_property
    def api_urls(self) -> dict[str, str]:
        """Get all API URLs as a dictionary"""
        return {
            "agent": self._config.get_agent_api_url(),
            "sql_agent": self._config.get_sql_agent_api_url(),
            "scenario_agent": self._config.get_scenario_agent_api_url(),
            "asset": lambda endpoint: self._config.get_asset_api_url(endpoint),
            "semantic": lambda endpoint: self._config.get_semantic_api_url(endpoint),
        }

    @cached_property
    def smtp_config(self) -> dict[str, Any]:
        """Get SMTP configuration"""
        return {
            "host": self._config.smtp_host,
            "port": self._config.smtp_port,
            "username": self._config.sender_email,
            "password": self._config.app_password,
            "from_email": self._config.sender_email,
            "is_configured": self._config.is_smtp_configured(),
        }

    @cached_property
    def frontend_config(self) -> dict[str, str]:
        """Get frontend configuration for template context"""
        return {
            "agent_ws_base": self._config.agent_ws_base,
            "agent_url": self._config.agent_url,
            "agent_base": self._config.agent_base,
            "api_base": self._config.api_base,
            "api_asset_url": self._config.api_asset_url,
            "api_neighbor_url": self._config.api_neighbor_url,
            "api_name_url": self._config.api_name_url,
            "api_id_url": self._config.api_id_url,
            "semantic_base": self._config.semantic_base,
            "semantic_emb_url": self._config.semantic_emb_url,
            "semantic_rank_url": self._config.semantic_rank_url,
            "semantic_search_url": self._config.semantic_search_url,
            "organisation_name": self._config.organisation_name,
        }

    @property
    def database_config(self) -> dict[str, Any]:
        """Get database configuration"""
        db_config = self._config.get_database()
        return {
            "url": db_config.get("database_url"),
            "pool_size": db_config.get("pool_size", 5),
            "max_overflow": db_config.get("max_overflow", 10),
        }

    @property
    def jwt_config(self) -> dict[str, Any]:
        """Get JWT configuration"""
        jwt_config = self._config.get_jwt_utils()
        return {
            "secret_key": jwt_config.get("jwt_secret_key"),
            "algorithm": jwt_config.get("jwt_algorithm", "HS256"),
            "access_expiration_minutes": jwt_config.get("jwt_access_expiration_minutes", 15),
            "refresh_expiration_days": jwt_config.get("jwt_refresh_expiration_days", 7),
        }

    @property
    def app_info(self) -> dict[str, Any]:
        """Get application information"""
        return {
            "version": self._config.version,
            "config_name": self._config.config_name,
            "organisation_name": self._config.organisation_name,
        }

    @property
    def semantic_config(self) -> dict[str, Any]:
        """Get semantic search configuration"""
        return {
            "base_url": self._config.semantic_base,
            "table": self._config.semantic_table,
            "is_configured": bool(self._config.semantic_base),
        }

    def get_api_model(self) -> Any:
        """Get API model for application state"""
        return self._config.get_api_model()


# Global instance
config_helper = ConfigHelper()
