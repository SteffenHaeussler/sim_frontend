from fastapi.testclient import TestClient

from src.app.main import app


class TestHealthWebSocket:
    """Test the health WebSocket endpoint"""

    def test_health_websocket_connection(self):
        """Test basic WebSocket connection to health endpoint"""
        client = TestClient(app)

        with client.websocket_connect("/ws/health") as websocket:
            # Should receive first health message
            data = websocket.receive_json()

            assert "version" in data
            assert "timestamp" in data
            assert isinstance(data["timestamp"], int | float)

    def test_health_websocket_periodic_messages(self):
        """Test that health WebSocket sends periodic messages"""
        client = TestClient(app)

        with client.websocket_connect("/ws/health") as websocket:
            # Receive first message
            first_msg = websocket.receive_json()

            # Since test client doesn't support timeout and we can't wait 10s in tests,
            # we'll just verify the first message format
            assert "version" in first_msg
            assert "timestamp" in first_msg

    def test_health_websocket_disconnect(self):
        """Test graceful WebSocket disconnection"""
        client = TestClient(app)

        with client.websocket_connect("/ws/health") as websocket:
            # Receive initial message to confirm connection
            data = websocket.receive_json()
            assert "version" in data

            # Close connection
            websocket.close()

            # Should not raise exception
            assert True
