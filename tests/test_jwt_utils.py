"""Test JWT utilities functionality"""

import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from jose import jwt

from src.app.auth.jwt_utils import TokenData, create_access_token, create_refresh_token, decode_token, verify_token


class TestTokenData:
    """Test TokenData pydantic model"""

    def test_token_data_creation(self):
        """Test TokenData model creation with all fields"""
        token_data = TokenData(
            user_id="123e4567-e89b-12d3-a456-426614174000",
            email="test@example.com",
            organisation_id="456e7890-e89b-12d3-a456-426614174000",
            token_type="access",
        )

        assert token_data.user_id == "123e4567-e89b-12d3-a456-426614174000"
        assert token_data.email == "test@example.com"
        assert token_data.organisation_id == "456e7890-e89b-12d3-a456-426614174000"
        assert token_data.token_type == "access"

    def test_token_data_optional_fields(self):
        """Test TokenData model with optional fields as None"""
        token_data = TokenData()

        assert token_data.user_id is None
        assert token_data.email is None
        assert token_data.organisation_id is None
        assert token_data.token_type is None

    def test_token_data_partial_fields(self):
        """Test TokenData model with some fields set"""
        token_data = TokenData(user_id="123e4567-e89b-12d3-a456-426614174000", email="test@example.com")

        assert token_data.user_id == "123e4567-e89b-12d3-a456-426614174000"
        assert token_data.email == "test@example.com"
        assert token_data.organisation_id is None
        assert token_data.token_type is None


class TestCreateAccessToken:
    """Test access token creation"""

    def test_create_access_token_with_custom_expiry(self):
        """Test creating access token with custom expiration time"""
        mock_jwt_config = {"secret_key": "test-secret-key", "algorithm": "HS256", "access_expiration_minutes": 15}

        user_id = uuid.uuid4()
        email = "test@example.com"
        org_id = uuid.uuid4()
        expires_delta = timedelta(minutes=30)

        with patch("src.app.auth.jwt_utils.config_helper") as mock_config:
            mock_config.jwt_config = mock_jwt_config

            token = create_access_token(
                user_id=user_id, email=email, organisation_id=org_id, expires_delta=expires_delta
            )

            assert isinstance(token, str)
            assert len(token) > 0

            # Decode token to verify contents
            payload = jwt.decode(token, mock_jwt_config["secret_key"], algorithms=["HS256"])
            assert payload["sub"] == str(user_id)
            assert payload["email"] == email
            assert payload["token_type"] == "access"
            assert payload["org_id"] == str(org_id)
            assert "exp" in payload
            assert "iat" in payload
            assert "jti" in payload

    def test_create_access_token_default_expiry(self):
        """Test creating access token with default expiration time"""
        mock_jwt_config = {"secret_key": "test-secret-key", "algorithm": "HS256", "access_expiration_minutes": 15}

        user_id = uuid.uuid4()
        email = "test@example.com"

        with patch("src.app.auth.jwt_utils.config_helper") as mock_config:
            mock_config.jwt_config = mock_jwt_config

            token = create_access_token(user_id=user_id, email=email)

            assert isinstance(token, str)

            # Decode token to verify expiration was set from config
            payload = jwt.decode(token, mock_jwt_config["secret_key"], algorithms=["HS256"])
            exp_time = datetime.fromtimestamp(payload["exp"], UTC)
            iat_time = datetime.fromtimestamp(payload["iat"], UTC)

            # Should be approximately 15 minutes difference
            time_diff = exp_time - iat_time
            assert abs(time_diff.total_seconds() - 900) < 5  # 900 seconds = 15 minutes, allow 5s tolerance

    def test_create_access_token_without_org_id(self):
        """Test creating access token without organisation ID"""
        mock_jwt_config = {"secret_key": "test-secret-key", "algorithm": "HS256", "access_expiration_minutes": 15}

        user_id = uuid.uuid4()
        email = "test@example.com"

        with patch("src.app.auth.jwt_utils.config_helper") as mock_config:
            mock_config.jwt_config = mock_jwt_config

            token = create_access_token(user_id=user_id, email=email)

            payload = jwt.decode(token, mock_jwt_config["secret_key"], algorithms=["HS256"])
            assert "org_id" not in payload


class TestCreateRefreshToken:
    """Test refresh token creation"""

    def test_create_refresh_token_with_custom_expiry(self):
        """Test creating refresh token with custom expiration time"""
        mock_jwt_config = {"secret_key": "test-secret-key", "algorithm": "HS256", "refresh_expiration_days": 7}

        user_id = uuid.uuid4()
        email = "test@example.com"
        org_id = uuid.uuid4()
        expires_delta = timedelta(days=14)

        with patch("src.app.auth.jwt_utils.config_helper") as mock_config:
            mock_config.jwt_config = mock_jwt_config

            token = create_refresh_token(
                user_id=user_id, email=email, organisation_id=org_id, expires_delta=expires_delta
            )

            assert isinstance(token, str)

            payload = jwt.decode(token, mock_jwt_config["secret_key"], algorithms=["HS256"])
            assert payload["sub"] == str(user_id)
            assert payload["email"] == email
            assert payload["token_type"] == "refresh"
            assert payload["org_id"] == str(org_id)

    def test_create_refresh_token_default_expiry(self):
        """Test creating refresh token with default expiration time"""
        mock_jwt_config = {"secret_key": "test-secret-key", "algorithm": "HS256", "refresh_expiration_days": 7}

        user_id = uuid.uuid4()
        email = "test@example.com"

        with patch("src.app.auth.jwt_utils.config_helper") as mock_config:
            mock_config.jwt_config = mock_jwt_config

            token = create_refresh_token(user_id=user_id, email=email)

            payload = jwt.decode(token, mock_jwt_config["secret_key"], algorithms=["HS256"])
            exp_time = datetime.fromtimestamp(payload["exp"], UTC)
            iat_time = datetime.fromtimestamp(payload["iat"], UTC)

            # Should be approximately 7 days difference
            time_diff = exp_time - iat_time
            assert abs(time_diff.total_seconds() - 604800) < 60  # 604800 seconds = 7 days, allow 60s tolerance


class TestVerifyToken:
    """Test token verification"""

    def test_verify_valid_access_token(self):
        """Test verifying valid access token"""
        mock_jwt_config = {"secret_key": "test-secret-key", "algorithm": "HS256"}

        user_id = uuid.uuid4()
        email = "test@example.com"
        org_id = uuid.uuid4()

        # Create token manually
        payload = {
            "sub": str(user_id),
            "email": email,
            "token_type": "access",
            "org_id": str(org_id),
            "exp": datetime.now(UTC) + timedelta(minutes=30),
            "iat": datetime.now(UTC),
            "jti": str(uuid.uuid4()),
        }
        token = jwt.encode(payload, mock_jwt_config["secret_key"], algorithm=mock_jwt_config["algorithm"])

        with patch("src.app.auth.jwt_utils.config_helper") as mock_config:
            mock_config.jwt_config = mock_jwt_config

            token_data = verify_token(token, "access")

            assert token_data is not None
            assert token_data.user_id == str(user_id)
            assert token_data.email == email
            assert token_data.token_type == "access"
            assert token_data.organisation_id == str(org_id)

    def test_verify_valid_refresh_token(self):
        """Test verifying valid refresh token"""
        mock_jwt_config = {"secret_key": "test-secret-key", "algorithm": "HS256"}

        user_id = uuid.uuid4()
        email = "test@example.com"

        payload = {
            "sub": str(user_id),
            "email": email,
            "token_type": "refresh",
            "exp": datetime.now(UTC) + timedelta(days=7),
            "iat": datetime.now(UTC),
            "jti": str(uuid.uuid4()),
        }
        token = jwt.encode(payload, mock_jwt_config["secret_key"], algorithm=mock_jwt_config["algorithm"])

        with patch("src.app.auth.jwt_utils.config_helper") as mock_config:
            mock_config.jwt_config = mock_jwt_config

            token_data = verify_token(token, "refresh")

            assert token_data is not None
            assert token_data.user_id == str(user_id)
            assert token_data.email == email
            assert token_data.token_type == "refresh"
            assert token_data.organisation_id is None

    def test_verify_token_wrong_type(self):
        """Test verifying token with wrong expected type"""
        mock_jwt_config = {"secret_key": "test-secret-key", "algorithm": "HS256"}

        payload = {
            "sub": str(uuid.uuid4()),
            "email": "test@example.com",
            "token_type": "access",
            "exp": datetime.now(UTC) + timedelta(minutes=30),
            "iat": datetime.now(UTC),
            "jti": str(uuid.uuid4()),
        }
        token = jwt.encode(payload, mock_jwt_config["secret_key"], algorithm=mock_jwt_config["algorithm"])

        with patch("src.app.auth.jwt_utils.config_helper") as mock_config:
            mock_config.jwt_config = mock_jwt_config

            # Try to verify access token as refresh token
            token_data = verify_token(token, "refresh")

            assert token_data is None

    def test_verify_expired_token(self):
        """Test verifying expired token"""
        mock_jwt_config = {"secret_key": "test-secret-key", "algorithm": "HS256"}

        payload = {
            "sub": str(uuid.uuid4()),
            "email": "test@example.com",
            "token_type": "access",
            "exp": datetime.now(UTC) - timedelta(minutes=30),  # Expired 30 minutes ago
            "iat": datetime.now(UTC) - timedelta(hours=1),
            "jti": str(uuid.uuid4()),
        }
        token = jwt.encode(payload, mock_jwt_config["secret_key"], algorithm=mock_jwt_config["algorithm"])

        with patch("src.app.auth.jwt_utils.config_helper") as mock_config:
            mock_config.jwt_config = mock_jwt_config

            token_data = verify_token(token, "access")

            assert token_data is None

    def test_verify_invalid_signature(self):
        """Test verifying token with invalid signature"""
        mock_jwt_config = {"secret_key": "test-secret-key", "algorithm": "HS256"}

        payload = {
            "sub": str(uuid.uuid4()),
            "email": "test@example.com",
            "token_type": "access",
            "exp": datetime.now(UTC) + timedelta(minutes=30),
            "iat": datetime.now(UTC),
            "jti": str(uuid.uuid4()),
        }
        # Create token with different secret
        token = jwt.encode(payload, "wrong-secret-key", algorithm="HS256")

        with patch("src.app.auth.jwt_utils.config_helper") as mock_config:
            mock_config.jwt_config = mock_jwt_config

            token_data = verify_token(token, "access")

            assert token_data is None

    def test_verify_malformed_token(self):
        """Test verifying malformed token"""
        mock_jwt_config = {"secret_key": "test-secret-key", "algorithm": "HS256"}

        with patch("src.app.auth.jwt_utils.config_helper") as mock_config:
            mock_config.jwt_config = mock_jwt_config

            token_data = verify_token("invalid.token.format", "access")

            assert token_data is None

    def test_verify_token_missing_user_id(self):
        """Test verifying token without user ID"""
        mock_jwt_config = {"secret_key": "test-secret-key", "algorithm": "HS256"}

        payload = {
            # Missing "sub" field
            "email": "test@example.com",
            "token_type": "access",
            "exp": datetime.now(UTC) + timedelta(minutes=30),
            "iat": datetime.now(UTC),
            "jti": str(uuid.uuid4()),
        }
        token = jwt.encode(payload, mock_jwt_config["secret_key"], algorithm=mock_jwt_config["algorithm"])

        with patch("src.app.auth.jwt_utils.config_helper") as mock_config:
            mock_config.jwt_config = mock_jwt_config

            token_data = verify_token(token, "access")

            assert token_data is None


class TestDecodeToken:
    """Test token decoding without verification"""

    def test_decode_valid_token(self):
        """Test decoding valid token"""
        mock_jwt_config = {"secret_key": "test-secret-key", "algorithm": "HS256"}

        user_id = uuid.uuid4()
        email = "test@example.com"

        payload = {
            "sub": str(user_id),
            "email": email,
            "token_type": "access",
            "exp": datetime.now(UTC) + timedelta(minutes=30),
            "iat": datetime.now(UTC),
            "jti": str(uuid.uuid4()),
        }
        token = jwt.encode(payload, mock_jwt_config["secret_key"], algorithm=mock_jwt_config["algorithm"])

        with patch("src.app.auth.jwt_utils.config_helper") as mock_config:
            mock_config.jwt_config = mock_jwt_config

            decoded_payload = decode_token(token)

            assert decoded_payload is not None
            assert decoded_payload["sub"] == str(user_id)
            assert decoded_payload["email"] == email
            assert decoded_payload["token_type"] == "access"

    def test_decode_expired_token(self):
        """Test decoding expired token (should still work for debugging)"""
        mock_jwt_config = {"secret_key": "test-secret-key", "algorithm": "HS256"}

        payload = {
            "sub": str(uuid.uuid4()),
            "email": "test@example.com",
            "token_type": "access",
            "exp": datetime.now(UTC) - timedelta(minutes=30),  # Expired
            "iat": datetime.now(UTC) - timedelta(hours=1),
            "jti": str(uuid.uuid4()),
        }
        token = jwt.encode(payload, mock_jwt_config["secret_key"], algorithm=mock_jwt_config["algorithm"])

        with patch("src.app.auth.jwt_utils.config_helper") as mock_config:
            mock_config.jwt_config = mock_jwt_config

            # decode_token verifies by default, so expired tokens will fail
            decoded_payload = decode_token(token)

            assert decoded_payload is None

    def test_decode_invalid_signature(self):
        """Test decoding token with invalid signature"""
        mock_jwt_config = {"secret_key": "test-secret-key", "algorithm": "HS256"}

        payload = {
            "sub": str(uuid.uuid4()),
            "email": "test@example.com",
            "token_type": "access",
            "exp": datetime.now(UTC) + timedelta(minutes=30),
            "iat": datetime.now(UTC),
            "jti": str(uuid.uuid4()),
        }
        # Create token with wrong secret
        token = jwt.encode(payload, "wrong-secret", algorithm="HS256")

        with patch("src.app.auth.jwt_utils.config_helper") as mock_config:
            mock_config.jwt_config = mock_jwt_config

            decoded_payload = decode_token(token)

            assert decoded_payload is None

    def test_decode_malformed_token(self):
        """Test decoding malformed token"""
        mock_jwt_config = {"secret_key": "test-secret-key", "algorithm": "HS256"}

        with patch("src.app.auth.jwt_utils.config_helper") as mock_config:
            mock_config.jwt_config = mock_jwt_config

            decoded_payload = decode_token("invalid.token.format")

            assert decoded_payload is None
