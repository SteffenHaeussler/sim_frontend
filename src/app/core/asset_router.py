from fastapi import APIRouter, Depends, Request, Header
import uuid

from src.app.auth.dependencies import verify_token_only
from src.app.services.asset_service import AssetService

asset_router = APIRouter()


def get_asset_service() -> AssetService:
    """Dependency injection for AssetService"""
    return AssetService()


@asset_router.get("/agent")
async def answer_question(
    question: str, 
    token_data=Depends(verify_token_only),
    asset_service: AssetService = Depends(get_asset_service),
    x_session_id: str = Header(None, alias="X-Session-ID"),
    x_request_id: str = Header(None, alias="X-Request-ID")
):
    """Handle question from frontend and trigger external agent API"""
    # Generate request_id if not provided
    request_id = x_request_id or str(uuid.uuid4())
    return await asset_service.trigger_agent_question(question, x_session_id, request_id)


@asset_router.get("/api/asset/{asset_id}")
async def get_asset_info(
    asset_id: str, 
    token_data=Depends(verify_token_only),
    asset_service: AssetService = Depends(get_asset_service),
    x_session_id: str = Header(None, alias="X-Session-ID"),
    x_request_id: str = Header(None, alias="X-Request-ID")
):
    """Get asset information by asset ID"""
    return await asset_service.get_asset_info(asset_id, x_session_id, x_request_id)


@asset_router.get("/api/neighbor/{asset_id}")
async def get_neighbor_assets(
    asset_id: str, 
    token_data=Depends(verify_token_only),
    asset_service: AssetService = Depends(get_asset_service),
    x_session_id: str = Header(None, alias="X-Session-ID"),
    x_request_id: str = Header(None, alias="X-Request-ID")
):
    """Get neighboring assets by asset ID"""
    return await asset_service.get_neighbor_assets(asset_id, x_session_id, x_request_id)


@asset_router.get("/api/name/{asset_id}")
async def get_name_from_id(
    asset_id: str, 
    token_data=Depends(verify_token_only),
    asset_service: AssetService = Depends(get_asset_service),
    x_session_id: str = Header(None, alias="X-Session-ID"),
    x_request_id: str = Header(None, alias="X-Request-ID")
):
    """Get asset name from asset ID"""
    return await asset_service.get_name_from_id(asset_id, x_session_id, x_request_id)


@asset_router.get("/api/id/{name}")
async def get_id_from_name(
    name: str, 
    token_data=Depends(verify_token_only),
    asset_service: AssetService = Depends(get_asset_service),
    x_session_id: str = Header(None, alias="X-Session-ID"),
    x_request_id: str = Header(None, alias="X-Request-ID")
):
    """Get asset ID from asset name"""
    return await asset_service.get_id_from_name(name, x_session_id, x_request_id)


@asset_router.get("/lookup/assets")
async def get_lookup_assets(
    request: Request, 
    token_data=Depends(verify_token_only),
    asset_service: AssetService = Depends(get_asset_service),
    x_session_id: str = Header(None, alias="X-Session-ID"),
    x_request_id: str = Header(None, alias="X-Request-ID")
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
    token_data=Depends(verify_token_only),
    asset_service: AssetService = Depends(get_asset_service),
    x_session_id: str = Header(None, alias="X-Session-ID"),
    x_request_id: str = Header(None, alias="X-Request-ID")
):
    """Search and filter lookup assets with pagination"""
    return asset_service.search_assets(request, name, asset_type, type, page, limit)