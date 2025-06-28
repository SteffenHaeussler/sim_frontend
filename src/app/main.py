# !/usr/bin/env python
import json
from pathlib import Path
from typing import Dict

from dotenv import load_dotenv

# Load environment variables FIRST, before any imports that use them
load_dotenv(".env")

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from loguru import logger

from src.app.auth import auth_router
from src.app.config import Config
from src.app.core import router as core_router
from src.app.logging import setup_logger
from src.app.meta import tags_metadata
from src.app.middleware import ApiUsageTracker, RequestTimer
from src.app.models.database import close_db, init_database_engine
from src.app.ratings import ratings_router

BASEDIR = Path(__file__).resolve().parent
ROOTDIR = BASEDIR.parents[1]


def load_lookup_assets() -> list:
    """Load lookup asset data from JSON file"""
    try:
        lookup_file = BASEDIR / "data" / "lookup_asset.json"
        with open(lookup_file, "r") as f:
            assets = json.load(f)
        logger.info(f"Loaded {len(assets)} lookup assets from {lookup_file}")
        return assets
    except Exception as e:
        logger.error(f"Failed to load lookup assets: {e}")
        return []


def get_application(config: Dict) -> FastAPI:
    """
    Create the FastAPI app.

    Params

    config_name: string
        sets specific config flags

    Returns:

    app: object
        fastapi app
    -------
    """
    request_timer = RequestTimer()
    usage_tracker = ApiUsageTracker()
    application = FastAPI(openapi_tags=tags_metadata)

    application.state = config
    # Ensure VERSION is available at state level for backward compatibility
    application.state.VERSION = config.current_version

    # Load lookup assets into application state
    application.state.lookup_assets = load_lookup_assets()

    # Initialize database connection
    init_database_engine()

    # Add startup and shutdown events
    @application.on_event("startup")
    async def startup_event():
        logger.info("Application startup - database connection initialized")

    @application.on_event("shutdown")
    async def shutdown_event():
        await close_db()
        logger.info("Application shutdown - database connection closed")

    application.middleware("http")(request_timer)
    application.middleware("http")(usage_tracker)

    application.include_router(core_router.core, tags=["core"])
    application.include_router(auth_router, tags=["authentication"])
    application.include_router(ratings_router, tags=["ratings"])

    # application.include_router(v1_router.v1, prefix="/v1", tags=["v1"])

    # Mount static files and templates
    application.mount(
        "/static", StaticFiles(directory=f"{BASEDIR}/core/static"), name="static"
    )

    # application.mount(
    #     "/v1/static", StaticFiles(directory=f"{BASEDIR}/v1/static"), name="v1_static"
    # )

    logger.info(f"API running in {config.api_mode.CONFIG_NAME} mode")
    return application


# ugly work around to set the toml file path
Config._toml_file = f"{ROOTDIR}/config.toml"
config = Config()

setup_logger(config.api_mode)
app = get_application(config)
