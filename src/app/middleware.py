import time
import uuid
from typing import Optional

from fastapi import Request
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.context import ctx_request_id
from src.app.models.database import get_db
from src.app.models.user import ApiUsageLog, User, ApiResponseMetadata
from src.app.auth.jwt_utils import verify_token


class RequestTimer:
    async def __call__(self, request: Request, call_next):
        logger.info("Incoming request")
        start_time = time.time()

        response = await call_next(request)

        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = str(process_time)

        logger.info(f"Processing this request took {process_time} seconds")

        return response


async def add_request_id(request: Request, call_next):
    ctx_request_id.set(uuid.uuid4().hex)
    response = await call_next(request)

    response.headers["x-request-id"] = ctx_request_id.get()
    return response


class ApiUsageTracker:
    """Middleware to track API usage for analytics and billing"""
    
    def __init__(self):
        self.excluded_paths = {
            "/health", 
            "/static", 
            "/favicon.ico", 
            "/docs", 
            "/openapi.json",
            "/__pycache__"  # Static files and system endpoints
        }
    
    async def __call__(self, request: Request, call_next):
        start_time = time.time()
        request_id = ctx_request_id.get()
        
        # Skip tracking for excluded paths
        if any(request.url.path.startswith(path) for path in self.excluded_paths):
            return await call_next(request)
        
        # Extract request metadata
        user_agent = request.headers.get("user-agent", "")
        ip_address = self._get_client_ip(request)
        # Extract session_id from frontend (passed via header)
        session_id = request.headers.get("x-session-id")
        
        # Extract authentication info
        user_id = None
        organisation_id = None
        try:
            auth_header = request.headers.get("authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header[7:]
                token_data = verify_token(token)
                if token_data and token_data.user_id:
                    user_id = uuid.UUID(token_data.user_id)
                    # Get organisation_id from user
                    async for db in get_db():
                        from sqlalchemy import select
                        stmt = select(User).where(User.id == user_id)
                        result = await db.execute(stmt)
                        user = result.scalar_one_or_none()
                        if user:
                            organisation_id = user.organisation_id
                        break
        except Exception as e:
            logger.debug(f"Auth extraction failed: {e}")
        
        # Determine service type
        service_type = self._determine_service_type(request.url.path)
        
        # Get request body and size
        request_body = await request.body() if hasattr(request, 'body') else b''
        request_size = len(request_body) if request_body else None
        
        # Execute request
        response = await call_next(request)
        
        # Calculate duration
        duration_ms = (time.time() - start_time) * 1000
        
        # Get response body and metadata
        response_body = None
        response_size = None
        content_type = response.headers.get("content-type", "")
        
        # Try to read response body safely
        try:
            if hasattr(response, 'body') and response.body:
                response_body = response.body
                response_size = len(response_body)
            elif hasattr(response, '_body') and response._body:
                response_body = response._body  
                response_size = len(response_body)
        except Exception as e:
            logger.debug(f"Could not read response body: {e}")
        
        # Extract query parameters and request body data
        query_params_data = {}
        
        # Add URL query parameters
        if request.query_params:
            query_params_data.update(dict(request.query_params))
        
        # Add POST body data for specific endpoints
        if request.method == "POST" and request_body:
            try:
                import json
                # Try to parse JSON body
                if request.headers.get("content-type", "").startswith("application/json"):
                    body_data = json.loads(request_body.decode('utf-8'))
                    if isinstance(body_data, dict):
                        # For semantic search, capture the query
                        if "/lookout/semantic" in request.url.path and "query" in body_data:
                            query_params_data["semantic_query"] = body_data["query"]
                        # For other endpoints, capture relevant fields
                        elif "question" in body_data:
                            query_params_data["question"] = body_data["question"]
                        elif "email" in body_data:
                            query_params_data["email"] = body_data["email"]  # For auth endpoints
            except (json.JSONDecodeError, UnicodeDecodeError) as e:
                logger.debug(f"Could not parse request body as JSON: {e}")
        
        query_params = str(query_params_data) if query_params_data else None
        
        # Extract template usage from query params
        template_used = request.query_params.get("template") or request.query_params.get("example")
        
        # Determine error message if applicable
        error_message = None
        if response.status_code >= 400:
            error_message = f"HTTP {response.status_code}"
        
        # Log the API usage and response metadata asynchronously
        try:
            async for db in get_db():
                # Create and save usage log
                usage_log = ApiUsageLog.log_api_call(
                    endpoint=request.url.path,
                    method=request.method,
                    status_code=response.status_code,
                    duration_ms=duration_ms,
                    user_id=user_id,
                    organisation_id=organisation_id,
                    session_id=session_id,
                    request_id=request_id,
                    user_agent=user_agent,
                    ip_address=ip_address,
                    query_params=query_params,
                    request_size=request_size,
                    response_size=response_size,
                    service_type=service_type,
                    template_used=template_used,
                    error_message=error_message,
                )
                
                db.add(usage_log)
                await db.flush()  # Get the usage_log.id without committing yet
                
                # Create response metadata if this is a service endpoint
                if service_type in ['ask-agent', 'lookup-service', 'semantic-search']:
                    response_metadata = self._create_response_metadata(
                        usage_log.id, 
                        response, 
                        response_body, 
                        duration_ms, 
                        content_type,
                        service_type,
                        error_message
                    )
                    db.add(response_metadata)
                
                await db.commit()
                break
        except Exception as e:
            logger.error(f"Failed to log API usage and response metadata: {e}")
        
        return response
    
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
        if hasattr(request, 'client') and request.client:
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
    
    def _create_response_metadata(
        self, 
        usage_log_id: uuid.UUID, 
        response, 
        response_body: bytes, 
        duration_ms: float, 
        content_type: str,
        service_type: str,
        error_message: str = None
    ) -> ApiResponseMetadata:
        """Create response metadata entry"""
        
        # Analyze response content
        content_preview = None
        has_images = False
        image_count = 0
        processing_steps = None
        error_type = None
        
        if response_body:
            try:
                # Try to decode response as text for preview
                if content_type.startswith("application/json") or content_type.startswith("text/"):
                    response_text = response_body.decode('utf-8')
                    content_preview = response_text[:500]  # First 500 characters
                    
                    # Check for images in ask-agent responses
                    if service_type == 'ask-agent' and "$%$%Plot:" in response_text:
                        has_images = True
                        image_count = response_text.count("$%$%Plot:")
                    
                    # Extract processing steps for semantic search
                    if service_type == 'semantic-search':
                        processing_steps = "embedding→search→ranking"
                        
            except UnicodeDecodeError:
                content_preview = f"Binary content ({len(response_body)} bytes)"
        
        # Determine error type from status code
        if response.status_code >= 400:
            if response.status_code == 401:
                error_type = "authentication_error"
            elif response.status_code == 403:
                error_type = "authorization_error"
            elif response.status_code == 404:
                error_type = "not_found_error"
            elif response.status_code == 422:
                error_type = "validation_error"
            elif response.status_code >= 500:
                error_type = "server_error"
            else:
                error_type = "client_error"
        
        return ApiResponseMetadata.create_metadata(
            usage_log_id=usage_log_id,
            response_status_code=response.status_code,
            response_size_bytes=len(response_body) if response_body else None,
            response_time_ms=duration_ms,
            content_type=content_type,
            content_preview=content_preview,
            has_images=has_images,
            image_count=image_count,
            processing_steps=processing_steps,
            error_type=error_type,
            error_details=error_message,
        )
