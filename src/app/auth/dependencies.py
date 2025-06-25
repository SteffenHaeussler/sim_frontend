import uuid
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.auth.jwt_utils import TokenData, verify_token
from src.app.models.database import get_db
from src.app.models.user import User

# Simple Bearer token security
security = HTTPBearer()


def verify_token_only(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> TokenData:
    """
    Simple token verification without database access
    Returns token data for basic authentication check
    """
    token = credentials.credentials

    # Verify and decode token
    token_data: Optional[TokenData] = verify_token(token)
    if not token_data or not token_data.user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return token_data


async def require_active_user(
    token_data: TokenData = Depends(verify_token_only),
    db: AsyncSession = Depends(get_db),
) -> TokenData:
    """
    Require active user for protected endpoints
    Checks that user exists and is_active=True
    """
    # Get user from database to check is_active status
    stmt = select(User).where(User.id == uuid.UUID(token_data.user_id))
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive. Contact administrator.",
        )

    return token_data


def require_auth():
    """
    Simple dependency that just requires a valid token
    Use this for endpoints that don't need user to be active
    """
    return Depends(verify_token_only)


def require_active_auth():
    """
    Dependency that requires valid token AND active user
    Use this for protected endpoints that need active users only
    """
    return Depends(require_active_user)
