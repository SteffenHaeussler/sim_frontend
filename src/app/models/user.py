from sqlalchemy import Column, String, Boolean, DateTime, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from datetime import datetime, timedelta
from typing import Optional

from .database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(100))
    last_name = Column(String(100))
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id"), nullable=True, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True, index=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    is_verified = Column(Boolean, nullable=False, default=False, server_default="false")
    last_login = Column(DateTime(timezone=True))
    failed_login_attempts = Column(Integer, nullable=False, default=0, server_default="0")
    locked_until = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    role = relationship("Role", back_populates="users")
    organization = relationship("Organization", back_populates="users")
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    password_reset_tokens = relationship("PasswordResetToken", back_populates="user", cascade="all, delete-orphan")
    api_keys = relationship("ApiKey", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user")
    
    def __repr__(self) -> str:
        return f"<User(id={self.id}, email='{self.email}')>"
    
    @property
    def full_name(self) -> str:
        """Get user's full name"""
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        elif self.first_name:
            return self.first_name
        elif self.last_name:
            return self.last_name
        else:
            return self.email.split("@")[0]  # Use email prefix as fallback
    
    @property
    def is_locked(self) -> bool:
        """Check if user account is locked"""
        if not self.locked_until:
            return False
        return datetime.utcnow() < self.locked_until.replace(tzinfo=None)
    
    @property
    def can_login(self) -> bool:
        """Check if user can login (active, verified, not locked)"""
        return self.is_active and self.is_verified and not self.is_locked
    
    def lock_account(self, duration_minutes: int = 30) -> None:
        """Lock user account for specified duration"""
        self.locked_until = datetime.utcnow() + timedelta(minutes=duration_minutes)
    
    def unlock_account(self) -> None:
        """Unlock user account"""
        self.locked_until = None
        self.failed_login_attempts = 0
    
    def increment_failed_login(self, max_attempts: int = 5, lockout_duration: int = 30) -> bool:
        """
        Increment failed login attempts and lock account if needed
        
        Args:
            max_attempts: Maximum failed attempts before lockout
            lockout_duration: Lockout duration in minutes
        
        Returns:
            bool: True if account was locked
        """
        self.failed_login_attempts += 1
        
        if self.failed_login_attempts >= max_attempts:
            self.lock_account(lockout_duration)
            return True
        
        return False
    
    def reset_failed_login(self) -> None:
        """Reset failed login attempts (on successful login)"""
        self.failed_login_attempts = 0
        self.locked_until = None
        self.last_login = datetime.utcnow()
    
    def has_permission(self, resource: str, action: str) -> bool:
        """Check if user has specific permission through their role"""
        if not self.role:
            return False
        return self.role.has_permission(resource, action)
    
    @property
    def is_admin(self) -> bool:
        """Check if user has admin role"""
        return self.role and self.role.is_admin
    
    @property
    def is_manager(self) -> bool:
        """Check if user has manager role or higher"""
        return self.role and self.role.is_manager
    
    def can_access_organization_data(self, target_org_id: uuid.UUID) -> bool:
        """Check if user can access data from a specific organization"""
        # Users can only access their own organization's data
        # Admins might have cross-org access in the future
        return self.organization_id == target_org_id