import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from jose import JWTError, jwt
from pydantic import BaseModel

from src.app.config import config_service


class TokenData(BaseModel):
    user_id: Optional[str] = None
    email: Optional[str] = None
    organisation_id: Optional[str] = None
    token_type: Optional[str] = None  # Expected values: "access" or "refresh"


def create_access_token(
    user_id: uuid.UUID,
    email: str,
    organisation_id: Optional[uuid.UUID] = None,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Create JWT access token

    Args:
        user_id: User UUID
        email: User email
        organisation_id: User's organisation UUID
        expires_delta: Custom expiration time for the access token.
                       Defaults to JWT_ACCESS_EXPIRATION_MINUTES from config or 15 minutes.

    Returns:
        str: JWT token
    """
    config = config_service.get_jwt_utils()

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        access_token_expire_minutes = config.get(
            "JWT_ACCESS_EXPIRATION_MINUTES", 15
        )
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=access_token_expire_minutes
        )

    to_encode = {
        "sub": str(user_id),
        "email": email,
        "token_type": "access",  # Explicitly set token type
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "jti": str(uuid.uuid4()),  # JWT ID for token tracking
    }

    # Add organisation_id if provided
    if organisation_id:
        to_encode["org_id"] = str(organisation_id)

    encoded_jwt = jwt.encode(
        to_encode,
        config.get("jwt_secret_key"),
        algorithm=config.get("jwt_algorithm"),
    )
    return encoded_jwt


def create_refresh_token(
    user_id: uuid.UUID,
    email: str,
    organisation_id: Optional[uuid.UUID] = None,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Create JWT refresh token.

    Args:
        user_id: User UUID.
        email: User email.
        organisation_id: User's organisation UUID.
        expires_delta: Custom expiration time for the refresh token.
                       Defaults to JWT_REFRESH_EXPIRATION_DAYS from config or 7 days.

    Returns:
        str: JWT refresh token.
    """
    config = config_service.get_jwt_utils()

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        refresh_token_expire_days = config.get(
            "JWT_REFRESH_EXPIRATION_DAYS", 7
        )
        expire = datetime.now(timezone.utc) + timedelta(days=refresh_token_expire_days)

    to_encode = {
        "sub": str(user_id),
        "email": email,
        "token_type": "refresh",  # Explicitly set token type
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "jti": str(uuid.uuid4()),  # JWT ID for token tracking
    }
    if organisation_id:
        to_encode["org_id"] = str(organisation_id)

    encoded_jwt = jwt.encode(
        to_encode,
        config.get("jwt_secret_key"),  # Consider using a different secret for refresh tokens
        algorithm=config.get("jwt_algorithm"),
    )
    return encoded_jwt


def verify_token(token: str, expected_token_type: str) -> Optional[TokenData]:
    """
    Verify and decode JWT token, checking for expected token type.

    Args:
        token: JWT token to verify.
        expected_token_type: The expected type of the token ("access" or "refresh").

    Returns:
        TokenData: Decoded token data or None if invalid or wrong type.
    """
    try:
        config = config_service.get_jwt_utils()
        payload = jwt.decode(
            token,
            config.get("jwt_secret_key"),
            algorithms=[config.get("jwt_algorithm")],
            options={"verify_aud": False},  # No audience claim used yet
        )

        user_id = payload.get("sub")
        token_type = payload.get("token_type")

        if user_id is None or token_type != expected_token_type:
            return None

        token_data = TokenData(
            user_id=user_id,
            email=payload.get("email"),
            organisation_id=payload.get("org_id"),
            token_type=token_type,
        )
        return token_data

    except JWTError:  # Catches expired tokens, invalid signature, etc.
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
        config = config_service.get_jwt_utils()
        payload = jwt.decode(
            token,
            config.get("jwt_secret_key"),
            algorithms=[config.get("jwt_algorithm")],
        )
        return payload
    except JWTError:
        return None
