import uuid
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from src.app.models.database import Base


class PasswordReset(Base):
    """
    Password reset request model
    
    Stores temporary tokens for password reset functionality.
    Tokens expire after a configurable time period.
    """
    __tablename__ = "password_resets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    token = Column(String(255), nullable=False, unique=True, index=True)
    is_used = Column(Boolean, nullable=False, default=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    used_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    user = relationship("User")

    def __repr__(self) -> str:
        return f"<PasswordReset(id={self.id}, user={self.user_id}, expires={self.expires_at})>"

    @classmethod
    def create_reset_token(
        cls,
        user_id: uuid.UUID,
        token: str,
        expiration_hours: int = 24
    ) -> "PasswordReset":
        """
        Create a new password reset token
        
        Args:
            user_id: User requesting password reset
            token: Secure random token
            expiration_hours: Hours until token expires (default 24)
            
        Returns:
            PasswordReset: New password reset request
        """
        return cls(
            user_id=user_id,
            token=token,
            expires_at=datetime.utcnow() + timedelta(hours=expiration_hours),
            is_used=False
        )

    @property
    def is_expired(self) -> bool:
        """Check if the reset token has expired"""
        return datetime.utcnow() > self.expires_at

    @property
    def is_valid(self) -> bool:
        """Check if the reset token is valid (not used and not expired)"""
        return not self.is_used and not self.is_expired

    def mark_as_used(self) -> None:
        """Mark the token as used"""
        self.is_used = True
        self.used_at = datetime.utcnow()