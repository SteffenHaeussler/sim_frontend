from fastapi import APIRouter

from src.app.core.asset_router import asset_router
from src.app.core.frontend_router import frontend_router
from src.app.core.health_router import health_router
from src.app.core.scenario_router import scenario_router
from src.app.core.semantic_router import semantic_router

core = APIRouter()

# Include all sub-routers
core.include_router(health_router)
core.include_router(frontend_router)
core.include_router(asset_router)
core.include_router(semantic_router)
core.include_router(scenario_router)
