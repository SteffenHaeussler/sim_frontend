import asyncio
import os
import threading
import uuid
from pathlib import Path
from time import time

import httpx
from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from loguru import logger
from pydantic import ValidationError

from src.app.core.schema import HealthCheckResponse, SemanticRequest
from src.app.auth.dependencies import require_active_auth

BASEDIR = Path(__file__).resolve().parent


core = APIRouter()

templates = Jinja2Templates(directory=f"{BASEDIR}/templates")


@core.get("/health", response_model=HealthCheckResponse)
def get_health(request: Request) -> HealthCheckResponse:
    logger.debug(f"Methode: {request.method} on {request.url.path}")
    return {"version": request.app.state.VERSION, "timestamp": time()}


@core.post("/health", response_model=HealthCheckResponse)
def post_health(request: Request) -> HealthCheckResponse:
    logger.debug(f"Methode: {request.method} on {request.url.path}")
    return {"version": request.app.state.VERSION, "timestamp": time()}


@core.websocket("/ws/health")
async def health(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            try:
                response = HealthCheckResponse(
                    version=websocket.app.state.VERSION, timestamp=time()
                )

                await websocket.send_json(response.model_dump())
            except ValidationError as e:
                logger.error(f"Validation Error: {e}")
                await websocket.send_json({"error": "Validation Error"})

            await asyncio.sleep(10)

    except WebSocketDisconnect:
        print("Client disconnected")


@core.get("/", response_class=HTMLResponse)
async def frontend(request: Request):
    """Serve the chat frontend"""
    context = {
        "request": request,
        "agent_ws_base": os.getenv("agent_ws_base", ""),
        "agent_url": os.getenv("agent_url", ""),
        "agent_base": os.getenv("agent_base", ""),
        "api_base": os.getenv("api_base", ""),
        "api_asset_url": os.getenv("api_asset_url", ""),
        "api_neighbor_url": os.getenv("api_neighbor_url", ""),
        "api_name_url": os.getenv("api_name_url", ""),
        "api_id_url": os.getenv("api_id_url", ""),
        "semantic_base": os.getenv("semantic_base", ""),
        "semantic_emb_url": os.getenv("semantic_emb_url", ""),
        "semantic_rank_url": os.getenv("semantic_rank_url", ""),
        "semantic_search_url": os.getenv("semantic_search_url", ""),
    }
    return templates.TemplateResponse(request, "base.html", context)


@core.get("/agent")
async def answer_question(question: str, _=require_active_auth()):
    """Handle question from frontend and trigger external agent API"""
    # Generate session ID for this request
    session_id = str(uuid.uuid4())

    # Get external API URL from environment
    api_url = os.getenv("agent_base", "") + os.getenv("agent_url", "")

    logger.info(f"Received question: {question}")
    logger.info(f"Session ID: {session_id}")
    logger.info(f"Forwarding to: {api_url}")

    def send_request():
        try:
            with httpx.Client() as client:
                response = client.get(
                    api_url,
                    params={
                        "q_id": session_id,
                        "question": question,
                    },
                    timeout=2,
                )
                logger.info(f"External API response: {response.status_code}")
        except Exception as e:
            logger.error(f"External API request failed: {e}")

    # Fire and forget request to external API
    threading.Thread(target=send_request, daemon=True).start()

    return {"status": "triggered", "session_id": session_id, "question": question}


@core.get("/api/asset/{asset_id}")
async def get_asset_info(asset_id: str):
    """Get asset information by asset ID"""
    api_base = os.getenv("api_base", "")
    api_url = os.getenv("api_asset_url", "")
    full_url = f"{api_base}{api_url}/{asset_id}"

    logger.info(f"Getting asset info for: {asset_id}")
    logger.info(f"Forwarding to: {full_url}")

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(full_url, timeout=10)
            response.raise_for_status()
            return response.json()
    except Exception as e:
        logger.error(f"Asset API request failed: {e}")
        return {"error": str(e), "asset_id": asset_id}


@core.get("/api/neighbor/{asset_id}")
async def get_neighbor_assets(asset_id: str):
    """Get neighboring assets by asset ID"""
    api_base = os.getenv("api_base", "")
    api_url = os.getenv("api_neighbor_url", "")
    full_url = f"{api_base}{api_url}/{asset_id}"

    logger.info(f"Getting neighbors for: {asset_id}")
    logger.info(f"Forwarding to: {full_url}")

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(full_url, timeout=10)
            response.raise_for_status()
            return response.json()
    except Exception as e:
        logger.error(f"Neighbor API request failed: {e}")
        return {"error": str(e), "asset_id": asset_id}


@core.get("/api/name/{asset_id}")
async def get_name_from_id(asset_id: str):
    """Get asset name from asset ID"""
    api_base = os.getenv("api_base", "")
    api_url = os.getenv("api_name_url", "")
    full_url = f"{api_base}{api_url}/{asset_id}"

    logger.info(f"Getting name for asset: {asset_id}")
    logger.info(f"Forwarding to: {full_url}")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(full_url, timeout=10)
            response.raise_for_status()
            return response.json()
    except Exception as e:
        logger.error(f"Name API request failed: {e}")
        return {"error": str(e), "asset_id": asset_id}


@core.get("/api/id/{name}")
async def get_id_from_name(name: str):
    """Get asset ID from asset name"""
    api_base = os.getenv("api_base", "")
    api_url = os.getenv("api_id_url", "")
    full_url = f"{api_base}{api_url}/{name}"

    logger.info(f"Getting ID for asset name: {name}")
    logger.info(f"Forwarding to: {full_url}")

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(full_url, timeout=10)
            response.raise_for_status()
            return response.json()
    except Exception as e:
        logger.error(f"ID API request failed: {e}")
        return {"error": str(e), "name": name}


@core.get("/lookup/assets")
async def get_lookup_assets(request: Request):
    """Get all lookup assets from application state"""
    try:
        assets = request.app.state.lookup_assets
        return {"assets": assets, "count": len(assets)}
    except Exception as e:
        logger.error(f"Failed to get lookup assets: {e}")
        return {"error": str(e), "assets": [], "count": 0}


@core.get("/lookup/search")
async def search_assets(
    request: Request,
    name: str = None,
    asset_type: str = None,
    type: str = None,
    page: int = 1,
    limit: int = 50,
):
    """Search and filter lookup assets with pagination"""
    try:
        assets = request.app.state.lookup_assets
        filtered_assets = assets

        # Filter by name (case-insensitive partial match)
        if name:
            filtered_assets = [
                asset
                for asset in filtered_assets
                if name.lower() in asset.get("name", "").lower()
            ]

        # Filter by asset_type (exact match)
        if asset_type:
            filtered_assets = [
                asset
                for asset in filtered_assets
                if asset.get("asset_type", "").lower() == asset_type.lower()
            ]

        # Filter by type (exact match)
        if type:
            filtered_assets = [
                asset
                for asset in filtered_assets
                if asset.get("type", "").lower() == type.lower()
            ]

        # Calculate pagination
        total_count = len(filtered_assets)
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_assets = filtered_assets[start_idx:end_idx]

        # Get unique asset types and types for filter options
        asset_types = list(set(asset.get("asset_type", "") for asset in assets))
        asset_types = [t for t in asset_types if t]  # Remove empty strings
        asset_types.sort()

        types = list(set(asset.get("type", "") for asset in assets))
        types = [t for t in types if t]  # Remove empty strings
        types.sort()

        return {
            "assets": paginated_assets,
            "total_count": total_count,
            "page": page,
            "limit": limit,
            "total_pages": (total_count + limit - 1) // limit,
            "asset_types": asset_types,
            "types": types,
            "filters": {"name": name, "asset_type": asset_type, "type": type},
        }
    except Exception as e:
        logger.error(f"Failed to search assets: {e}")
        return {"error": str(e), "assets": [], "total_count": 0}


@core.post("/lookout/semantic")
async def semantic_search(request: SemanticRequest):
    """
    Perform semantic search with embedding → search → ranking pipeline
    """
    semantic_base = os.getenv("semantic_base", "")
    emb_url = os.getenv("semantic_emb_url", "")
    search_url = os.getenv("semantic_search_url", "")
    rank_url = os.getenv("semantic_rank_url", "")
    semantic_table = os.getenv("semantic_table", "")

    if not semantic_base:
        logger.error("semantic_base environment variable not set")
        return {"error": "Semantic service not configured", "step": "config"}

    logger.info(f"Starting semantic search for query: {request.query}")
    try:
        async with httpx.AsyncClient() as client:
            # Step 1: Get embedding for the query
            embedding_endpoint = f"{semantic_base}{emb_url}"
            logger.info(f"Step 1: Getting embedding from {embedding_endpoint}")

            emb_response = await client.get(
                embedding_endpoint, params={"text": request.query}, timeout=30
            )
            emb_response.raise_for_status()
            embedding_data = emb_response.json()

            logger.info("Step 1: Embedding completed successfully")

            # Step 2: Perform search using embedding
            search_endpoint = f"{semantic_base}{search_url}"
            logger.info(f"Step 2: Performing search at {search_endpoint}")

            search_payload = {
                "embedding": embedding_data.get("embedding"),
                "n_items": 10,  # Default value
                "table": semantic_table,
            }

            search_response = await client.post(
                search_endpoint, json=search_payload, timeout=30
            )
            search_response.raise_for_status()
            search_data = search_response.json()

            logger.info(
                f"Step 2: Search completed, found {len(search_data.get('results', []))} results"
            )

            # Step 3: Rank the search results
            rank_endpoint = f"{semantic_base}{rank_url}"
            logger.info(f"Step 3: Ranking results at {rank_endpoint}")

            candidates = []

            for candidate in search_data.get("results", []):
                rank_payload = {
                    "question": request.query,
                    "text": candidate["description"],
                }

                rank_response = await client.get(
                    rank_endpoint, params=rank_payload, timeout=30
                )
                rank_response.raise_for_status()
                rank_data = rank_response.json()

                candidate["score"] = rank_data.get("score")
                candidate["question"] = rank_data.get("question")

                candidates.append(candidate)

            logger.info("Step 3: Ranking completed, returning best result")

            candidates = sorted(
                candidates, key=lambda x: getattr(x, "score", 0), reverse=True
            )

            # Return the final ranked results with metadata
            return candidates[0]

    except httpx.HTTPStatusError as e:
        logger.error(
            f"Semantic API HTTP error: {e.response.status_code} - {e.response.text}"
        )
        return {
            "error": f"Semantic API error: {e.response.status_code}",
            "details": e.response.text,
            "step": "api_call",
        }
    except httpx.TimeoutException as e:
        logger.error(f"Semantic API timeout: {e}")
        return {"error": "Semantic API timeout", "step": "timeout"}
    except Exception as e:
        logger.error(f"Semantic search failed: {e}")
        return {"error": str(e), "step": "unknown"}
