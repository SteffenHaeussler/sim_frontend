from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from .database import Base

class Organization(Base):
    __tablename__ = "organizations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, unique=True, index=True)
    display_name = Column(String(255), nullable=False)
    subscription_tier = Column(
        String(50), 
        nullable=False, 
        default="basic",
        server_default="basic"
    )
    max_users = Column(Integer, nullable=False, default=10, server_default="10")
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    users = relationship("User", back_populates="organization")
    api_keys = relationship("ApiKey", back_populates="organization")
    audit_logs = relationship("AuditLog", back_populates="organization")
    
    def __repr__(self) -> str:
        return f"<Organization(id={self.id}, name='{self.name}', tier='{self.subscription_tier}')>"
    
    @property
    def is_enterprise(self) -> bool:
        """Check if organization has enterprise subscription"""
        return self.subscription_tier == "enterprise"
    
    @property
    def is_professional(self) -> bool:
        """Check if organization has professional subscription"""
        return self.subscription_tier in ["professional", "enterprise"]
    
    def can_add_users(self, current_user_count: int) -> bool:
        """Check if organization can add more users"""
        return current_user_count < self.max_users