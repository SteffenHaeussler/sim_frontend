import json
import uuid
from typing import Any

from fastapi import Request
from loguru import logger

from src.app.auth.jwt_utils import verify_token


class RequestAnalyzer:
    """Analyzes incoming requests to extract metadata and authentication info"""

    async def extract_user_info(self, request: Request) -> dict[str, Any]:
        """Extract user ID and organization ID from request"""
        user_id = None
        organisation_id = None

        try:
            auth_header = request.headers.get("authorization")
            if not auth_header:
                return {"user_id": user_id, "organisation_id": organisation_id}

            user_id, organisation_id = self._parse_bearer_token(auth_header)
        except ValueError as e:
            logger.debug(f"Invalid UUID in token: {e}")
        except Exception as e:
            logger.debug(f"Auth extraction failed: {e}")

        return {"user_id": user_id, "organisation_id": organisation_id}

    def _parse_bearer_token(self, auth_header: str) -> tuple[uuid.UUID | None, uuid.UUID | None]:
        """Parse Bearer token from authorization header"""
        parts = auth_header.split()

        if len(parts) != 2:
            logger.debug("Invalid authorization header format")
            return None, None

        if parts[0].lower() != "bearer":
            logger.debug(f"Invalid authorization scheme: {parts[0]}")
            return None, None

        token = parts[1]
        token_data = verify_token(token, expected_token_type="access")

        if not token_data or not token_data.user_id:
            return None, None

        user_id = uuid.UUID(token_data.user_id)
        organisation_id = uuid.UUID(token_data.organisation_id) if token_data.organisation_id else None

        return user_id, organisation_id

    def extract_request_metadata(self, request: Request) -> dict[str, Any]:
        """Extract basic request metadata"""
        user_agent = request.headers.get("user-agent", "")
        ip_address = self._get_client_ip(request)
        service_type = self._determine_service_type(request.url.path)

        return {
            "user_agent": user_agent,
            "ip_address": ip_address,
            "service_type": service_type,
        }

    async def extract_query_and_body_data(self, request: Request) -> dict[str, Any]:
        """Extract query parameters and request body data"""
        # Get query parameters
        query_params_data = dict(request.query_params) if request.query_params else {}

        # Extract tracking IDs
        tracking_ids = self._extract_tracking_ids(request, query_params_data)

        # Get request body data
        request_body = await request.body() if hasattr(request, "body") else b""
        request_size = len(request_body) if request_body else None

        # Extract body data if POST request
        if request.method == "POST" and request_body:
            self._extract_post_body_data(request, request_body, query_params_data)

        query_params = str(query_params_data) if query_params_data else None
        template_used = request.query_params.get("template") or request.query_params.get("example")

        return {
            "session_id": tracking_ids["session_id"],
            "event_id": tracking_ids["event_id"],
            "request_id": tracking_ids["request_id"],
            "query_params": query_params,
            "request_size": request_size,
            "template_used": template_used,
        }

    def _extract_tracking_ids(self, request: Request, query_params_data: dict) -> dict[str, str]:
        """Extract tracking IDs from headers or query params"""
        # Headers first, query params as fallback
        session_id = request.headers.get("x-session-id") or query_params_data.get("session_id")
        if session_id:
            logger.debug(f"Extracted session_id: {session_id}")

        event_id = request.headers.get("x-event-id") or query_params_data.get("event_id")
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())

        return {
            "session_id": session_id,
            "event_id": event_id,
            "request_id": request_id,
        }

    def _extract_post_body_data(self, request: Request, request_body: bytes, query_params_data: dict) -> None:
        """Extract data from POST request body"""
        if not request.headers.get("content-type", "").startswith("application/json"):
            return

        try:
            body_data = json.loads(request_body.decode("utf-8"))
            if not isinstance(body_data, dict):
                return

            # Extract relevant fields based on endpoint
            if "/lookout/semantic" in request.url.path and "query" in body_data:
                query_params_data["semantic_query"] = body_data["query"]
            elif "question" in body_data:
                query_params_data["question"] = body_data["question"]
            elif "email" in body_data:
                query_params_data["email"] = body_data["email"]  # For auth endpoints

        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            logger.debug(f"Could not parse request body as JSON: {e}")

    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address from request"""
        # Check for forwarded headers first (proxy/load balancer)
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()

        forwarded = request.headers.get("x-forwarded")
        if forwarded:
            return forwarded.split(",")[0].strip()

        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip

        # Fallback to client host
        if hasattr(request, "client") and request.client:
            return request.client.host

        return "unknown"

    def _determine_service_type(self, path: str) -> str:
        """Determine which service type is being used"""
        # Define service mappings
        service_mappings = [
            ("/agent", "ask-agent"),
            ("/lookup", "lookup-service"),
            ("/api", "lookup-service"),
            ("/sqlagent", "ask-sql-agent"),
            ("/lookout/semantic", "semantic-search"),
            ("/auth", "auth"),
            ("/analytics", "analytics"),
            ("/reset-password", "frontend"),
        ]

        # Check each mapping
        for prefix, service_type in service_mappings:
            if path.startswith(prefix):
                return service_type

        # Special case for root path
        if path == "/":
            return "frontend"

        return "other"
