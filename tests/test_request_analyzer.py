"""Test RequestAnalyzer middleware functionality"""

import json
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import Request

from src.app.auth.jwt_utils import TokenData
from src.app.middleware.request_analyzer import RequestAnalyzer


class TestRequestAnalyzer:
    """Test RequestAnalyzer functionality"""

    def setup_method(self):
        """Set up test fixtures"""
        self.analyzer = RequestAnalyzer()

    @pytest.mark.asyncio
    async def test_extract_user_info_valid_token(self):
        """Test extracting user info from valid JWT token"""
        mock_request = MagicMock(spec=Request)
        mock_request.headers.get.return_value = "Bearer valid-jwt-token"

        test_user_id = uuid.uuid4()
        test_org_id = uuid.uuid4()

        with patch.object(self.analyzer, "_parse_bearer_token") as mock_parse:
            mock_parse.return_value = (test_user_id, test_org_id)

            result = await self.analyzer.extract_user_info(mock_request)

            assert result["user_id"] == test_user_id
            assert result["organisation_id"] == test_org_id
            mock_parse.assert_called_once_with("Bearer valid-jwt-token")

    @pytest.mark.asyncio
    async def test_extract_user_info_no_auth_header(self):
        """Test extracting user info when no authorization header present"""
        mock_request = MagicMock(spec=Request)
        mock_request.headers.get.return_value = None

        result = await self.analyzer.extract_user_info(mock_request)

        assert result["user_id"] is None
        assert result["organisation_id"] is None

    @pytest.mark.asyncio
    async def test_extract_user_info_invalid_uuid(self):
        """Test handling of invalid UUID in token"""
        mock_request = MagicMock(spec=Request)
        mock_request.headers.get.return_value = "Bearer invalid-token"

        with (
            patch.object(self.analyzer, "_parse_bearer_token") as mock_parse,
            patch("src.app.middleware.request_analyzer.logger") as mock_logger,
        ):
            mock_parse.side_effect = ValueError("Invalid UUID")

            result = await self.analyzer.extract_user_info(mock_request)

            assert result["user_id"] is None
            assert result["organisation_id"] is None
            mock_logger.debug.assert_called_with("Invalid UUID in token: Invalid UUID")

    @pytest.mark.asyncio
    async def test_extract_user_info_general_exception(self):
        """Test handling of general exception during user extraction"""
        mock_request = MagicMock(spec=Request)
        mock_request.headers.get.return_value = "Bearer problematic-token"

        with (
            patch.object(self.analyzer, "_parse_bearer_token") as mock_parse,
            patch("src.app.middleware.request_analyzer.logger") as mock_logger,
        ):
            mock_parse.side_effect = Exception("General error")

            result = await self.analyzer.extract_user_info(mock_request)

            assert result["user_id"] is None
            assert result["organisation_id"] is None
            mock_logger.debug.assert_called_with("Auth extraction failed: General error")

    def test_parse_bearer_token_valid(self):
        """Test parsing valid Bearer token"""
        test_user_id = uuid.uuid4()
        test_org_id = uuid.uuid4()

        mock_token_data = TokenData(
            user_id=str(test_user_id), email="test@example.com", organisation_id=str(test_org_id), token_type="access"
        )

        with patch("src.app.middleware.request_analyzer.verify_token") as mock_verify:
            mock_verify.return_value = mock_token_data

            user_id, org_id = self.analyzer._parse_bearer_token("Bearer valid-token")

            assert user_id == test_user_id
            assert org_id == test_org_id
            mock_verify.assert_called_once_with("valid-token", expected_token_type="access")

    def test_parse_bearer_token_invalid_format(self):
        """Test parsing Bearer token with invalid format"""
        with patch("src.app.middleware.request_analyzer.logger") as mock_logger:
            result = self.analyzer._parse_bearer_token("InvalidFormat")

            assert result == (None, None)
            mock_logger.debug.assert_called_with("Invalid authorization header format")

    def test_parse_bearer_token_wrong_scheme(self):
        """Test parsing token with wrong authorization scheme"""
        with patch("src.app.middleware.request_analyzer.logger") as mock_logger:
            result = self.analyzer._parse_bearer_token("Basic username:password")

            assert result == (None, None)
            mock_logger.debug.assert_called_with("Invalid authorization scheme: Basic")

    def test_parse_bearer_token_invalid_token(self):
        """Test parsing Bearer token that fails verification"""
        with patch("src.app.middleware.request_analyzer.verify_token") as mock_verify:
            mock_verify.return_value = None  # Token verification failed

            result = self.analyzer._parse_bearer_token("Bearer invalid-token")

            assert result == (None, None)

    def test_parse_bearer_token_no_user_id(self):
        """Test parsing Bearer token without user ID"""
        mock_token_data = TokenData(user_id=None, email="test@example.com")

        with patch("src.app.middleware.request_analyzer.verify_token") as mock_verify:
            mock_verify.return_value = mock_token_data

            result = self.analyzer._parse_bearer_token("Bearer token-without-user-id")

            assert result == (None, None)

    def test_parse_bearer_token_without_org_id(self):
        """Test parsing Bearer token without organisation ID"""
        test_user_id = uuid.uuid4()
        mock_token_data = TokenData(user_id=str(test_user_id), email="test@example.com", organisation_id=None)

        with patch("src.app.middleware.request_analyzer.verify_token") as mock_verify:
            mock_verify.return_value = mock_token_data

            user_id, org_id = self.analyzer._parse_bearer_token("Bearer token-without-org")

            assert user_id == test_user_id
            assert org_id is None

    def test_extract_request_metadata(self):
        """Test extracting basic request metadata"""
        mock_request = MagicMock(spec=Request)
        mock_request.headers.get.side_effect = lambda key, default="": {"user-agent": "Mozilla/5.0 Test Browser"}.get(
            key, default
        )
        mock_request.url.path = "/api/asset/123"

        with patch.object(self.analyzer, "_get_client_ip") as mock_get_ip:
            mock_get_ip.return_value = "192.168.1.100"

            result = self.analyzer.extract_request_metadata(mock_request)

            assert result["user_agent"] == "Mozilla/5.0 Test Browser"
            assert result["ip_address"] == "192.168.1.100"
            assert result["service_type"] == "lookup-service"

    @pytest.mark.asyncio
    async def test_extract_query_and_body_data_get_request(self):
        """Test extracting data from GET request with query parameters"""
        mock_request = MagicMock(spec=Request)
        mock_request.method = "GET"
        mock_request.query_params = {"question": "test question", "session_id": "test-session"}
        mock_request.headers.get.side_effect = lambda key, default=None: {"x-session-id": "header-session-id"}.get(
            key, default
        )

        # Mock request.body() to return empty bytes for GET request
        mock_request.body = AsyncMock(return_value=b"")

        result = await self.analyzer.extract_query_and_body_data(mock_request)

        assert result["session_id"] == "header-session-id"  # Header takes precedence
        assert result["request_size"] is None  # Empty body results in None, not 0
        assert "question" in result["query_params"]

    @pytest.mark.asyncio
    async def test_extract_query_and_body_data_post_request_json(self):
        """Test extracting data from POST request with JSON body"""
        mock_request = MagicMock(spec=Request)
        mock_request.method = "POST"
        mock_request.query_params = {}
        mock_request.headers.get.side_effect = lambda key, default=None: {
            "content-type": "application/json",
            "x-request-id": None,
        }.get(key, default)
        mock_request.url.path = "/agent"

        json_body = {"question": "What is the temperature?", "session_id": "test-session"}
        json_bytes = json.dumps(json_body).encode("utf-8")
        mock_request.body = AsyncMock(return_value=json_bytes)

        with patch.object(self.analyzer, "_extract_tracking_ids") as mock_extract_ids:
            mock_extract_ids.return_value = {
                "session_id": "test-session",
                "event_id": "test-event",
                "request_id": "test-request",
            }

            result = await self.analyzer.extract_query_and_body_data(mock_request)

            assert result["session_id"] == "test-session"
            assert result["event_id"] == "test-event"
            assert result["request_id"] == "test-request"
            assert result["request_size"] == len(json_bytes)

    def test_extract_tracking_ids_from_headers(self):
        """Test extracting tracking IDs from headers"""
        mock_request = MagicMock(spec=Request)
        mock_request.headers.get.side_effect = lambda key, default=None: {
            "x-session-id": "header-session",
            "x-event-id": "header-event",
            "x-request-id": "header-request",
        }.get(key, default)

        query_params = {}

        with patch("src.app.middleware.request_analyzer.logger") as mock_logger:
            result = self.analyzer._extract_tracking_ids(mock_request, query_params)

            assert result["session_id"] == "header-session"
            assert result["event_id"] == "header-event"
            assert result["request_id"] == "header-request"
            mock_logger.debug.assert_called_with("Extracted session_id: header-session")

    def test_extract_tracking_ids_from_query_params(self):
        """Test extracting tracking IDs from query parameters when headers missing"""
        mock_request = MagicMock(spec=Request)
        mock_request.headers.get.return_value = None

        query_params = {"session_id": "query-session", "event_id": "query-event"}

        with patch("uuid.uuid4") as mock_uuid:
            mock_uuid.return_value = uuid.UUID("12345678-1234-5678-1234-123456789012")

            result = self.analyzer._extract_tracking_ids(mock_request, query_params)

            assert result["session_id"] == "query-session"
            assert result["event_id"] == "query-event"
            assert result["request_id"] == "12345678-1234-5678-1234-123456789012"

    def test_extract_post_body_data_json(self):
        """Test extracting data from JSON POST body"""
        mock_request = MagicMock(spec=Request)
        mock_request.headers.get.return_value = "application/json"
        mock_request.url.path = "/agent"

        json_data = {"question": "test question", "session_id": "body-session"}
        json_body = json.dumps(json_data).encode("utf-8")
        query_params = {}

        self.analyzer._extract_post_body_data(mock_request, json_body, query_params)

        assert query_params["question"] == "test question"

    def test_extract_post_body_data_semantic_search(self):
        """Test extracting data from semantic search POST body"""
        mock_request = MagicMock(spec=Request)
        mock_request.headers.get.return_value = "application/json"
        mock_request.url.path = "/lookout/semantic/search"

        json_data = {"query": "semantic search query"}
        json_body = json.dumps(json_data).encode("utf-8")
        query_params = {}

        self.analyzer._extract_post_body_data(mock_request, json_body, query_params)

        assert query_params["semantic_query"] == "semantic search query"

    def test_extract_post_body_data_auth_endpoint(self):
        """Test extracting data from auth endpoint POST body"""
        mock_request = MagicMock(spec=Request)
        mock_request.headers.get.return_value = "application/json"
        mock_request.url.path = "/auth/login"

        json_data = {"email": "user@example.com", "password": "secret"}
        json_body = json.dumps(json_data).encode("utf-8")
        query_params = {}

        self.analyzer._extract_post_body_data(mock_request, json_body, query_params)

        assert query_params["email"] == "user@example.com"
        # Password should not be extracted for security

    def test_extract_post_body_data_invalid_json(self):
        """Test handling invalid JSON in POST body"""
        mock_request = MagicMock(spec=Request)
        mock_request.headers.get.return_value = "application/json"
        mock_request.url.path = "/agent"

        query_params = {}

        with patch("src.app.middleware.request_analyzer.logger") as mock_logger:
            self.analyzer._extract_post_body_data(mock_request, b"invalid json", query_params)

            # Should not modify query_params
            assert query_params == {}
            mock_logger.debug.assert_called()

    def test_extract_post_body_data_non_json_content_type(self):
        """Test skipping extraction for non-JSON content types"""
        mock_request = MagicMock(spec=Request)
        mock_request.headers.get.return_value = "text/plain"

        query_params = {}
        self.analyzer._extract_post_body_data(mock_request, b"plain text", query_params)

        # Should not modify query_params
        assert query_params == {}

    def test_get_client_ip_forwarded_for(self):
        """Test extracting client IP from X-Forwarded-For header"""
        mock_request = MagicMock(spec=Request)
        mock_request.headers.get.side_effect = lambda key: {"x-forwarded-for": "203.0.113.1, 198.51.100.2"}.get(key)

        result = self.analyzer._get_client_ip(mock_request)
        assert result == "203.0.113.1"

    def test_get_client_ip_real_ip(self):
        """Test extracting client IP from X-Real-IP header"""
        mock_request = MagicMock(spec=Request)
        mock_request.headers.get.side_effect = lambda key: {
            "x-forwarded-for": None,
            "x-forwarded": None,
            "x-real-ip": "203.0.113.5",
        }.get(key)

        result = self.analyzer._get_client_ip(mock_request)
        assert result == "203.0.113.5"

    def test_get_client_ip_from_client_host(self):
        """Test extracting client IP from request.client.host"""
        mock_request = MagicMock(spec=Request)
        mock_request.headers.get.return_value = None
        mock_request.client.host = "192.168.1.100"

        result = self.analyzer._get_client_ip(mock_request)
        assert result == "192.168.1.100"

    def test_get_client_ip_unknown(self):
        """Test fallback to 'unknown' when no IP available"""
        mock_request = MagicMock(spec=Request)
        mock_request.headers.get.return_value = None
        mock_request.client = None

        result = self.analyzer._get_client_ip(mock_request)
        assert result == "unknown"

    def test_determine_service_type_mappings(self):
        """Test service type determination for various paths"""
        test_cases = [
            ("/agent", "ask-agent"),
            ("/lookup/assets", "lookup-service"),
            ("/api/asset/123", "lookup-service"),
            ("/sqlagent/query", "ask-sql-agent"),
            ("/lookout/semantic/search", "semantic-search"),
            ("/auth/login", "auth"),
            ("/analytics/dashboard", "analytics"),
            ("/reset-password", "frontend"),
            ("/", "frontend"),
            ("/unknown/path", "other"),
        ]

        for path, expected_service in test_cases:
            result = self.analyzer._determine_service_type(path)
            assert result == expected_service, f"Path {path} should map to {expected_service}, got {result}"
