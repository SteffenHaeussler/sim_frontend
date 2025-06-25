from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid
from typing import Optional
import time

from ..models.user import User
from ..models.audit import AuditLog
from ..models.database import get_db
from .jwt_utils import verify_token

class AuthenticationMiddleware(BaseHTTPMiddleware):
    """
    Middleware for authentication and audit logging
    """
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
        # Paths that don't require authentication
        self.public_paths = {
            "/",
            "/health",
            "/static",
            "/docs",
            "/openapi.json",
            "/redoc",
        }
        # Paths that require authentication
        self.protected_paths = {
            "/agent",
            "/lookup",
            "/api",
        }
    
    async def dispatch(self, request: Request, call_next):
        """Process request with authentication and logging"""
        start_time = time.time()
        
        # Skip authentication for public paths
        if self._is_public_path(request.url.path):
            response = await call_next(request)
            return response
        
        # Extract user information if authenticated
        user = await self._get_user_from_request(request)
        
        # Add user to request state for access in endpoints
        request.state.user = user
        request.state.is_authenticated = user is not None
        
        # Check if path requires authentication
        if self._requires_authentication(request.url.path) and not user:
            return JSONResponse(
                status_code=401,
                content={"detail": "Authentication required"},
                headers={"WWW-Authenticate": "Bearer"}
            )
        
        # Process request
        try:
            response = await call_next(request)
            
            # Log successful request
            if user:
                await self._log_request(
                    request, 
                    response.status_code, 
                    user, 
                    time.time() - start_time,
                    success=True
                )
            
            return response
            
        except Exception as e:
            # Log failed request
            if user:
                await self._log_request(
                    request, 
                    500, 
                    user, 
                    time.time() - start_time,
                    success=False,
                    error_message=str(e)
                )
            raise
    
    def _is_public_path(self, path: str) -> bool:
        """Check if path is public (doesn't require authentication)"""
        # Exact matches
        if path in self.public_paths:
            return True
        
        # Prefix matches (for static files, etc.)
        for public_path in self.public_paths:
            if path.startswith(public_path):
                return True
        
        return False
    
    def _requires_authentication(self, path: str) -> bool:
        """Check if path requires authentication"""
        for protected_path in self.protected_paths:
            if path.startswith(protected_path):
                return True
        return False
    
    async def _get_user_from_request(self, request: Request) -> Optional[User]:
        """Extract and validate user from request"""
        try:
            # Get authorization header
            authorization = request.headers.get("Authorization")
            if not authorization or not authorization.startswith("Bearer "):
                return None
            
            # Extract and verify token
            token = authorization.split(" ")[1]
            token_data = verify_token(token)
            if not token_data or not token_data.user_id:
                return None
            
            # Get database session (this is a simplified approach)
            # In a real implementation, you might want to use a connection pool
            async for db in get_db():
                try:
                    user_id = uuid.UUID(token_data.user_id)
                    stmt = select(User).where(User.id == user_id)
                    result = await db.execute(stmt)
                    user = result.scalar_one_or_none()
                    
                    if user and user.can_login:
                        return user
                    
                except Exception:
                    pass
                finally:
                    break  # Exit the async generator
            
        except Exception:
            pass
        
        return None
    
    async def _log_request(
        self, 
        request: Request, 
        status_code: int, 
        user: User,
        duration: float,
        success: bool = True,
        error_message: Optional[str] = None
    ):
        """Log request for audit purposes"""
        try:
            # Determine action based on method and path
            action = self._get_action_from_request(request)
            
            # Get client IP
            client_ip = request.client.host if request.client else None
            
            # Get user agent
            user_agent = request.headers.get("User-Agent")
            
            # Create audit log entry
            async for db in get_db():
                try:
                    audit_log = AuditLog.log_action(
                        action=action,
                        user_id=user.id,
                        organization_id=user.organization_id,
                        resource=self._get_resource_from_path(request.url.path),
                        details={
                            "method": request.method,
                            "path": request.url.path,
                            "status_code": status_code,
                            "duration_ms": round(duration * 1000, 2),
                            "query_params": dict(request.query_params) if request.query_params else None
                        },
                        ip_address=client_ip,
                        user_agent=user_agent,
                        success=success,
                        error_message=error_message
                    )
                    
                    db.add(audit_log)
                    await db.commit()
                    
                except Exception:
                    pass  # Don't let audit logging break the request
                finally:
                    break
                    
        except Exception:
            pass  # Silently fail audit logging
    
    def _get_action_from_request(self, request: Request) -> str:
        """Determine action type from request"""
        method = request.method.upper()
        path = request.url.path
        
        if path.startswith("/agent"):
            return "agent_query"
        elif path.startswith("/lookup"):
            return "lookup_query"
        elif path.startswith("/api"):
            return f"api_{method.lower()}"
        else:
            return f"http_{method.lower()}"
    
    def _get_resource_from_path(self, path: str) -> str:
        """Extract resource name from path"""
        if path.startswith("/agent"):
            return "agent"
        elif path.startswith("/lookup"):
            return "lookup"
        elif path.startswith("/api"):
            return "api"
        else:
            return "web"

class RateLimitingMiddleware(BaseHTTPMiddleware):
    """
    Simple rate limiting middleware
    """
    
    def __init__(self, app: ASGIApp, requests_per_minute: int = 60):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.request_counts = {}  # In production, use Redis or similar
    
    async def dispatch(self, request: Request, call_next):
        """Apply rate limiting"""
        client_ip = request.client.host if request.client else "unknown"
        current_minute = int(time.time() // 60)
        
        # Clean old entries (simple cleanup)
        self.request_counts = {
            key: count for key, count in self.request_counts.items() 
            if key[1] >= current_minute - 1
        }
        
        # Check current rate
        key = (client_ip, current_minute)
        current_count = self.request_counts.get(key, 0)
        
        if current_count >= self.requests_per_minute:
            return JSONResponse(
                status_code=429,
                content={"detail": "Rate limit exceeded"},
                headers={"Retry-After": "60"}
            )
        
        # Increment counter
        self.request_counts[key] = current_count + 1
        
        # Process request
        response = await call_next(request)
        return response