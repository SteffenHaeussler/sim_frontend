"""Test error handling utilities"""

from unittest.mock import Mock, patch

import httpx
import pytest

from src.app.utils.error_handlers import create_error_response, handle_http_errors, log_and_return_error


class TestErrorHandlers:
    def test_create_error_response(self):
        """Test creating standardized error responses"""
        # Basic error response
        response = create_error_response("Test error")
        assert response == {"status": "error", "error": "Test error"}

        # With extra fields
        response = create_error_response("Test error", status="failed", code=404, details="Not found")
        assert response == {"status": "failed", "error": "Test error", "code": 404, "details": "Not found"}

    def test_log_and_return_error(self):
        """Test logging and returning error response"""
        with patch("src.app.utils.error_handlers.logger") as mock_logger:
            error = ValueError("Test exception")
            response = log_and_return_error(error, "Test context", "Default error message", extra_field="extra_value")

            # Check logger was called
            mock_logger.error.assert_called_once_with("Test context: Test exception")

            # Check response
            assert response == {"status": "error", "error": "Default error message", "extra_field": "extra_value"}

    @pytest.mark.asyncio
    async def test_handle_http_errors_decorator_success(self):
        """Test decorator with successful function execution"""

        @handle_http_errors(service_name="TestService")
        async def test_func():
            return {"result": "success"}

        result = await test_func()
        assert result == {"result": "success"}

    @pytest.mark.asyncio
    async def test_handle_http_errors_decorator_http_status_error(self):
        """Test decorator handling HTTPStatusError"""
        mock_response = Mock()
        mock_response.status_code = 404
        mock_response.text = "Not found"

        @handle_http_errors(service_name="TestService")
        async def test_func():
            raise httpx.HTTPStatusError("Error", request=Mock(), response=mock_response)

        with patch("src.app.utils.error_handlers.logger") as mock_logger:
            result = await test_func()

            # Check logger was called
            mock_logger.error.assert_called_once_with("TestService HTTP error: 404 - Not found")

            # Check response
            assert result == {"error": "TestService error: 404", "status": "error", "details": "Not found"}

    @pytest.mark.asyncio
    async def test_handle_http_errors_decorator_timeout(self):
        """Test decorator handling TimeoutException"""

        @handle_http_errors(service_name="TestService")
        async def test_func():
            raise httpx.TimeoutException("Timeout")

        with patch("src.app.utils.error_handlers.logger") as mock_logger:
            result = await test_func()

            # Check logger was called
            mock_logger.error.assert_called_once_with("TestService timeout: Timeout")

            # Check response
            assert result == {"error": "TestService timeout", "status": "error"}

    @pytest.mark.asyncio
    async def test_handle_http_errors_decorator_connect_error(self):
        """Test decorator handling ConnectError"""

        @handle_http_errors(service_name="TestService")
        async def test_func():
            raise httpx.ConnectError("Connection failed")

        with patch("src.app.utils.error_handlers.logger") as mock_logger:
            result = await test_func()

            # Check logger was called
            mock_logger.error.assert_called_once_with("Failed to connect to TestService: Connection failed")

            # Check response
            assert result == {"error": "Failed to connect to TestService", "status": "error"}

    @pytest.mark.asyncio
    async def test_handle_http_errors_decorator_generic_exception(self):
        """Test decorator handling generic exceptions"""

        @handle_http_errors(service_name="TestService", default_error_msg="Custom error message")
        async def test_func():
            raise RuntimeError("Unexpected error")

        with patch("src.app.utils.error_handlers.logger") as mock_logger:
            result = await test_func()

            # Check logger was called
            mock_logger.error.assert_called_once_with("TestService request failed: Unexpected error")

            # Check response
            assert result == {"error": "Custom error message", "status": "error"}
