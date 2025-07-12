from fastapi import APIRouter

scenario_router = APIRouter()

# Scenario router is now empty since the frontend connects directly to the external agent
# The HTTP trigger endpoint is handled by asset_router.py