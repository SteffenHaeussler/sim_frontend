from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, INET
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from datetime import datetime, timedelta
from typing import Optional

from .database import Base

class UserSession(Base):
    __tablename__ = "user_sessions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(255), nullable=False, unique=True, index=True)
    refresh_token_hash = Column(String(255), index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    refresh_expires_at = Column(DateTime(timezone=True))
    ip_address = Column(INET)
    user_agent = Column(Text)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_used_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="sessions")
    
    def __repr__(self) -> str:
        return f"<UserSession(id={self.id}, user_id={self.user_id}, active={self.is_active})>"
    
    @property
    def is_expired(self) -> bool:
        """Check if session is expired"""
        return datetime.utcnow() > self.expires_at.replace(tzinfo=None)
    
    @property
    def is_refresh_expired(self) -> bool:
        """Check if refresh token is expired"""
        if not self.refresh_expires_at:
            return True
        return datetime.utcnow() > self.refresh_expires_at.replace(tzinfo=None)
    
    @property
    def is_valid(self) -> bool:
        """Check if session is valid (active and not expired)"""
        return self.is_active and not self.is_expired
    
    @property
    def can_refresh(self) -> bool:
        """Check if session can be refreshed"""
        return (
            self.is_active and 
            self.refresh_token_hash and 
            not self.is_refresh_expired
        )
    
    def extend_session(self, duration_hours: int = 8) -> None:
        """Extend session expiration time"""
        self.expires_at = datetime.utcnow() + timedelta(hours=duration_hours)
        self.last_used_at = datetime.utcnow()
    
    def extend_refresh_token(self, duration_days: int = 30) -> None:
        """Extend refresh token expiration time"""
        self.refresh_expires_at = datetime.utcnow() + timedelta(days=duration_days)
    
    def deactivate(self) -> None:
        """Deactivate session (logout)"""
        self.is_active = False
    
    def update_last_used(self) -> None:
        """Update last used timestamp"""
        self.last_used_at = datetime.utcnow()
    
    @property
    def time_until_expiry(self) -> Optional[timedelta]:
        """Get time remaining until session expires"""
        if self.is_expired:
            return None
        return self.expires_at.replace(tzinfo=None) - datetime.utcnow()
    
    @property
    def browser_info(self) -> dict:
        """Extract browser information from user agent"""
        if not self.user_agent:
            return {"browser": "Unknown", "os": "Unknown"}
        
        # Simple user agent parsing (you might want to use a proper library)
        ua = self.user_agent.lower()
        
        browser = "Unknown"
        if "chrome" in ua:
            browser = "Chrome"
        elif "firefox" in ua:
            browser = "Firefox"
        elif "safari" in ua and "chrome" not in ua:
            browser = "Safari"
        elif "edge" in ua:
            browser = "Edge"
        
        os = "Unknown"
        if "windows" in ua:
            os = "Windows"
        elif "mac" in ua:
            os = "macOS"
        elif "linux" in ua:
            os = "Linux"
        elif "android" in ua:
            os = "Android"
        elif "ios" in ua or "iphone" in ua or "ipad" in ua:
            os = "iOS"
        
        return {"browser": browser, "os": os}
    
    @classmethod
    def create_session(
        cls,
        user_id: uuid.UUID,
        token_hash: str,
        refresh_token_hash: str = None,
        expires_hours: int = 8,
        refresh_expires_days: int = 30,
        ip_address: str = None,
        user_agent: str = None
    ) -> "UserSession":
        """
        Create a new user session
        
        Args:
            user_id: User ID
            token_hash: Hashed access token
            refresh_token_hash: Hashed refresh token
            expires_hours: Access token expiration in hours
            refresh_expires_days: Refresh token expiration in days
            ip_address: Client IP address
            user_agent: Client user agent
        
        Returns:
            UserSession: New session instance
        """
        now = datetime.utcnow()
        
        return cls(
            user_id=user_id,
            token_hash=token_hash,
            refresh_token_hash=refresh_token_hash,
            expires_at=now + timedelta(hours=expires_hours),
            refresh_expires_at=now + timedelta(days=refresh_expires_days) if refresh_token_hash else None,
            ip_address=ip_address,
            user_agent=user_agent,
            is_active=True,
            created_at=now,
            last_used_at=now
        )