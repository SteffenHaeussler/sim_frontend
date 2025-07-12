import time
import uuid
from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from loguru import logger
from pydantic import ValidationError

from src.app.auth.dependencies import verify_token_only
from src.app.auth.jwt_utils import TokenData, verify_token
from src.app.core.scenario_websocket_schema import (
    ScenarioErrorResponse,
    ScenarioQueryMessage,
    ScenarioRetryMessage,
    ScenarioWebSocketMessage,
)
from src.app.services.scenario_service import ScenarioService

scenario_router = APIRouter()

# Rate limiting: track requests per user
user_request_times = defaultdict(list)
MAX_REQUESTS_PER_MINUTE = 10


def get_scenario_service() -> ScenarioService:
    """Dependency injection for ScenarioService"""
    return ScenarioService()


def check_rate_limit(user_id: str) -> bool:
    """Check if user has exceeded rate limit"""
    now = datetime.now()
    minute_ago = now - timedelta(minutes=1)
    
    # Clean up old entries
    user_request_times[user_id] = [
        t for t in user_request_times[user_id] 
        if t > minute_ago
    ]
    
    # Check if limit exceeded
    if len(user_request_times[user_id]) >= MAX_REQUESTS_PER_MINUTE:
        return False
    
    # Add current request
    user_request_times[user_id].append(now)
    return True


def validate_session_id(session_id: str) -> bool:
    """Validate session ID format"""
    try:
        # Check if it's a valid UUID
        uuid.UUID(session_id)
        return True
    except ValueError:
        return False


@scenario_router.websocket("/ws/scenario")
async def scenario_websocket(
    websocket: WebSocket,
    session_id: str = Query(...),
    token: str = Query(..., description="JWT access token"),
    scenario_service: ScenarioService = Depends(get_scenario_service)
):
    """WebSocket endpoint for scenario analysis with authentication"""
    
    # Validate session ID format
    if not validate_session_id(session_id):
        await websocket.close(code=1008, reason="Invalid session ID format")
        logger.warning(f"WebSocket connection rejected: Invalid session ID format: {session_id}")
        return
    
    # Verify token before accepting WebSocket connection
    token_data: TokenData | None = verify_token(token, expected_token_type="access")
    if not token_data:
        await websocket.close(code=1008, reason="Invalid authentication token")
        logger.warning(f"WebSocket connection rejected: Invalid token for session {session_id}")
        return
    
    # Accept the WebSocket connection
    await websocket.accept()
    logger.info(f"Scenario WebSocket connected for user {token_data.user_id}, session: {session_id}")
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_json()
            
            try:
                # Determine message type and validate
                msg_type = data.get("type", "query")
                
                if msg_type == "query":
                    message = ScenarioQueryMessage(**data)
                elif msg_type == "retry":
                    message = ScenarioRetryMessage(**data)
                else:
                    raise ValueError(f"Unknown message type: {msg_type}")
                    
            except ValidationError as e:
                # Send validation error response
                error_response = ScenarioErrorResponse(
                    error=f"Invalid message: {e.errors()[0]['msg']}",
                    message_id=data.get("message_id") if isinstance(data, dict) else None
                )
                await websocket.send_json(error_response.model_dump())
                continue
            except Exception as e:
                # Handle other validation errors
                error_response = ScenarioErrorResponse(
                    error="Invalid message format"
                )
                await websocket.send_json(error_response.model_dump())
                continue
            
            # Check rate limit
            if not check_rate_limit(token_data.user_id):
                error_response = ScenarioErrorResponse(
                    error="Rate limit exceeded. Please wait before sending more requests.",
                    message_id=message.message_id
                )
                await websocket.send_json(error_response.model_dump())
                logger.warning(f"Rate limit exceeded for user {token_data.user_id}")
                continue
            
            # Handle different message types
            if isinstance(message, ScenarioQueryMessage):
                # Log the request with user context
                logger.info(f"Processing scenario query for user {token_data.user_id}: {message.query[:50]}...")
                
                # Process the scenario with user context
                await scenario_service.process_scenario(
                    query=message.query,
                    session_id=session_id,
                    websocket=websocket,
                    user_id=token_data.user_id
                )
            elif isinstance(message, ScenarioRetryMessage):
                # Log the retry request
                logger.info(f"Processing retry request for user {token_data.user_id}: {message.sub_id}")
                
                # Process the retry
                await scenario_service.retry_agent_call(
                    message_id=message.message_id,
                    sub_id=message.sub_id,
                    agent_type=message.agent_type,
                    session_id=session_id,
                    websocket=websocket,
                    user_id=token_data.user_id
                )
            
    except WebSocketDisconnect:
        logger.info(f"Scenario WebSocket disconnected for user {token_data.user_id}, session: {session_id}")
    except Exception as e:
        logger.error(f"Scenario WebSocket error for user {token_data.user_id}: {e}")
        try:
            await websocket.send_json({
                "type": "error",
                "error": "Internal server error"
            })
        except:
            pass
        await websocket.close(code=1011, reason="Internal server error")