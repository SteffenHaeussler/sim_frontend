import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from jose import JWTError, jwt
from pydantic import BaseModel

from src.app.utils.config_helpers import config_helper


class TokenData(BaseModel):
    user_id: str | None = None
    email: str | None = None
    organisation_id: str | None = None
    token_type: str | None = None  # Expected values: "access" or "refresh"


def _create_token(
    user_id: uuid.UUID,
    email: str,
    token_type: str,
    expires_delta: timedelta,
    organisation_id: uuid.UUID | None = None,
) -> str:
    """Base function to create JWT tokens"""
    jwt_config = config_helper.jwt_config

    to_encode = {
        "sub": str(user_id),
        "email": email,
        "token_type": token_type,
        "exp": datetime.now(UTC) + expires_delta,
        "iat": datetime.now(UTC),
        "jti": str(uuid.uuid4()),  # JWT ID for token tracking
    }

    if organisation_id:
        to_encode["org_id"] = str(organisation_id)

    return jwt.encode(
        to_encode,
        jwt_config["secret_key"],
        algorithm=jwt_config["algorithm"],
    )


def create_access_token(
    user_id: uuid.UUID,
    email: str,
    organisation_id: uuid.UUID | None = None,
    expires_delta: timedelta | None = None,
) -> str:
    """Create JWT access token"""
    if not expires_delta:
        jwt_config = config_helper.jwt_config
        expires_delta = timedelta(minutes=jwt_config["access_expiration_minutes"])

    return _create_token(
        user_id=user_id,
        email=email,
        token_type="access",
        expires_delta=expires_delta,
        organisation_id=organisation_id,
    )


def create_refresh_token(
    user_id: uuid.UUID,
    email: str,
    organisation_id: uuid.UUID | None = None,
    expires_delta: timedelta | None = None,
) -> str:
    """Create JWT refresh token"""
    if not expires_delta:
        jwt_config = config_helper.jwt_config
        expires_delta = timedelta(days=jwt_config["refresh_expiration_days"])

    return _create_token(
        user_id=user_id,
        email=email,
        token_type="refresh",
        expires_delta=expires_delta,
        organisation_id=organisation_id,
    )


def verify_token(token: str, expected_token_type: str) -> TokenData | None:
    """
    Verify and decode JWT token, checking for expected token type.

    Args:
        token: JWT token to verify.
        expected_token_type: The expected type of the token ("access" or "refresh").

    Returns:
        TokenData: Decoded token data or None if invalid or wrong type.
    """
    try:
        jwt_config = config_helper.jwt_config
        payload = jwt.decode(
            token,
            jwt_config["secret_key"],
            algorithms=[jwt_config["algorithm"]],
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


def decode_token(token: str) -> dict[str, Any] | None:
    """
    Decode JWT token without verification (for debugging)

    Args:
        token: JWT token to decode

    Returns:
        Dict: Decoded payload or None if invalid
    """
    try:
        jwt_config = config_helper.jwt_config
        payload = jwt.decode(
            token,
            jwt_config["secret_key"],
            algorithms=[jwt_config["algorithm"]],
        )
        return payload
    except JWTError:
        return None
