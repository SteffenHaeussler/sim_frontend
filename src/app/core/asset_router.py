from fastapi import APIRouter, Depends, Request

from src.app.auth.dependencies import verify_token_only
from src.app.services.asset_service import AssetService

asset_router = APIRouter()


def get_asset_service() -> AssetService:
    """Dependency injection for AssetService"""
    return AssetService()


@asset_router.get("/agent")
async def answer_question(
    question: str, 
    session_id: str = None, 
    token_data=Depends(verify_token_only),
    asset_service: AssetService = Depends(get_asset_service)
):
    """Handle question from frontend and trigger external agent API"""
    return await asset_service.trigger_agent_question(question, session_id)


@asset_router.get("/api/asset/{asset_id}")
async def get_asset_info(
    asset_id: str, 
    session_id: str = None, 
    token_data=Depends(verify_token_only),
    asset_service: AssetService = Depends(get_asset_service)
):
    """Get asset information by asset ID"""
    return await asset_service.get_asset_info(asset_id)


@asset_router.get("/api/neighbor/{asset_id}")
async def get_neighbor_assets(
    asset_id: str, 
    session_id: str = None, 
    token_data=Depends(verify_token_only),
    asset_service: AssetService = Depends(get_asset_service)
):
    """Get neighboring assets by asset ID"""
    return await asset_service.get_neighbor_assets(asset_id)


@asset_router.get("/api/name/{asset_id}")
async def get_name_from_id(
    asset_id: str, 
    session_id: str = None, 
    token_data=Depends(verify_token_only),
    asset_service: AssetService = Depends(get_asset_service)
):
    """Get asset name from asset ID"""
    return await asset_service.get_name_from_id(asset_id)


@asset_router.get("/api/id/{name}")
async def get_id_from_name(
    name: str, 
    session_id: str = None, 
    token_data=Depends(verify_token_only),
    asset_service: AssetService = Depends(get_asset_service)
):
    """Get asset ID from asset name"""
    return await asset_service.get_id_from_name(name)


@asset_router.get("/lookup/assets")
async def get_lookup_assets(
    request: Request, 
    session_id: str = None, 
    token_data=Depends(verify_token_only),
    asset_service: AssetService = Depends(get_asset_service)
):
    """Get all lookup assets from application state"""
    return asset_service.get_lookup_assets(request)


@asset_router.get("/lookup/search")
async def search_assets(
    request: Request,
    name: str = None,
    asset_type: str = None,
    type: str = None,
    page: int = 1,
    limit: int = 50,
    session_id: str = None,
    token_data=Depends(verify_token_only),
    asset_service: AssetService = Depends(get_asset_service)
):
    """Search and filter lookup assets with pagination"""
    return asset_service.search_assets(request, name, asset_type, type, page, limit)