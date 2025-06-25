from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from .database import Base

class ApiKey(Base):
    __tablename__ = "api_keys"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    name = Column(String(255), nullable=False)
    key_hash = Column(String(255), nullable=False, unique=True, index=True)
    permissions = Column(JSONB, nullable=False, default={})
    last_used_at = Column(DateTime(timezone=True))
    expires_at = Column(DateTime(timezone=True))
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="api_keys")
    organization = relationship("Organization", back_populates="api_keys")
    
    def __repr__(self) -> str:
        return f"<ApiKey(id={self.id}, name='{self.name}', active={self.is_active})>"
    
    @property
    def is_expired(self) -> bool:
        """Check if API key is expired"""
        if not self.expires_at:
            return False
        return datetime.utcnow() > self.expires_at.replace(tzinfo=None)
    
    @property
    def is_valid(self) -> bool:
        """Check if API key is valid (active and not expired)"""
        return self.is_active and not self.is_expired
    
    def has_permission(self, resource: str, action: str) -> bool:
        """
        Check if API key has specific permission
        
        Args:
            resource: Resource name (e.g., 'monitoring', 'assets', 'api')
            action: Action name (e.g., 'read', 'write', 'delete')
        
        Returns:
            bool: True if permission exists
        """
        if not isinstance(self.permissions, dict):
            return False
            
        resource_permissions = self.permissions.get(resource, [])
        if not isinstance(resource_permissions, list):
            return False
            
        return action in resource_permissions or "full_access" in resource_permissions
    
    def get_permissions(self, resource: str = None) -> Dict[str, List[str]]:
        """
        Get permissions for a specific resource or all permissions
        
        Args:
            resource: Optional resource name to filter by
        
        Returns:
            Dict of permissions
        """
        if not isinstance(self.permissions, dict):
            return {}
            
        if resource:
            return {resource: self.permissions.get(resource, [])}
        
        return self.permissions.copy()
    
    def update_last_used(self) -> None:
        """Update last used timestamp"""
        self.last_used_at = datetime.utcnow()
    
    def deactivate(self) -> None:
        """Deactivate API key"""
        self.is_active = False
    
    def extend_expiration(self, days: int) -> None:
        """Extend API key expiration"""
        if self.expires_at:
            self.expires_at = max(
                self.expires_at.replace(tzinfo=None),
                datetime.utcnow()
            ) + timedelta(days=days)
        else:
            self.expires_at = datetime.utcnow() + timedelta(days=days)
    
    @property
    def days_until_expiry(self) -> Optional[int]:
        """Get days remaining until API key expires"""
        if not self.expires_at:
            return None
        if self.is_expired:
            return 0
        
        time_diff = self.expires_at.replace(tzinfo=None) - datetime.utcnow()
        return time_diff.days
    
    @property
    def is_read_only(self) -> bool:
        """Check if API key only has read permissions"""
        if not isinstance(self.permissions, dict):
            return True
            
        for resource, actions in self.permissions.items():
            if not isinstance(actions, list):
                continue
            for action in actions:
                if action in ["write", "delete", "create", "update", "full_access"]:
                    return False
        return True
    
    @classmethod
    def create_api_key(
        cls,
        user_id: uuid.UUID,
        organization_id: uuid.UUID,
        name: str,
        key_hash: str,
        permissions: Dict[str, List[str]] = None,
        expires_days: Optional[int] = None
    ) -> "ApiKey":
        """
        Create a new API key
        
        Args:
            user_id: User ID who owns the key
            organization_id: Organization ID
            name: Human-readable name for the key
            key_hash: Hashed API key
            permissions: Permissions dict
            expires_days: Days until expiration (None for no expiration)
        
        Returns:
            ApiKey: New API key instance
        """
        now = datetime.utcnow()
        expires_at = None
        
        if expires_days:
            expires_at = now + timedelta(days=expires_days)
        
        return cls(
            user_id=user_id,
            organization_id=organization_id,
            name=name,
            key_hash=key_hash,
            permissions=permissions or {},
            expires_at=expires_at,
            is_active=True,
            created_at=now
        )
    
    @classmethod
    def get_default_permissions(cls, role_name: str) -> Dict[str, List[str]]:
        """
        Get default API permissions based on user role
        
        Args:
            role_name: User role name
        
        Returns:
            Dict of default permissions
        """
        if role_name == "admin":
            return {
                "monitoring": ["read", "write"],
                "assets": ["read", "write"],
                "users": ["read", "write"],
                "api": ["read", "write"]
            }
        elif role_name == "manager":
            return {
                "monitoring": ["read", "write"],
                "assets": ["read", "write"],
                "api": ["read", "write"]
            }
        elif role_name == "engineer":
            return {
                "monitoring": ["read", "write"],
                "assets": ["read"],
                "api": ["read", "write"]
            }
        elif role_name == "operator":
            return {
                "monitoring": ["read"],
                "assets": ["read"],
                "api": ["read"]
            }
        else:  # viewer or unknown
            return {
                "monitoring": ["read"],
                "api": ["read"]
            }