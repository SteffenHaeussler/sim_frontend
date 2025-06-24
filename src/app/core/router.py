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

from src.app.core.schema import HealthCheckResponse

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
    }
    return templates.TemplateResponse("chat.html", context)


@core.get("/agent")
async def answer_question(question: str):
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
