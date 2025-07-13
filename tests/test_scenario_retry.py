import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import WebSocket

from src.app.services.scenario_service import ScenarioService


@pytest.mark.skip(reason="Scenario WebSocket endpoint moved to external agent - frontend connects directly")
class TestScenarioRetry:
    """Test the scenario retry functionality"""
    
    @pytest.mark.asyncio
    async def test_retry_agent_call_success(self):
        """Test successful retry of a failed agent call"""
        service = ScenarioService()
        
        # Store original query for retry
        message_id = "test-message-123"
        sub_id = "sub-1"
        original_query = "What is the temperature of DC-101?"
        service.query_store[message_id] = {sub_id: original_query}
        
        # Mock WebSocket
        websocket = AsyncMock(spec=WebSocket)
        
        # Mock successful retry
        with patch.object(service.agent_caller, '_call_sql_agent', 
                         return_value={"status": "success", "result": "Temperature is 75°C"}):
            
            await service.retry_agent_call(
                message_id=message_id,
                sub_id=sub_id,
                agent_type="sqlagent",
                session_id="test-session",
                websocket=websocket,
                user_id="test-user"
            )
            
            # Verify WebSocket message was sent
            websocket.send_json.assert_called_once()
            sent_message = websocket.send_json.call_args[0][0]
            
            assert sent_message["type"] == "scenario_result"
            assert sent_message["message_id"] == message_id
            assert sent_message["sub_id"] == sub_id
            assert sent_message["content"] == "Temperature is 75°C"
            assert sent_message["is_complete"] is True
            assert "error" not in sent_message or sent_message["error"] is None
    
    @pytest.mark.asyncio
    async def test_retry_agent_call_failure(self):
        """Test retry that fails again"""
        service = ScenarioService()
        
        # Store original query for retry
        message_id = "test-message-123"
        sub_id = "sub-1"
        original_query = "What is the temperature of DC-101?"
        service.query_store[message_id] = {sub_id: original_query}
        
        # Mock WebSocket
        websocket = AsyncMock(spec=WebSocket)
        
        # Mock failed retry
        with patch.object(service.agent_caller, '_call_sql_agent', 
                         return_value={"status": "error", "error": "Connection timeout", "result": None}):
            
            await service.retry_agent_call(
                message_id=message_id,
                sub_id=sub_id,
                agent_type="sqlagent",
                session_id="test-session",
                websocket=websocket,
                user_id="test-user"
            )
            
            # Verify error WebSocket message was sent
            websocket.send_json.assert_called_once()
            sent_message = websocket.send_json.call_args[0][0]
            
            assert sent_message["type"] == "scenario_result"
            assert sent_message["message_id"] == message_id
            assert sent_message["sub_id"] == sub_id
            assert sent_message["error"] == "Connection timeout"
            assert sent_message["is_complete"] is True
    
    @pytest.mark.asyncio
    async def test_retry_without_original_query(self):
        """Test retry when original query is not found"""
        service = ScenarioService()
        
        # Don't store original query
        message_id = "test-message-123"
        sub_id = "sub-1"
        
        # Mock WebSocket
        websocket = AsyncMock(spec=WebSocket)
        
        await service.retry_agent_call(
            message_id=message_id,
            sub_id=sub_id,
            agent_type="sqlagent",
            session_id="test-session",
            websocket=websocket,
            user_id="test-user"
        )
        
        # Verify error WebSocket message was sent
        websocket.send_json.assert_called_once()
        sent_message = websocket.send_json.call_args[0][0]
        
        assert sent_message["type"] == "scenario_result"
        assert sent_message["message_id"] == message_id
        assert sent_message["sub_id"] == sub_id
        assert sent_message["error"] == "Original query not found for retry"
        assert sent_message["is_complete"] is True