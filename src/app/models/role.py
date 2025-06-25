from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from typing import Dict, List, Any

from .database import Base

class Role(Base):
    __tablename__ = "roles"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(50), nullable=False, unique=True, index=True)
    display_name = Column(String(100), nullable=False)
    description = Column(Text)
    permissions = Column(JSONB, nullable=False, default={})
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    # Relationships
    users = relationship("User", back_populates="role")
    
    def __repr__(self) -> str:
        return f"<Role(id={self.id}, name='{self.name}')>"
    
    def has_permission(self, resource: str, action: str) -> bool:
        """
        Check if role has specific permission
        
        Args:
            resource: Resource name (e.g., 'monitoring', 'users', 'api')
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
    
    @property
    def is_admin(self) -> bool:
        """Check if this is an admin role"""
        return self.name == "admin"
    
    @property
    def is_manager(self) -> bool:
        """Check if this is a manager role"""
        return self.name in ["admin", "manager"]
    
    @property
    def can_manage_users(self) -> bool:
        """Check if role can manage users"""
        return self.has_permission("users", "write") or self.has_permission("users", "manage")
    
    @property
    def can_access_monitoring(self) -> bool:
        """Check if role can access monitoring features"""
        return self.has_permission("monitoring", "read")
    
    @property
    def can_configure_system(self) -> bool:
        """Check if role can configure system settings"""
        return self.has_permission("system", "configure")
    
    @classmethod
    def get_role_hierarchy(cls) -> List[str]:
        """Get role hierarchy from lowest to highest access"""
        return ["viewer", "operator", "engineer", "manager", "admin"]