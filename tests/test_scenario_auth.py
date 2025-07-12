import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import WebSocket
from fastapi.testclient import TestClient

from src.app.auth.jwt_utils import create_access_token
from src.app.main import app


class TestScenarioAuthentication:
    """Test authentication for scenario WebSocket endpoint"""
    
    def test_websocket_without_token(self):
        """Test that WebSocket connection is rejected without token"""
        client = TestClient(app)
        
        # Try to connect without token - should fail
        with pytest.raises(Exception) as exc_info:
            with client.websocket_connect("/ws/scenario?session_id=123e4567-e89b-12d3-a456-426614174000"):
                pass
        
        # Check that it's a WebSocketDisconnect with code 1008
        from starlette.websockets import WebSocketDisconnect
        assert isinstance(exc_info.value, WebSocketDisconnect)
        assert exc_info.value.code == 1008  # Policy violation
    
    def test_websocket_with_invalid_token(self):
        """Test that WebSocket connection is rejected with invalid token"""
        client = TestClient(app)
        
        with pytest.raises(Exception) as exc_info:
            with client.websocket_connect("/ws/scenario?session_id=123e4567-e89b-12d3-a456-426614174000&token=invalid-token"):
                pass
        
        # Connection should be closed
        assert exc_info.value.code == 1008  # Policy Violation
    
    def test_websocket_with_valid_token(self):
        """Test that WebSocket connection is accepted with valid token"""
        # Create a valid token
        import uuid
        user_id = uuid.uuid4()
        token = create_access_token(
            user_id=user_id,
            email="test@example.com",
            organisation_id=None
        )
        
        client = TestClient(app)
        
        # Mock the scenario service
        with patch('src.app.core.scenario_router.ScenarioService') as mock_service:
            mock_instance = mock_service.return_value
            mock_instance.process_scenario = AsyncMock()
            
            with client.websocket_connect(f"/ws/scenario?session_id=123e4567-e89b-12d3-a456-426614174000&token={token}") as websocket:
                # Send a test message
                websocket.send_json({
                    "type": "query",
                    "query": "Test query",
                    "message_id": "test-msg-1"
                })
                
                # Should process the message
                # Wait a bit for async processing
                import time
                time.sleep(0.1)
                mock_instance.process_scenario.assert_called_once()
                
                # Check the call arguments
                call_args = mock_instance.process_scenario.call_args
                assert call_args[1]['query'] == "Test query"
                assert call_args[1]['session_id'] == "123e4567-e89b-12d3-a456-426614174000"
                assert call_args[1]['user_id'] == str(user_id)
    
    def test_websocket_message_validation(self):
        """Test that WebSocket validates message structure"""
        import uuid
        user_id = uuid.uuid4()
        token = create_access_token(
            user_id=user_id,
            email="test@example.com"
        )
        
        client = TestClient(app)
        
        with client.websocket_connect(f"/ws/scenario?session_id=123e4567-e89b-12d3-a456-426614174000&token={token}") as websocket:
            # Test invalid message format
            websocket.send_json("not a dict")
            response = websocket.receive_json()
            assert response["type"] == "error"
            assert "Invalid message format" in response["error"]
            
            # Test missing query
            websocket.send_json({"type": "query", "message_id": "test-1"})
            response = websocket.receive_json()
            assert response["type"] == "error"
            assert "Invalid message" in response["error"]
            
            # Test missing message_id
            websocket.send_json({"type": "query", "query": "test"})
            response = websocket.receive_json()
            assert response["type"] == "error"
            assert "Invalid message" in response["error"]
    
    def test_websocket_token_expiry(self):
        """Test that expired tokens are rejected"""
        import uuid
        from datetime import timedelta
        
        user_id = uuid.uuid4()
        # Create an expired token
        token = create_access_token(
            user_id=user_id,
            email="test@example.com",
            expires_delta=timedelta(seconds=-1)  # Already expired
        )
        
        client = TestClient(app)
        
        with pytest.raises(Exception) as exc_info:
            with client.websocket_connect(f"/ws/scenario?session_id=123e4567-e89b-12d3-a456-426614174000&token={token}"):
                pass
        
        # Should be rejected
        assert exc_info.value.code == 1008