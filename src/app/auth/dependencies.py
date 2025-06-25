from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List
import uuid

from ..models.database import get_db
from ..models.user import User
from ..models.session import UserSession
from .jwt_utils import verify_token, TokenData

# Security scheme for Bearer token
security = HTTPBearer()

class AuthenticationError(HTTPException):
    def __init__(self, detail: str = "Authentication failed"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )

class PermissionError(HTTPException):
    def __init__(self, detail: str = "Insufficient permissions"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
        )

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Get current authenticated user from JWT token
    
    Args:
        credentials: Bearer token credentials
        db: Database session
    
    Returns:
        User: Current authenticated user
    
    Raises:
        AuthenticationError: If token is invalid or user not found
    """
    token = credentials.credentials
    
    # Verify and decode token
    token_data: Optional[TokenData] = verify_token(token)
    if not token_data or not token_data.user_id:
        raise AuthenticationError("Invalid authentication token")
    
    try:
        user_id = uuid.UUID(token_data.user_id)
    except ValueError:
        raise AuthenticationError("Invalid user ID in token")
    
    # Get user from database
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user:
        raise AuthenticationError("User not found")
    
    # Verify session is still valid if session_id is in token
    if token_data.session_id:
        try:
            session_id = uuid.UUID(token_data.session_id)
            session_stmt = select(UserSession).where(
                UserSession.id == session_id,
                UserSession.user_id == user_id,
                UserSession.is_active == True
            )
            session_result = await db.execute(session_stmt)
            session = session_result.scalar_one_or_none()
            
            if not session or not session.is_valid:
                raise AuthenticationError("Session expired or invalid")
            
            # Update session last used time
            session.update_last_used()
            await db.commit()
            
        except ValueError:
            raise AuthenticationError("Invalid session ID in token")
    
    return user

async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Get current active user (must be active and verified)
    
    Args:
        current_user: Current authenticated user
    
    Returns:
        User: Current active user
    
    Raises:
        AuthenticationError: If user is not active or verified
    """
    if not current_user.can_login:
        if not current_user.is_active:
            raise AuthenticationError("User account is deactivated")
        elif not current_user.is_verified:
            raise AuthenticationError("User account is not verified")
        elif current_user.is_locked:
            raise AuthenticationError("User account is locked")
        else:
            raise AuthenticationError("User cannot login")
    
    return current_user

def require_permissions(
    required_permissions: List[tuple]  # List of (resource, action) tuples
):
    """
    Dependency factory for requiring specific permissions
    
    Args:
        required_permissions: List of (resource, action) tuples required
    
    Returns:
        Dependency function that checks permissions
    
    Example:
        @app.get("/admin")
        async def admin_endpoint(
            user: User = Depends(require_permissions([("users", "write")]))
        ):
            pass
    """
    async def check_permissions(
        current_user: User = Depends(get_current_active_user)
    ) -> User:
        """Check if user has all required permissions"""
        for resource, action in required_permissions:
            if not current_user.has_permission(resource, action):
                raise PermissionError(
                    f"Permission denied: requires {action} access to {resource}"
                )
        return current_user
    
    return check_permissions

def require_role(allowed_roles: List[str]):
    """
    Dependency factory for requiring specific roles
    
    Args:
        allowed_roles: List of role names that are allowed
    
    Returns:
        Dependency function that checks roles
    
    Example:
        @app.get("/admin")
        async def admin_endpoint(
            user: User = Depends(require_role(["admin", "manager"]))
        ):
            pass
    """
    async def check_role(
        current_user: User = Depends(get_current_active_user)
    ) -> User:
        """Check if user has allowed role"""
        if current_user.role.name not in allowed_roles:
            raise PermissionError(
                f"Access denied: requires one of these roles: {', '.join(allowed_roles)}"
            )
        return current_user
    
    return check_role

async def get_optional_user(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """
    Get current user if authenticated, None otherwise
    Useful for endpoints that work with both authenticated and anonymous users
    
    Args:
        request: FastAPI request object
        db: Database session
    
    Returns:
        User or None: Current user if authenticated
    """
    authorization = request.headers.get("Authorization")
    if not authorization or not authorization.startswith("Bearer "):
        return None
    
    try:
        token = authorization.split(" ")[1]
        token_data = verify_token(token)
        if not token_data or not token_data.user_id:
            return None
        
        user_id = uuid.UUID(token_data.user_id)
        stmt = select(User).where(User.id == user_id)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
        
        if user and user.can_login:
            return user
        
    except Exception:
        pass
    
    return None

# Convenience dependencies
require_admin = require_role(["admin"])
require_manager = require_role(["admin", "manager"])
require_engineer = require_role(["admin", "manager", "engineer"])

# Common permission combinations
require_user_management = require_permissions([("users", "write")])
require_monitoring_access = require_permissions([("monitoring", "read")])
require_monitoring_write = require_permissions([("monitoring", "write")])
require_api_access = require_permissions([("api", "read")])