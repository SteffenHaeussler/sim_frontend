import asyncio
import os
import threading
import uuid
from time import time

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from loguru import logger
from pydantic import ValidationError

from src.app.v1.schema import HealthCheckResponse

load_dotenv()

v1 = APIRouter()


@v1.get("/health", response_model=HealthCheckResponse)
def health(request: Request) -> HealthCheckResponse:
    logger.debug(f"Methode: {request.method} on {request.url.path}")
    return {"version": request.app.state.VERSION, "timestamp": time()}


@v1.post("/health", response_model=HealthCheckResponse)
def health(request: Request) -> HealthCheckResponse:
    logger.debug(f"Methode: {request.method} on {request.url.path}")
    return {"version": request.app.state.VERSION, "timestamp": time()}


@v1.websocket("/ws/health")
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


@v1.get("/", response_class=HTMLResponse)
async def frontend(request: Request):
    """Serve the chat frontend"""
    return request.app.templates.TemplateResponse("chat.html", {"request": request})


@v1.get("/config")
async def get_config():
    """Provide frontend configuration"""
    return {
        "agent_api_base": os.getenv("agent_base", ""),
        "agent_api_url": os.getenv("agent_url", ""),
        "agent_ws_base": os.getenv("agent_ws_base", ""),
    }


@v1.get("/answer")
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
