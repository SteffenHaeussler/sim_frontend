import os
from pathlib import Path
from typing import Tuple, Type

from pydantic import BaseModel, Field
from pydantic_settings import (
    BaseSettings,
    PydanticBaseSettingsSource,
    SettingsConfigDict,
    TomlConfigSettingsSource,
)


class Deployment(BaseModel):
    CONFIG_NAME: str
    DEBUG: bool
    VERSION: str = "0.1.0"

    # Authentication settings
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 8
    JWT_REFRESH_EXPIRATION_DAYS: int = 7
    SESSION_TIMEOUT_MINUTES: int = 15

    # Database settings
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str = "organisation"
    DB_USER: str = "postgres"

    @property
    def database_url(self) -> str:
        """Get database URL with password from environment"""
        db_password = os.getenv("PGPASSWORD", "")
        return f"postgresql+asyncpg://{self.DB_USER}:{db_password}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    @property
    def sync_database_url(self) -> str:
        """Get synchronous database URL for migrations"""
        db_password = os.getenv("PGPASSWORD", "")
        return f"postgresql://{self.DB_USER}:{db_password}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"


class Config(BaseSettings):
    _toml_file: str = "config.toml"

    FASTAPI_ENV: str = Field(default="DEV")
    BASEDIR: str = str(Path(__file__).resolve().parent)
    ROOTDIR: str = str(Path(__file__).resolve().parents[2])
    VERSION: str = "0.1.0"

    DEV: Deployment
    PROD: Deployment
    STAGE: Deployment
    TEST: Deployment

    model_config = SettingsConfigDict(toml_file=[_toml_file], env_prefix="")
    lookup_assets: list = []

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: Type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> Tuple[PydanticBaseSettingsSource, ...]:
        return (
            init_settings,
            env_settings,
            TomlConfigSettingsSource(settings_cls),
        )

    @property
    def api_mode(self) -> Deployment:
        return dict(self).get(self.FASTAPI_ENV)

    @property
    def current_version(self) -> str:
        return (
            self.api_mode.VERSION if hasattr(self.api_mode, "VERSION") else self.VERSION
        )


# Global config instance
_config = None


def get_config() -> Config:
    """Get the global config instance"""
    global _config
    if _config is None:
        # Set the TOML file path relative to project root
        Config._toml_file = str(Path(__file__).resolve().parents[2] / "config.toml")
        _config = Config()
    return _config
