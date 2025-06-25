import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from jose import JWTError, jwt
from pydantic import BaseModel

from ..config import get_config


class TokenData(BaseModel):
    user_id: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    organization_id: Optional[str] = None
    session_id: Optional[str] = None
    token_type: Optional[str] = None  # "access" or "refresh"


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


def create_refresh_token(
    user_id: uuid.UUID, session_id: uuid.UUID, expires_delta: Optional[timedelta] = None
) -> str:
    """
    Create JWT refresh token

    Args:
        user_id: User UUID
        session_id: Session UUID
        expires_delta: Custom expiration time

    Returns:
        str: JWT refresh token
    """
    config = get_config()

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            days=config.api_mode.JWT_REFRESH_EXPIRATION_DAYS
        )

    to_encode = {
        "sub": str(user_id),
        "session_id": str(session_id),
        "token_type": "refresh",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "jti": str(uuid.uuid4()),
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


def is_token_expired(token: str) -> bool:
    """
    Check if token is expired without full verification

    Args:
        token: JWT token to check

    Returns:
        bool: True if expired
    """
    try:
        payload = decode_token(token)
        if not payload:
            return True

        exp = payload.get("exp")
        if not exp:
            return True

        return datetime.now(timezone.utc).timestamp() > exp

    except Exception:
        return True


def get_token_remaining_time(token: str) -> Optional[timedelta]:
    """
    Get remaining time until token expires

    Args:
        token: JWT token

    Returns:
        timedelta: Time remaining or None if invalid/expired
    """
    try:
        payload = decode_token(token)
        if not payload:
            return None

        exp = payload.get("exp")
        if not exp:
            return None

        exp_datetime = datetime.fromtimestamp(exp)
        now = datetime.now(timezone.utc)

        if now >= exp_datetime:
            return None

        return exp_datetime - now

    except Exception:
        return None


def create_password_reset_token(user_id: uuid.UUID, expires_minutes: int = 60) -> str:
    """
    Create a password reset token

    Args:
        user_id: User UUID
        expires_minutes: Token expiration in minutes

    Returns:
        str: Password reset token
    """
    config = get_config()
    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)

    to_encode = {
        "sub": str(user_id),
        "token_type": "password_reset",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "jti": str(uuid.uuid4()),
    }

    encoded_jwt = jwt.encode(
        to_encode,
        config.api_mode.JWT_SECRET_KEY,
        algorithm=config.api_mode.JWT_ALGORITHM,
    )
    return encoded_jwt
