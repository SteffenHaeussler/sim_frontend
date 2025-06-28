import time

from fastapi import Request
from loguru import logger

from src.app.context import ctx_session_id
from src.app.middleware.request_analyzer import RequestAnalyzer
from src.app.middleware.response_analyzer import ResponseAnalyzer
from src.app.middleware.usage_logger import UsageLogger


class ApiUsageTracker:
    """Middleware to track API usage for analytics and billing"""

    def __init__(self):
        self.excluded_paths = {
            "/health",
            "/static",
            "/favicon.ico",
            "/docs",
            "/openapi.json",
            "/__pycache__",  # Static files and system endpoints
        }
        self.request_analyzer = RequestAnalyzer()
        self.response_analyzer = ResponseAnalyzer()
        self.usage_logger = UsageLogger()

    async def __call__(self, request: Request, call_next):
        start_time = time.time()

        # Skip tracking for excluded paths
        if any(request.url.path.startswith(path) for path in self.excluded_paths):
            return await call_next(request)

        # Extract user info
        user_info = await self.request_analyzer.extract_user_info(request)

        # Extract request metadata
        request_metadata = self.request_analyzer.extract_request_metadata(request)

        # Extract query and body data
        query_body_data = await self.request_analyzer.extract_query_and_body_data(
            request
        )

        # Set session_id in context for logging
        session_id = query_body_data.get("session_id", "-")
        ctx_session_id.set(session_id)

        # Execute request
        response = await call_next(request)

        # Calculate duration
        duration_ms = (time.time() - start_time) * 1000

        # Extract response data
        response_data = self.response_analyzer.extract_response_data(response)

        if request_metadata["service_type"] in [
            "ask-agent",
            "lookup-service",
            "semantic-search",
        ]:
            # We'll need to get the usage_log_id first, so this is handled in the logger
            pass

        # Log usage
        await self._log_usage(
            request,
            response,
            user_info,
            request_metadata,
            query_body_data,
            response_data,
            duration_ms,
        )

        return response

    async def _log_usage(
        self,
        request,
        response,
        user_info,
        request_metadata,
        query_body_data,
        response_data,
        duration_ms,
    ):
        """Log usage data to database"""
        try:
            # First create the usage log
            usage_log_id = await self.usage_logger.log_usage(
                endpoint=request.url.path,
                method=request.method,
                status_code=response.status_code,
                duration_ms=duration_ms,
                user_id=user_info["user_id"],
                organisation_id=user_info["organisation_id"],
                session_id=query_body_data["session_id"],
                event_id=query_body_data["event_id"],
                user_agent=request_metadata["user_agent"],
                ip_address=request_metadata["ip_address"],
                query_params=query_body_data["query_params"],
                request_size=query_body_data["request_size"],
                response_size=response_data["response_size"],
                service_type=request_metadata["service_type"],
                template_used=query_body_data["template_used"],
                error_message=response_data["error_message"],
            )

            # Then create response metadata if needed and we have a usage_log_id
            if usage_log_id and request_metadata["service_type"] in [
                "ask-agent",
                "lookup-service",
                "semantic-search",
            ]:
                response_metadata = self.response_analyzer.create_response_metadata(
                    usage_log_id,
                    response,
                    response_data["response_body"],
                    duration_ms,
                    response_data["content_type"],
                    request_metadata["service_type"],
                    response_data["error_message"],
                )

                # Log the response metadata separately
                from src.app.models.database import get_db

                async for db in get_db():
                    db.add(response_metadata)
                    await db.commit()
                    break

        except Exception as e:
            logger.error(f"Failed to log usage: {e}")
