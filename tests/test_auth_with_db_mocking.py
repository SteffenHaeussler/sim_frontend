"""Test authentication endpoints with complete database mocking"""

import uuid
from datetime import datetime, timedelta, UTC
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import status

from src.app.models import PasswordReset, User


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
    async def test_login_success(
        self, client_with_mocked_db, mock_db_session, mock_user, mock_password_utils
    ):
        """Test successful login"""
        # Mock finding user
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user
        mock_db_session.execute.return_value = mock_result

        # Mock JWT token creation and config
        with patch("src.app.auth.router.create_access_token") as mock_access_token, \
             patch("src.app.auth.router.create_refresh_token") as mock_refresh_token, \
             patch("src.app.auth.router.config_service") as mock_config_service, \
             patch("src.app.auth.router.verify_password") as mock_verify_password:
            mock_access_token.return_value = "test_access_token"
            mock_refresh_token.return_value = "test_refresh_token"
            mock_verify_password.return_value = True  # Password is valid
            
            # Mock JWT config
            mock_config_service.get_jwt_utils.return_value = {
                "jwt_access_expiration_minutes": 15,
                "JWT_REFRESH_EXPIRATION_DAYS": 7
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
    async def test_forgot_password_success(
        self, client_with_mocked_db, mock_db_session, mock_user
    ):
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
    async def test_forgot_password_nonexistent_user(
        self, client_with_mocked_db, mock_db_session
    ):
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
    async def test_reset_password_success(
        self, client_with_mocked_db, mock_db_session, mock_user, mock_password_utils
    ):
        """Test successful password reset"""
        # Create mock password reset token with future expiry
        reset_token = PasswordReset(
            id=uuid.uuid4(),
            user_id=mock_user.id,
            token="valid_reset_token",
            is_used=False,
            expires_at=datetime.now(UTC) + timedelta(hours=24)
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