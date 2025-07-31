"""Test RequestTimer middleware functionality"""

import asyncio
import time
from unittest.mock import MagicMock, patch

import pytest
from fastapi import Request, Response

from src.app.middleware.request_timer import RequestTimer


class TestRequestTimer:
    """Test RequestTimer middleware"""

    @pytest.mark.asyncio
    async def test_request_timer_adds_process_time_header(self):
        """Test that RequestTimer adds X-Process-Time header to response"""
        # Create middleware instance
        timer = RequestTimer()

        # Create mock request
        mock_request = MagicMock(spec=Request)

        # Create mock response
        mock_response = MagicMock(spec=Response)
        mock_response.headers = {}

        # Mock call_next to return the response after a small delay
        async def mock_call_next(request):
            await asyncio.sleep(0.01)  # 10ms delay
            return mock_response

        # Mock logger
        with patch("src.app.middleware.request_timer.logger") as mock_logger:
            # Call the middleware
            result = await timer(mock_request, mock_call_next)

            # Verify result is the mock response
            assert result == mock_response

            # Verify X-Process-Time header was added
            assert "X-Process-Time" in mock_response.headers

            # Verify the process time is reasonable (should be around 0.01 seconds)
            process_time = float(mock_response.headers["X-Process-Time"])
            assert process_time >= 0.01  # At least 10ms
            assert process_time < 0.1  # Less than 100ms (reasonable upper bound)

            # Verify logging calls
            mock_logger.info.assert_any_call("Incoming request")
            mock_logger.info.assert_any_call(f"Processing this request took {process_time} seconds")

    @pytest.mark.asyncio
    async def test_request_timer_handles_fast_requests(self):
        """Test RequestTimer with very fast requests"""

        timer = RequestTimer()
        mock_request = MagicMock(spec=Request)
        mock_response = MagicMock(spec=Response)
        mock_response.headers = {}

        # Mock call_next that returns immediately
        async def mock_call_next(request):
            return mock_response

        with patch("src.app.middleware.request_timer.logger"):
            result = await timer(mock_request, mock_call_next)

            assert result == mock_response
            assert "X-Process-Time" in mock_response.headers

            # Process time should be very small but non-negative
            process_time = float(mock_response.headers["X-Process-Time"])
            assert process_time >= 0
            assert process_time < 0.01  # Should be very fast

    @pytest.mark.asyncio
    async def test_request_timer_preserves_existing_headers(self):
        """Test that RequestTimer preserves existing response headers"""
        timer = RequestTimer()
        mock_request = MagicMock(spec=Request)
        mock_response = MagicMock(spec=Response)

        # Response already has some headers
        mock_response.headers = {"Content-Type": "application/json", "X-Custom-Header": "custom-value"}

        async def mock_call_next(request):
            return mock_response

        with patch("src.app.middleware.request_timer.logger"):
            result = await timer(mock_request, mock_call_next)

            # Verify original headers are preserved
            assert result.headers["Content-Type"] == "application/json"
            assert result.headers["X-Custom-Header"] == "custom-value"

            # Verify our header was added
            assert "X-Process-Time" in result.headers

    @pytest.mark.asyncio
    async def test_request_timer_handles_exceptions_in_call_next(self):
        """Test RequestTimer behavior when call_next raises an exception"""
        timer = RequestTimer()
        mock_request = MagicMock(spec=Request)

        # Mock call_next that raises an exception
        async def mock_call_next(request):
            raise ValueError("Test exception")

        with patch("src.app.middleware.request_timer.logger") as mock_logger:
            # The exception should propagate
            with pytest.raises(ValueError, match="Test exception"):
                await timer(mock_request, mock_call_next)

            # Should still log the incoming request
            mock_logger.info.assert_called_with("Incoming request")

    @pytest.mark.asyncio
    async def test_request_timer_timing_accuracy(self):
        """Test that RequestTimer timing is reasonably accurate"""
        import asyncio

        timer = RequestTimer()
        mock_request = MagicMock(spec=Request)
        mock_response = MagicMock(spec=Response)
        mock_response.headers = {}

        # Known delay
        expected_delay = 0.05  # 50ms

        async def mock_call_next(request):
            await asyncio.sleep(expected_delay)
            return mock_response

        with patch("src.app.middleware.request_timer.logger"):
            start_time = time.time()
            result = await timer(mock_request, mock_call_next)
            actual_total_time = time.time() - start_time

            # Get recorded process time
            process_time = float(result.headers["X-Process-Time"])

            # Process time should be close to expected delay (within reasonable margin)
            assert abs(process_time - expected_delay) < 0.01  # 10ms tolerance

            # Should be close to our measured time
            assert abs(process_time - actual_total_time) < 0.01

    @pytest.mark.asyncio
    async def test_request_timer_with_real_fastapi_request(self):
        """Test RequestTimer with more realistic FastAPI Request object"""
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        app = FastAPI()
        timer = RequestTimer()

        @app.get("/test")
        async def test_endpoint():
            return {"message": "test"}

        # Add middleware to app
        app.middleware("http")(timer)

        with TestClient(app) as client, patch("src.app.middleware.request_timer.logger") as mock_logger:
            response = client.get("/test")

            # Should be successful
            assert response.status_code == 200
            assert response.json() == {"message": "test"}

            # Should have our timing header
            assert "X-Process-Time" in response.headers
            process_time = float(response.headers["X-Process-Time"])
            assert process_time >= 0

            # Should have logged
            assert mock_logger.info.call_count == 2  # Incoming request + processing time
