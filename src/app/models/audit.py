from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from datetime import datetime
from typing import Dict, Any, Optional

from .database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), index=True)
    action = Column(String(100), nullable=False, index=True)
    resource = Column(String(100), index=True)
    resource_id = Column(String(255))
    details = Column(JSONB, nullable=False, default={})
    ip_address = Column(INET)
    user_agent = Column(Text)
    success = Column(Boolean, nullable=False, default=True, server_default="true")
    error_message = Column(Text)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    
    # Relationships
    user = relationship("User", back_populates="audit_logs")
    organization = relationship("Organization", back_populates="audit_logs")
    
    def __repr__(self) -> str:
        return f"<AuditLog(id={self.id}, action='{self.action}', resource='{self.resource}')>"
    
    @classmethod
    def log_action(
        cls,
        action: str,
        user_id: Optional[uuid.UUID] = None,
        organization_id: Optional[uuid.UUID] = None,
        resource: Optional[str] = None,
        resource_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        success: bool = True,
        error_message: Optional[str] = None
    ) -> "AuditLog":
        """
        Create an audit log entry
        
        Args:
            action: Action performed (e.g., 'login', 'logout', 'create_user')
            user_id: User who performed the action
            organization_id: Organization context
            resource: Resource affected (e.g., 'user', 'session', 'monitoring')
            resource_id: ID of the affected resource
            details: Additional context data
            ip_address: Client IP address
            user_agent: Client user agent
            success: Whether the action succeeded
            error_message: Error message if action failed
        
        Returns:
            AuditLog: New audit log entry
        """
        return cls(
            user_id=user_id,
            organization_id=organization_id,
            action=action,
            resource=resource,
            resource_id=resource_id,
            details=details or {},
            ip_address=ip_address,
            user_agent=user_agent,
            success=success,
            error_message=error_message,
            created_at=datetime.utcnow()
        )
    
    @classmethod
    def log_login_success(
        cls,
        user_id: uuid.UUID,
        organization_id: uuid.UUID,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        session_id: Optional[uuid.UUID] = None
    ) -> "AuditLog":
        """Log successful login"""
        details = {}
        if session_id:
            details["session_id"] = str(session_id)
            
        return cls.log_action(
            action="login_success",
            user_id=user_id,
            organization_id=organization_id,
            resource="authentication",
            details=details,
            ip_address=ip_address,
            user_agent=user_agent,
            success=True
        )
    
    @classmethod
    def log_login_failure(
        cls,
        email: str,
        reason: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        organization_id: Optional[uuid.UUID] = None
    ) -> "AuditLog":
        """Log failed login attempt"""
        return cls.log_action(
            action="login_failure",
            organization_id=organization_id,
            resource="authentication",
            details={"email": email, "reason": reason},
            ip_address=ip_address,
            user_agent=user_agent,
            success=False,
            error_message=reason
        )
    
    @classmethod
    def log_logout(
        cls,
        user_id: uuid.UUID,
        organization_id: uuid.UUID,
        session_id: Optional[uuid.UUID] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> "AuditLog":
        """Log user logout"""
        details = {}
        if session_id:
            details["session_id"] = str(session_id)
            
        return cls.log_action(
            action="logout",
            user_id=user_id,
            organization_id=organization_id,
            resource="authentication",
            details=details,
            ip_address=ip_address,
            user_agent=user_agent,
            success=True
        )
    
    @classmethod
    def log_monitoring_access(
        cls,
        user_id: uuid.UUID,
        organization_id: uuid.UUID,
        endpoint: str,
        query_details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> "AuditLog":
        """Log monitoring system access"""
        details = {"endpoint": endpoint}
        if query_details:
            details.update(query_details)
            
        return cls.log_action(
            action="monitoring_access",
            user_id=user_id,
            organization_id=organization_id,
            resource="monitoring",
            details=details,
            ip_address=ip_address,
            user_agent=user_agent,
            success=True
        )
    
    @classmethod
    def log_user_management(
        cls,
        action: str,  # 'create_user', 'update_user', 'delete_user'
        admin_user_id: uuid.UUID,
        target_user_id: uuid.UUID,
        organization_id: uuid.UUID,
        changes: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> "AuditLog":
        """Log user management actions"""
        details = {"target_user_id": str(target_user_id)}
        if changes:
            details["changes"] = changes
            
        return cls.log_action(
            action=action,
            user_id=admin_user_id,
            organization_id=organization_id,
            resource="user",
            resource_id=str(target_user_id),
            details=details,
            ip_address=ip_address,
            user_agent=user_agent,
            success=True
        )
    
    @classmethod
    def log_api_access(
        cls,
        user_id: uuid.UUID,
        organization_id: uuid.UUID,
        api_endpoint: str,
        method: str,
        api_key_id: Optional[uuid.UUID] = None,
        response_status: int = 200,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> "AuditLog":
        """Log API access"""
        details = {
            "endpoint": api_endpoint,
            "method": method,
            "response_status": response_status
        }
        if api_key_id:
            details["api_key_id"] = str(api_key_id)
            
        return cls.log_action(
            action="api_access",
            user_id=user_id,
            organization_id=organization_id,
            resource="api",
            details=details,
            ip_address=ip_address,
            user_agent=user_agent,
            success=response_status < 400
        )