"""Test email service functionality"""

import smtplib
from unittest.mock import MagicMock, patch

import pytest

from src.app.services.email_service import EmailService


class TestEmailService:
    """Test EmailService class functionality"""

    def test_init_with_configured_smtp(self):
        """Test EmailService initialization with SMTP configured"""
        mock_smtp_config = {
            "host": "smtp.example.com",
            "port": 587,
            "username": "test@example.com",
            "password": "password123",
            "from_email": "noreply@example.com",
            "is_configured": True,
        }

        with patch("src.app.services.email_service.config_helper") as mock_config:
            mock_config.smtp_config = mock_smtp_config

            service = EmailService()

            assert service.smtp_server == "smtp.example.com"
            assert service.smtp_port == 587
            assert service.smtp_username == "test@example.com"
            assert service.smtp_password == "password123"
            assert service.from_email == "noreply@example.com"
            assert service.from_name == "Password Reset Service"
            assert service.is_configured is True

    def test_init_with_unconfigured_smtp(self):
        """Test EmailService initialization with SMTP not configured"""
        mock_smtp_config = {
            "host": None,
            "port": None,
            "username": None,
            "password": None,
            "from_email": None,
            "is_configured": False,
        }

        with (
            patch("src.app.services.email_service.config_helper") as mock_config,
            patch("src.app.services.email_service.logger") as mock_logger,
        ):
            mock_config.smtp_config = mock_smtp_config

            service = EmailService()

            assert service.is_configured is False
            mock_logger.warning.assert_called_once_with("SMTP not configured. Emails will be logged instead of sent.")

    @pytest.mark.asyncio
    async def test_send_password_reset_email_success(self):
        """Test successful password reset email sending"""
        mock_smtp_config = {
            "host": "smtp.example.com",
            "port": 587,
            "username": "test@example.com",
            "password": "password123",
            "from_email": "noreply@example.com",
            "is_configured": True,
        }

        with patch("src.app.services.email_service.config_helper") as mock_config:
            mock_config.smtp_config = mock_smtp_config

            service = EmailService()

            with patch.object(service, "_send_email", return_value=True) as mock_send:
                result = await service.send_password_reset_email(
                    to_email="user@example.com",
                    reset_token="test-token-123",
                    base_url="https://app.example.com",
                    user_name="John Doe",
                )

                assert result is True
                mock_send.assert_called_once()

                # Verify the call arguments
                call_args = mock_send.call_args
                assert call_args[1]["to_email"] == "user@example.com"
                assert call_args[1]["subject"] == "Password Reset Request"
                assert "https://app.example.com/reset-password?token=test-token-123" in call_args[1]["html_content"]
                assert "John Doe" in call_args[1]["html_content"]

    @pytest.mark.asyncio
    async def test_send_password_reset_email_no_user_name(self):
        """Test password reset email with auto-generated user name from email"""
        mock_smtp_config = {
            "host": "smtp.example.com",
            "port": 587,
            "username": "test@example.com",
            "password": "password123",
            "from_email": "noreply@example.com",
            "is_configured": True,
        }

        with patch("src.app.services.email_service.config_helper") as mock_config:
            mock_config.smtp_config = mock_smtp_config

            service = EmailService()

            with patch.object(service, "_send_email", return_value=True) as mock_send:
                result = await service.send_password_reset_email(
                    to_email="johndoe@example.com", reset_token="test-token-123", base_url="https://app.example.com"
                )

                assert result is True

                # Should use email username part as name
                call_args = mock_send.call_args
                assert "johndoe" in call_args[1]["html_content"]
                assert "johndoe" in call_args[1]["text_content"]

    def test_create_reset_email_html(self):
        """Test HTML email content generation"""
        mock_smtp_config = {
            "is_configured": True,
            "host": "smtp.test.com",
            "port": 587,
            "username": "test",
            "password": "pass",
            "from_email": "test@test.com",
        }

        with patch("src.app.services.email_service.config_helper") as mock_config:
            mock_config.smtp_config = mock_smtp_config

            service = EmailService()

            html_content = service._create_reset_email_html(
                reset_link="https://app.example.com/reset?token=abc123", user_name="John Doe"
            )

            assert "John Doe" in html_content
            assert "https://app.example.com/reset?token=abc123" in html_content
            assert "Password Reset Request" in html_content
            assert "Reset Your Password" in html_content
            assert "expire in 24 hours" in html_content
            assert "<!DOCTYPE html>" in html_content

    def test_create_reset_email_text(self):
        """Test plain text email content generation"""
        mock_smtp_config = {
            "is_configured": True,
            "host": "smtp.test.com",
            "port": 587,
            "username": "test",
            "password": "pass",
            "from_email": "test@test.com",
        }

        with patch("src.app.services.email_service.config_helper") as mock_config:
            mock_config.smtp_config = mock_smtp_config

            service = EmailService()

            text_content = service._create_reset_email_text(
                reset_link="https://app.example.com/reset?token=abc123", user_name="Jane Smith"
            )

            assert "Jane Smith" in text_content
            assert "https://app.example.com/reset?token=abc123" in text_content
            assert "Password Reset Request" in text_content
            assert "expire in 24 hours" in text_content
            # Should not contain HTML tags
            assert "<" not in text_content

    @pytest.mark.asyncio
    async def test_send_email_not_configured_logs_instead(self):
        """Test email logging when SMTP is not configured"""
        mock_smtp_config = {
            "is_configured": False,
            "host": None,
            "port": None,
            "username": None,
            "password": None,
            "from_email": None,
        }

        with (
            patch("src.app.services.email_service.config_helper") as mock_config,
            patch("src.app.services.email_service.logger") as mock_logger,
        ):
            mock_config.smtp_config = mock_smtp_config

            service = EmailService()

            result = await service._send_email(
                to_email="test@example.com",
                subject="Test Subject",
                html_content="<p>HTML content</p>",
                text_content="Text content",
            )

            assert result is True

            # Verify logging calls
            mock_logger.info.assert_any_call("EMAIL TO: test@example.com")
            mock_logger.info.assert_any_call("EMAIL SUBJECT: Test Subject")
            mock_logger.info.assert_any_call("EMAIL CONTENT:\nText content")

    @pytest.mark.asyncio
    async def test_send_email_smtp_success(self):
        """Test successful SMTP email sending"""
        mock_smtp_config = {
            "is_configured": True,
            "host": "smtp.example.com",
            "port": 587,
            "username": "test@example.com",
            "password": "password123",
            "from_email": "noreply@example.com",
        }

        with (
            patch("src.app.services.email_service.config_helper") as mock_config,
            patch("src.app.services.email_service.smtplib.SMTP") as mock_smtp,
            patch("src.app.services.email_service.logger") as mock_logger,
        ):
            mock_config.smtp_config = mock_smtp_config

            # Mock SMTP server
            mock_server = MagicMock()
            mock_smtp.return_value.__enter__.return_value = mock_server

            service = EmailService()

            result = await service._send_email(
                to_email="user@example.com",
                subject="Test Subject",
                html_content="<p>HTML content</p>",
                text_content="Text content",
            )

            assert result is True

            # Verify SMTP calls
            mock_smtp.assert_called_once_with("smtp.example.com", 587)
            mock_server.starttls.assert_called_once()
            mock_server.login.assert_called_once_with("test@example.com", "password123")
            mock_server.send_message.assert_called_once()

            # Verify success logging
            mock_logger.info.assert_called_with("Password reset email sent to user@example.com")

    @pytest.mark.asyncio
    async def test_send_email_smtp_failure(self):
        """Test SMTP email sending failure"""
        mock_smtp_config = {
            "is_configured": True,
            "host": "smtp.example.com",
            "port": 587,
            "username": "test@example.com",
            "password": "password123",
            "from_email": "noreply@example.com",
        }

        with (
            patch("src.app.services.email_service.config_helper") as mock_config,
            patch("src.app.services.email_service.smtplib.SMTP") as mock_smtp,
            patch("src.app.services.email_service.logger") as mock_logger,
        ):
            mock_config.smtp_config = mock_smtp_config

            # Mock SMTP server to raise exception
            mock_smtp.side_effect = smtplib.SMTPException("Connection failed")

            service = EmailService()

            result = await service._send_email(
                to_email="user@example.com",
                subject="Test Subject",
                html_content="<p>HTML content</p>",
                text_content="Text content",
            )

            assert result is False

            # Verify error logging
            mock_logger.error.assert_called_with("Failed to send email to user@example.com: Connection failed")

    @pytest.mark.asyncio
    async def test_send_email_smtp_authentication_failure(self):
        """Test SMTP authentication failure"""
        mock_smtp_config = {
            "is_configured": True,
            "host": "smtp.example.com",
            "port": 587,
            "username": "test@example.com",
            "password": "wrong_password",
            "from_email": "noreply@example.com",
        }

        with (
            patch("src.app.services.email_service.config_helper") as mock_config,
            patch("src.app.services.email_service.smtplib.SMTP") as mock_smtp,
            patch("src.app.services.email_service.logger") as mock_logger,
        ):
            mock_config.smtp_config = mock_smtp_config

            # Mock SMTP server
            mock_server = MagicMock()
            mock_server.login.side_effect = smtplib.SMTPAuthenticationError(535, "Authentication failed")
            mock_smtp.return_value.__enter__.return_value = mock_server

            service = EmailService()

            result = await service._send_email(
                to_email="user@example.com",
                subject="Test Subject",
                html_content="<p>HTML content</p>",
                text_content="Text content",
            )

            assert result is False

            # Verify error logging
            mock_logger.error.assert_called()
            error_message = mock_logger.error.call_args[0][0]
            assert "Failed to send email to user@example.com" in error_message
