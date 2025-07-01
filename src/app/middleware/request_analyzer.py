import json
import uuid
from typing import Any, Dict

from fastapi import Request
from loguru import logger

from src.app.auth.jwt_utils import verify_token


class RequestAnalyzer:
    """Analyzes incoming requests to extract metadata and authentication info"""

    async def extract_user_info(self, request: Request) -> Dict[str, Any]:
        """Extract user ID and organization ID from request"""
        user_id = None
        organisation_id = None

        try:
            auth_header = request.headers.get("authorization")
            if auth_header:
                # Properly validate and extract Bearer token
                parts = auth_header.split()
                if len(parts) == 2 and parts[0].lower() == "bearer":
                    token = parts[1]
                    token_data = verify_token(token)
                    if token_data and token_data.user_id:
                        user_id = uuid.UUID(token_data.user_id)

                        if token_data.organisation_id:
                            organisation_id = uuid.UUID(token_data.organisation_id)
                elif len(parts) == 2:
                    logger.debug(f"Invalid authorization scheme: {parts[0]}")
                else:
                    logger.debug("Invalid authorization header format")
        except ValueError as e:
            logger.debug(f"Invalid UUID in token: {e}")
        except Exception as e:
            logger.debug(f"Auth extraction failed: {e}")

        return {"user_id": user_id, "organisation_id": organisation_id}

    def extract_request_metadata(self, request: Request) -> Dict[str, Any]:
        """Extract basic request metadata"""
        user_agent = request.headers.get("user-agent", "")
        ip_address = self._get_client_ip(request)
        service_type = self._determine_service_type(request.url.path)

        return {
            "user_agent": user_agent,
            "ip_address": ip_address,
            "service_type": service_type,
        }

    async def extract_query_and_body_data(self, request: Request) -> Dict[str, Any]:
        """Extract query parameters and request body data"""
        query_params_data = {}

        # Add URL query parameters
        if request.query_params:
            query_params_data.update(dict(request.query_params))

        # Extract tracking IDs - headers first, query params as fallback
        session_id = (
            request.headers.get("x-session-id") 
            or query_params_data.get("session_id")
        )
        if session_id:
            logger.debug(f"Extracted session_id: {session_id}")

        event_id = (
            request.headers.get("x-event-id") 
            or query_params_data.get("event_id")
        )
        
        # Generate request_id if not provided in headers
        request_id = (
            request.headers.get("x-request-id") 
            or str(uuid.uuid4())
        )

        # Add POST body data for specific endpoints
        request_body = await request.body() if hasattr(request, "body") else b""
        request_size = len(request_body) if request_body else None

        if request.method == "POST" and request_body:
            try:
                # Try to parse JSON body
                if request.headers.get("content-type", "").startswith(
                    "application/json"
                ):
                    body_data = json.loads(request_body.decode("utf-8"))
                    if isinstance(body_data, dict):
                        # For semantic search, capture the query
                        if (
                            "/lookout/semantic" in request.url.path
                            and "query" in body_data
                        ):
                            query_params_data["semantic_query"] = body_data["query"]
                        # For other endpoints, capture relevant fields
                        elif "question" in body_data:
                            query_params_data["question"] = body_data["question"]
                        elif "email" in body_data:
                            query_params_data["email"] = body_data[
                                "email"
                            ]  # For auth endpoints
            except (json.JSONDecodeError, UnicodeDecodeError) as e:
                logger.debug(f"Could not parse request body as JSON: {e}")

        query_params = str(query_params_data) if query_params_data else None
        template_used = request.query_params.get(
            "template"
        ) or request.query_params.get("example")

        return {
            "session_id": session_id,
            "event_id": event_id,
            "request_id": request_id,
            "query_params": query_params,
            "request_size": request_size,
            "template_used": template_used,
        }

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
        if path.startswith("/agent"):
            return "ask-agent"
        elif path.startswith("/lookup") or path.startswith("/api"):
            return "lookup-service"
        elif path.startswith("/lookout/semantic"):
            return "semantic-search"
        elif path.startswith("/auth"):
            return "auth"
        elif path.startswith("/analytics"):
            return "analytics"
        elif path == "/" or path.startswith("/reset-password"):
            return "frontend"
        else:
            return "other"
