import os


class ConfigurationError(Exception):
    """Raised when required configuration is missing"""

    pass


class ConfigService:
    """Centralized configuration management service"""

    def __init__(self):
        # Agent/External API Configuration
        self.agent_ws_base = self._get_optional("agent_ws_base", "")
        self.agent_url = self._get_optional("agent_url", "")
        self.agent_base = self._get_optional("agent_base", "")

        # Asset API Configuration
        self.api_base = self._get_optional("api_base", "")
        self.api_asset_url = self._get_optional("api_asset_url", "")
        self.api_neighbor_url = self._get_optional("api_neighbor_url", "")
        self.api_name_url = self._get_optional("api_name_url", "")
        self.api_id_url = self._get_optional("api_id_url", "")

        # Semantic Search Configuration
        self.semantic_base = self._get_optional("semantic_base", "")
        self.semantic_emb_url = self._get_optional("semantic_emb_url", "")
        self.semantic_search_url = self._get_optional("semantic_search_url", "")
        self.semantic_rank_url = self._get_optional("semantic_rank_url", "")
        self.semantic_table = self._get_optional("semantic_table", "")

        # Email Configuration
        self.smtp_host = self._get_optional("smtp_host")
        self.smtp_port = int(self._get_optional("smtp_port", "587"))
        self.sender_email = self._get_optional("sender_email")
        self.app_password = self._get_optional("app_password")

        # Organization Configuration
        self.organisation_name = self._get_optional(
            "organisation_name", "Company"
        ).title()

    def _get_required(self, key: str) -> str:
        """Get required configuration value"""
        value = os.getenv(key)
        if not value:
            raise ConfigurationError(f"Missing required configuration: {key}")
        return value

    def _get_optional(self, key: str, default: str = "") -> str:
        """Get optional configuration value with default"""
        return os.getenv(key, default)

    def get_agent_api_url(self) -> str:
        """Get complete agent API URL"""
        return f"{self.agent_base}{self.agent_url}"

    def get_asset_api_url(self, endpoint: str) -> str:
        """Get complete asset API URL for specific endpoint"""
        endpoint_map = {
            "asset": self.api_asset_url,
            "neighbor": self.api_neighbor_url,
            "name": self.api_name_url,
            "id": self.api_id_url,
        }

        if endpoint not in endpoint_map:
            raise ValueError(f"Unknown asset endpoint: {endpoint}")

        return f"{self.api_base}{endpoint_map[endpoint]}"

    def get_semantic_api_url(self, endpoint: str) -> str:
        """Get complete semantic API URL for specific endpoint"""
        endpoint_map = {
            "embedding": self.semantic_emb_url,
            "search": self.semantic_search_url,
            "ranking": self.semantic_rank_url,
        }

        if endpoint not in endpoint_map:
            raise ValueError(f"Unknown semantic endpoint: {endpoint}")

        return f"{self.semantic_base}{endpoint_map[endpoint]}"

    def is_smtp_configured(self) -> bool:
        """Check if SMTP is properly configured"""
        return all([self.smtp_host, self.sender_email, self.app_password])


# Global config service instance
config_service = ConfigService()
