import os

from pydantic import BaseModel


class ConfigurationError(Exception):
    """Raised when required configuration is missing"""

    pass


class AppConfig(BaseModel):
    fastapi_env: str
    VERSION: str
    debug: bool
    config_name: str
    lookup_assets: list = []


class ConfigService:
    """Centralized configuration management service"""

    def __init__(self):
        # General APP Configuration
        self.fastapi_env = self._get_required("FASTAPI_ENV")
        self.version = self._get_required("VERSION")
        self.debug = bool(self._get_required("DEBUG"))
        self.config_name = self._get_required("CONFIG_NAME")
        self.lookup_assets = []

        # JWT Util Configuration
        self.jwt_secret_key = self._get_required("JWT_SECRET_KEY")
        self.jwt_algorithm = self._get_required("JWT_ALGORITHM")
        self.jwt_expiration_hours = int(self._get_required("JWT_EXPIRATION_HOURS"))
        self.jwt_access_expiration_minutes = int(
            self._get_required("JWT_ACCESS_EXPIRATION_MINUTES")
        )
        self.jwt_refresh_expiration_days = int(
            self._get_required("JWT_REFRESH_EXPIRATION_DAYS")
        )

        # Postgres DB Configuration
        self.db_user = self._get_required("DB_USER")
        self.db_host = self._get_required("DB_HOST")
        self.db_port = int(self._get_required("DB_PORT"))
        self.db_name = self._get_required("DB_NAME")
        self.db_password = self._get_required("PGPASSWORD")

        # Agent/External API Configuration
        self.agent_ws_base = self._get_required("agent_ws_base")
        self.agent_url = self._get_required("agent_url")
        self.agent_base = self._get_required("agent_base")

        # Asset API Configuration
        self.api_base = self._get_required("api_base")
        self.api_asset_url = self._get_required("api_asset_url")
        self.api_neighbor_url = self._get_required("api_neighbor_url")
        self.api_name_url = self._get_required("api_name_url")
        self.api_id_url = self._get_required("api_id_url")

        # Semantic Search Configuration
        self.semantic_base = self._get_required("semantic_base")
        self.semantic_emb_url = self._get_required("semantic_emb_url")
        self.semantic_search_url = self._get_required(
            "semantic_search_url",
        )
        self.semantic_rank_url = self._get_required("semantic_rank_url")
        self.semantic_table = self._get_required("semantic_table")

        # Email Configuration
        self.smtp_host = self._get_required("smtp_host")
        self.smtp_port = int(self._get_optional("smtp_port", "587"))
        self.sender_email = self._get_required("sender_email")
        self.app_password = self._get_required("app_password")

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

    def get_api_model(self):
        return AppConfig(
            fastapi_env=self.fastapi_env,
            VERSION=self.version,
            debug=self.debug,
            config_name=self.config_name,
        )

    def get_jwt_utils(self):
        return dict(
            jwt_algorithm=self.jwt_algorithm,
            jwt_secret_key=self.jwt_secret_key,
            jwt_expiration_hours=self.jwt_expiration_hours,
            jwt_access_expiration_minutes=self.jwt_access_expiration_minutes,
            jwt_refresh_expiration_days=self.jwt_refresh_expiration_days,
        )

    def get_database(self):
        database_url = f"postgresql+asyncpg://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"

        return dict(database_url=database_url)

    def get_sync_database(self):
        database_url = f"postgresql://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"

        return dict(database_url=database_url)


# Global config service instance - lazy initialization
_config_service = None


def get_config_service() -> ConfigService:
    """Get or create the global config service instance"""
    global _config_service
    if _config_service is None:
        _config_service = ConfigService()
    return _config_service


# For backward compatibility, create the instance on first access
class ConfigServiceProxy:
    """Proxy to lazy-load the config service"""

    def __getattr__(self, name):
        return getattr(get_config_service(), name)


config_service = ConfigServiceProxy()
