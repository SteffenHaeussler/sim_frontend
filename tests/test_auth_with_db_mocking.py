"""Test authentication endpoints with complete database mocking"""

import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import status

from src.app.models import PasswordReset


class TestAuthEndpointsWithMocking:
    """Test authentication endpoints with full database mocking"""

    @pytest.mark.asyncio
    async def test_register_success(
        self, client_with_mocked_db, mock_db_session, mock_organisation, mock_password_utils
    ):
        """Test successful user registration"""
        # Mock database queries
        # 1. Check existing user - None
        user_check = MagicMock()
        user_check.scalar_one_or_none.return_value = None

        # 2. Get active organisation
        org_check = MagicMock()
        org_check.scalar_one_or_none.return_value = mock_organisation

        # 3. Count users in organisation
        count_check = MagicMock()
        count_check.scalar.return_value = 5  # Less than max_users

        mock_db_session.execute.side_effect = [user_check, org_check, count_check]

        # Registration data
        register_data = {
            "email": "newuser@example.com",
            "password": "SecurePass123!",
            "first_name": "New",
            "last_name": "User",
            "organisation_name": "New Org",
        }

        response = client_with_mocked_db.post("/auth/register", json=register_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access_token" in data
        assert data["user_email"] == register_data["email"]

        # Verify database operations
        assert mock_db_session.add.called
        assert mock_db_session.commit.called
        assert mock_db_session.refresh.called

    @pytest.mark.asyncio
    async def test_register_existing_user(self, client_with_mocked_db, mock_db_session, mock_user):
        """Test registration with existing email"""
        # Mock finding existing user
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user
        mock_db_session.execute.return_value = mock_result

        register_data = {
            "email": mock_user.email,
            "password": "Password123!",
            "first_name": "Test",
            "last_name": "User",
            "organisation_name": "Test Org",
        }

        response = client_with_mocked_db.post("/auth/register", json=register_data)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "already registered" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_login_success(self, client_with_mocked_db, mock_db_session, mock_user, mock_password_utils):
        """Test successful login"""
        # Mock finding user
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user
        mock_db_session.execute.return_value = mock_result

        # Mock JWT token creation and config
        with (
            patch("src.app.auth.router.create_access_token") as mock_access_token,
            patch("src.app.auth.router.create_refresh_token") as mock_refresh_token,
            patch("src.app.auth.router.config_service") as mock_config_service,
            patch("src.app.auth.router.verify_password") as mock_verify_password,
        ):
            mock_access_token.return_value = "test_access_token"
            mock_refresh_token.return_value = "test_refresh_token"
            mock_verify_password.return_value = True  # Password is valid

            # Mock JWT config
            mock_config_service.get_jwt_utils.return_value = {
                "jwt_access_expiration_minutes": 15,
                "JWT_REFRESH_EXPIRATION_DAYS": 7,
            }

            login_data = {"email": mock_user.email, "password": "correct_password"}

            response = client_with_mocked_db.post("/auth/login", json=login_data)

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "access_token" in data
            assert data["user_email"] == mock_user.email

    @pytest.mark.asyncio
    async def test_login_invalid_credentials(
        self, client_with_mocked_db, mock_db_session, mock_user, mock_password_utils
    ):
        """Test login with invalid credentials"""
        # Mock finding user
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user
        mock_db_session.execute.return_value = mock_result

        # Mock password verification failure
        mock_password_utils[1].return_value = False  # verify_password returns False

        login_data = {"email": mock_user.email, "password": "wrong_password"}

        response = client_with_mocked_db.post("/auth/login", json=login_data)

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Incorrect email or password" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_forgot_password_success(self, client_with_mocked_db, mock_db_session, mock_user):
        """Test password reset request"""
        # Mock finding user
        user_result = MagicMock()
        user_result.scalar_one_or_none.return_value = mock_user

        mock_db_session.execute.return_value = user_result

        # Mock the email service
        with patch("src.app.auth.router.EmailService") as mock_email_service_class:
            mock_email_instance = mock_email_service_class.return_value
            mock_email_instance.is_configured = True
            mock_email_instance.send_password_reset_email = AsyncMock(return_value=True)

            forgot_data = {"email": mock_user.email}

            response = client_with_mocked_db.post("/auth/forgot-password", json=forgot_data)

            assert response.status_code == status.HTTP_200_OK
            assert "reset link has been sent" in response.json()["message"]

            # Verify email service was called
            mock_email_instance.send_password_reset_email.assert_called_once()
            assert mock_db_session.commit.called

    @pytest.mark.asyncio
    async def test_forgot_password_nonexistent_user(self, client_with_mocked_db, mock_db_session):
        """Test password reset for non-existent user"""
        # Mock not finding user
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = mock_result

        with patch("src.app.auth.router.EmailService") as mock_email_service_class:
            mock_email_instance = mock_email_service_class.return_value
            mock_email_instance.send_password_reset_email = AsyncMock(return_value=True)

            forgot_data = {"email": "nonexistent@example.com"}

            response = client_with_mocked_db.post("/auth/forgot-password", json=forgot_data)

            # Should still return success for security
            assert response.status_code == status.HTTP_200_OK
            assert "reset link has been sent" in response.json()["message"]

            # Email should not be sent
            mock_email_instance.send_password_reset_email.assert_not_called()

    @pytest.mark.asyncio
    async def test_reset_password_success(self, client_with_mocked_db, mock_db_session, mock_user, mock_password_utils):
        """Test successful password reset"""
        # Create mock password reset token with future expiry
        reset_token = PasswordReset(
            id=uuid.uuid4(),
            user_id=mock_user.id,
            token="valid_reset_token",
            is_used=False,
            expires_at=datetime.now(UTC) + timedelta(hours=24),
        )
        reset_token.user = mock_user

        # Mock finding reset token and user
        reset_result = MagicMock()
        reset_result.scalar_one_or_none.return_value = reset_token

        user_result = MagicMock()
        user_result.scalar_one_or_none.return_value = mock_user

        mock_db_session.execute.side_effect = [reset_result, user_result]

        reset_data = {"token": "valid_reset_token", "new_password": "NewSecurePass123!"}

        response = client_with_mocked_db.post("/auth/reset-password", json=reset_data)

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["message"] == "Password has been reset successfully"
        assert mock_db_session.commit.called

    @pytest.mark.asyncio
    async def test_reset_password_invalid_token(self, client_with_mocked_db, mock_db_session):
        """Test password reset with invalid token"""
        # Mock not finding reset token
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = mock_result

        reset_data = {"token": "invalid_token", "new_password": "NewSecurePass123!"}

        response = client_with_mocked_db.post("/auth/reset-password", json=reset_data)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Invalid or expired" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_logout_success(self, client_with_mocked_db, auth_headers):
        """Test successful user logout"""
        response = client_with_mocked_db.post("/auth/logout", headers=auth_headers)

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["message"] == "Successfully logged out"

    @pytest.mark.asyncio
    async def test_logout_without_auth(self, client_with_mocked_db):
        """Test logout without authentication token"""
        response = client_with_mocked_db.post("/auth/logout")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.asyncio
    async def test_refresh_token_success(self, client_with_mocked_db, mock_db_session):
        """Test successful token refresh"""
        with (
            patch("src.app.auth.jwt_utils.verify_token") as mock_verify_token,
            patch("src.app.auth.router.create_access_token") as mock_create_access,
            patch("src.app.auth.router.config_service") as mock_config_service,
        ):
            # Mock token verification
            import uuid

            from src.app.auth.jwt_utils import TokenData

            test_user_id = str(uuid.uuid4())
            test_org_id = str(uuid.uuid4())
            mock_token_data = TokenData(user_id=test_user_id, email="test@example.com", organisation_id=test_org_id)
            mock_verify_token.return_value = mock_token_data

            # Mock config
            mock_config_service.get_jwt_utils.return_value = {"JWT_ACCESS_EXPIRATION_MINUTES": 15}

            # Mock new access token creation
            mock_create_access.return_value = "new_access_token"

            refresh_data = {"refresh_token": "valid_refresh_token"}

            response = client_with_mocked_db.post("/auth/refresh_token", json=refresh_data)

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert "access_token" in data
            assert data["access_token"] == "new_access_token"
            assert data["user_email"] == "test@example.com"

    @pytest.mark.asyncio
    async def test_refresh_token_invalid(self, client_with_mocked_db, mock_db_session):
        """Test refresh token with invalid token"""
        with patch("src.app.auth.jwt_utils.verify_token") as mock_verify_token:
            mock_verify_token.return_value = None  # Invalid token

            refresh_data = {"refresh_token": "invalid_refresh_token"}

            response = client_with_mocked_db.post("/auth/refresh_token", json=refresh_data)

            assert response.status_code == status.HTTP_401_UNAUTHORIZED

    @pytest.mark.asyncio
    async def test_update_profile_success(self, client_with_mocked_db, mock_db_session, mock_user):
        """Test successful profile update"""
        with (
            patch("src.app.auth.dependencies.verify_token") as mock_verify_token,
            patch("src.app.auth.router._get_user_by_token") as mock_get_user,
        ):
            # Create TokenData with proper UUID
            from src.app.auth.jwt_utils import TokenData

            mock_verify_token.return_value = TokenData(
                user_id=str(mock_user.id), email=mock_user.email, organisation_id=str(mock_user.organisation_id)
            )

            # Mock database user lookup for require_active_user
            user_result = MagicMock()
            user_result.scalar_one_or_none.return_value = mock_user
            mock_db_session.execute.return_value = user_result

            # Mock _get_user_by_token helper
            mock_get_user.return_value = mock_user

            profile_data = {"first_name": "Updated", "last_name": "Name"}

            headers = {"Authorization": "Bearer valid_token"}
            response = client_with_mocked_db.put("/auth/profile", json=profile_data, headers=headers)

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["message"] == "Profile updated successfully"
            assert data["first_name"] == "Updated"
            assert data["last_name"] == "Name"
            assert mock_db_session.commit.called

    @pytest.mark.asyncio
    async def test_update_profile_without_auth(self, client_with_mocked_db):
        """Test profile update without authentication"""
        profile_data = {"first_name": "Updated", "last_name": "Name"}

        response = client_with_mocked_db.put("/auth/profile", json=profile_data)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.asyncio
    async def test_delete_account_success(self, app_with_mocked_db, mock_db_session, mock_user):
        """Test successful account deletion"""
        from src.app.auth.dependencies import require_active_user
        from src.app.auth.jwt_utils import TokenData

        # Create token data
        token_data = TokenData(
            user_id=str(mock_user.id), email=mock_user.email, organisation_id=str(mock_user.organisation_id)
        )

        # Override the authentication dependency
        app_with_mocked_db.dependency_overrides[require_active_user] = lambda: token_data

        with patch("src.app.auth.router.verify_password") as mock_verify_password:
            # Mock database user lookup
            user_result = MagicMock()
            user_result.scalar_one_or_none.return_value = mock_user

            # Mock the ratings query
            ratings_result = MagicMock()
            ratings_result.scalars.return_value.all.return_value = []

            mock_db_session.execute.side_effect = [user_result, ratings_result]
            mock_verify_password.return_value = True

            delete_data = {"password": "correct_password"}

            # Create client after overrides are set
            from fastapi.testclient import TestClient

            client = TestClient(app_with_mocked_db)

            response = client.request("DELETE", "/auth/account", json=delete_data)

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["message"] == "Account deleted successfully"
            assert mock_db_session.commit.called

    @pytest.mark.asyncio
    async def test_delete_account_wrong_password(self, app_with_mocked_db, mock_db_session, mock_user):
        """Test account deletion with wrong password"""
        from src.app.auth.dependencies import require_active_user
        from src.app.auth.jwt_utils import TokenData

        # Create token data
        token_data = TokenData(
            user_id=str(mock_user.id), email=mock_user.email, organisation_id=str(mock_user.organisation_id)
        )

        # Override the authentication dependency
        app_with_mocked_db.dependency_overrides[require_active_user] = lambda: token_data

        with patch("src.app.auth.router.verify_password") as mock_verify_password:
            # Mock database user lookup
            user_result = MagicMock()
            user_result.scalar_one_or_none.return_value = mock_user
            mock_db_session.execute.return_value = user_result

            mock_verify_password.return_value = False  # Wrong password

            delete_data = {"password": "wrong_password"}

            # Create client after overrides are set
            from fastapi.testclient import TestClient

            client = TestClient(app_with_mocked_db)

            response = client.request("DELETE", "/auth/account", json=delete_data)

            assert response.status_code == status.HTTP_401_UNAUTHORIZED
            assert "Invalid password" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_delete_account_without_auth(self, client_with_mocked_db):
        """Test account deletion without authentication"""
        delete_data = {"password": "any_password"}

        response = client_with_mocked_db.request("DELETE", "/auth/account", json=delete_data)

        assert response.status_code == status.HTTP_403_FORBIDDEN
