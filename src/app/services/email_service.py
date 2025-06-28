import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from loguru import logger

from src.app.services.config_service import config_service


class EmailService:
    """
    Simple email service for password reset notifications

    Uses SMTP configuration from environment variables.
    Falls back to logging emails if SMTP is not configured.
    """

    def __init__(self):
        self.config = config_service
        self.smtp_server = self.config.smtp_host
        self.smtp_port = self.config.smtp_port
        self.smtp_username = self.config.sender_email
        self.smtp_password = self.config.app_password
        self.from_email = self.config.sender_email
        self.from_name = "Password Reset Service"

        # Check if SMTP is properly configured
        self.is_configured = self.config.is_smtp_configured()

        if not self.is_configured:
            logger.warning(
                "SMTP not configured. Emails will be logged instead of sent."
            )

    async def send_password_reset_email(
        self,
        to_email: str,
        reset_token: str,
        base_url: str,
        user_name: Optional[str] = None,
    ) -> bool:
        """
        Send password reset email to user

        Args:
            to_email: Recipient email address
            reset_token: Password reset token
            base_url: Base URL for the frontend application
            user_name: Optional user name for personalization

        Returns:
            bool: True if email was sent successfully, False otherwise
        """
        reset_link = f"{base_url}/reset-password?token={reset_token}"

        subject = "Password Reset Request"

        # Create HTML email content
        html_content = self._create_reset_email_html(
            reset_link=reset_link, user_name=user_name or to_email.split("@")[0]
        )

        # Create plain text version
        text_content = self._create_reset_email_text(
            reset_link=reset_link, user_name=user_name or to_email.split("@")[0]
        )

        return await self._send_email(
            to_email=to_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
        )

    def _create_reset_email_html(self, reset_link: str, user_name: str) -> str:
        """Create HTML content for password reset email"""
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Password Reset</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2c3e50;">Password Reset Request</h2>

                <p>Hi {user_name},</p>

                <p>We received a request to reset your password. If you didn't make this request, you can safely ignore this email.</p>

                <p>To reset your password, click the button below:</p>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="{reset_link}"
                       style="background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
                        Reset Your Password
                    </a>
                </div>

                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; background-color: #f8f9fa; padding: 10px; border-radius: 4px;">
                    {reset_link}
                </p>

                <p style="color: #7f8c8d; font-size: 14px; margin-top: 30px;">
                    This link will expire in 24 hours for security reasons.
                </p>

                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

                <p style="color: #7f8c8d; font-size: 12px;">
                    This is an automated message. Please do not reply to this email.
                </p>
            </div>
        </body>
        </html>
        """

    def _create_reset_email_text(self, reset_link: str, user_name: str) -> str:
        """Create plain text content for password reset email"""
        return f"""
Password Reset Request

Hi {user_name},

We received a request to reset your password. If you didn't make this request, you can safely ignore this email.

To reset your password, visit this link:
{reset_link}

This link will expire in 24 hours for security reasons.

This is an automated message. Please do not reply to this email.
        """.strip()

    async def _send_email(
        self, to_email: str, subject: str, html_content: str, text_content: str
    ) -> bool:
        """
        Send email using SMTP or log it if SMTP is not configured

        Args:
            to_email: Recipient email
            subject: Email subject
            html_content: HTML version of email
            text_content: Plain text version of email

        Returns:
            bool: True if successful, False otherwise
        """
        if not self.is_configured:
            # Log the email instead of sending it
            logger.info(f"EMAIL TO: {to_email}")
            logger.info(f"EMAIL SUBJECT: {subject}")
            logger.info(f"EMAIL CONTENT:\n{text_content}")
            logger.info("=" * 50)
            return True

        try:
            # Create message
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{self.from_name} <{self.from_email}>"
            msg["To"] = to_email

            # Attach both plain text and HTML versions
            part1 = MIMEText(text_content, "plain")
            part2 = MIMEText(html_content, "html")

            msg.attach(part1)
            msg.attach(part2)

            # Send email
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_username, self.smtp_password)
                server.send_message(msg)

            logger.info(f"Password reset email sent to {to_email}")
            return True

        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {e}")
            return False


# Global email service instance
email_service = EmailService()