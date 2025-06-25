from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .jwt_utils import TokenData, verify_token

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


def require_auth():
    """
    Simple dependency that just requires a valid token
    Use this for endpoints that don't need full user object
    """
    return Depends(verify_token_only)
