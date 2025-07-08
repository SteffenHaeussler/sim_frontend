# !/usr/bin/env python
import json
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

# Load environment variables FIRST, before any imports that use them
load_dotenv(".env")


from fastapi import FastAPI  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402
from loguru import logger  # noqa: E402

from src.app.auth import auth_router  # noqa: E402
from src.app.config import config_service  # noqa: E402
from src.app.core import router as core_router  # noqa: E402
from src.app.logging import setup_logger  # noqa: E402
from src.app.middleware import ApiUsageTracker, RequestTimer  # noqa: E402
from src.app.models.database import close_db, init_database_engine  # noqa: E402
from src.app.ratings import ratings_router  # noqa: E402

BASEDIR = Path(__file__).resolve().parent
ROOTDIR = BASEDIR.parents[1]


def load_lookup_assets() -> list:
    """Load lookup asset data from JSON file"""
    try:
        lookup_file = Path(BASEDIR / "data" / "lookup_asset.json")
        with open(lookup_file) as f:
            assets = json.load(f)
        logger.info(f"Loaded {len(assets)} lookup assets from {lookup_file}")
        return assets
    except Exception as e:
        logger.error(f"Failed to load lookup assets: {e}")
        return []


@asynccontextmanager
async def lifespan(_application: FastAPI):
    """Lifespan context manager for FastAPI application startup and shutdown events"""
    # Startup
    logger.info("Application startup - database connection initialized")
    yield
    # Shutdown
    await close_db()
    logger.info("Application shutdown - database connection closed")


def get_application() -> FastAPI:
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
    application = FastAPI(lifespan=lifespan)

    application.state = config_service.get_api_model()
    # Ensure VERSION is available at state level for backward compatibility

    # Load lookup assets into application state
    application.state.lookup_assets = load_lookup_assets()

    # Initialize database connection (skip in test environment)
    if config_service.config_name != "TEST":
        init_database_engine()

    application.middleware("http")(request_timer)
    application.middleware("http")(usage_tracker)

    application.include_router(core_router.core, tags=["core"])
    application.include_router(auth_router, tags=["authentication"])
    application.include_router(ratings_router, tags=["ratings"])

    # Mount static files and templates
    application.mount("/static", StaticFiles(directory=f"{BASEDIR}/core/static"), name="static")

    logger.info(f"API running in {application.state.config_name} mode")
    return application


setup_logger(config_service.get_api_model())
app = get_application()
