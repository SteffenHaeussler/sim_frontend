import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .database import Base


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash = Column(String(255), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True))
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    user = relationship("User", back_populates="password_reset_tokens")

    def __repr__(self) -> str:
        return f"<PasswordResetToken(id={self.id}, user_id={self.user_id}, used={self.is_used})>"

    @property
    def is_expired(self) -> bool:
        """Check if reset token is expired"""
        return datetime.now(timezone.utc) > self.expires_at.replace(tzinfo=None)

    @property
    def is_used(self) -> bool:
        """Check if reset token has been used"""
        return self.used_at is not None

    @property
    def is_valid(self) -> bool:
        """Check if reset token is valid (not expired and not used)"""
        return not self.is_expired and not self.is_used

    def mark_as_used(self) -> None:
        """Mark token as used"""
        self.used_at = datetime.utcnow()

    @property
    def time_until_expiry(self) -> Optional[timedelta]:
        """Get time remaining until token expires"""
        if self.is_expired:
            return None
        return self.expires_at.replace(tzinfo=None) - datetime.utcnow()

    @classmethod
    def create_token(
        cls, user_id: uuid.UUID, token_hash: str, expires_hours: int = 1
    ) -> "PasswordResetToken":
        """
        Create a new password reset token

        Args:
            user_id: User ID
            token_hash: Hashed reset token
            expires_hours: Token expiration in hours (default: 1 hour)

        Returns:
            PasswordResetToken: New reset token instance
        """
        now = datetime.now(timezone.utc)

        return cls(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=now + timedelta(hours=expires_hours),
            created_at=now,
        )
