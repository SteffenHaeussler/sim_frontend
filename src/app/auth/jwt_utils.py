import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from jose import JWTError, jwt
from pydantic import BaseModel

from src.app.config import get_config


class TokenData(BaseModel):
    user_id: Optional[str] = None
    email: Optional[str] = None
    token_type: Optional[str] = None  # "access"


def create_access_token(
    user_id: uuid.UUID,
    email: str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Create JWT access token

    Args:
        user_id: User UUID
        email: User email
        expires_delta: Custom expiration time

    Returns:
        str: JWT token
    """
    config = get_config()

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            hours=config.api_mode.JWT_EXPIRATION_HOURS
        )

    to_encode = {
        "sub": str(user_id),
        "email": email,
        "token_type": "access",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "jti": str(uuid.uuid4()),  # JWT ID for token tracking
    }

    encoded_jwt = jwt.encode(
        to_encode,
        config.api_mode.JWT_SECRET_KEY,
        algorithm=config.api_mode.JWT_ALGORITHM,
    )
    return encoded_jwt


def verify_token(token: str) -> Optional[TokenData]:
    """
    Verify and decode JWT token

    Args:
        token: JWT token to verify

    Returns:
        TokenData: Decoded token data or None if invalid
    """
    try:
        config = get_config()
        payload = jwt.decode(
            token,
            config.api_mode.JWT_SECRET_KEY,
            algorithms=[config.api_mode.JWT_ALGORITHM],
        )

        user_id = payload.get("sub")
        if user_id is None:
            return None

        token_data = TokenData(
            user_id=user_id,
            email=payload.get("email"),
            token_type=payload.get("token_type", "access"),
        )
        return token_data

    except JWTError:
        return None


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Decode JWT token without verification (for debugging)

    Args:
        token: JWT token to decode

    Returns:
        Dict: Decoded payload or None if invalid
    """
    try:
        config = get_config()
        payload = jwt.decode(
            token,
            config.api_mode.JWT_SECRET_KEY,
            algorithms=[config.api_mode.JWT_ALGORITHM],
        )
        return payload
    except JWTError:
        return None
