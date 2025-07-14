import pytest


@pytest.mark.skip(reason="Scenario WebSocket endpoint moved to external agent - frontend connects directly")
class TestScenarioUIAuthentication:
    """Test that Scenario Analysis UI requires authentication"""

    def test_scenario_button_requires_login(self):
        """Test that clicking scenario button when not logged in shows login required"""
        # This is a placeholder for UI testing
        # In a real test, you would:
        # 1. Navigate to the app without logging in
        # 2. Click the scenario button
        # 3. Verify that the login required message appears
        # 4. Verify that scenario functionality is not accessible

        # For now, we'll test the protection at the API level
        from fastapi.testclient import TestClient

        from src.app.main import app

        client = TestClient(app)

        # Try to connect to scenario WebSocket without authentication
        with (
            pytest.raises(Exception) as exc_info,
            client.websocket_connect("/ws/scenario?session_id=123e4567-e89b-12d3-a456-426614174000"),
        ):
            pass

        # Should fail due to missing token
        from starlette.websockets import WebSocketDisconnect

        assert isinstance(exc_info.value, WebSocketDisconnect)
        assert exc_info.value.code == 1008  # Policy violation

    def test_scenario_accessible_after_login(self):
        """Test that scenario is accessible after login"""
        import uuid

        from fastapi.testclient import TestClient

        from src.app.auth.jwt_utils import create_access_token
        from src.app.main import app

        client = TestClient(app)

        # Create a valid token
        user_id = uuid.uuid4()
        token = create_access_token(user_id=user_id, email="test@example.com")

        # Should be able to connect with valid token
        with client.websocket_connect(
            f"/ws/scenario?session_id=123e4567-e89b-12d3-a456-426614174000&token={token}"
        ) as websocket:
            # Send a test message
            websocket.send_json({"type": "query", "query": "Test scenario query", "message_id": "test-msg-1"})

            # Connection was accepted (would have thrown exception otherwise)
            # The logs show "Scenario WebSocket connected" which confirms authentication worked
            pass  # Test passes if we get here without exception
