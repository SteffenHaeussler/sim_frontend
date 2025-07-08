from fastapi import APIRouter, Depends

from src.app.auth.dependencies import verify_token_only
from src.app.core.schema import SemanticRequest
from src.app.services.search_service import SearchService

semantic_router = APIRouter()


def get_search_service() -> SearchService:
    """Dependency injection for SearchService"""
    return SearchService()


@semantic_router.post("/lookout/semantic")
async def semantic_search(
    request: SemanticRequest,
    token_data=Depends(verify_token_only),
    search_service: SearchService = Depends(get_search_service),
):
    """
    Perform semantic search with embedding → search → ranking pipeline
    """
    return await search_service.perform_semantic_search(request)
