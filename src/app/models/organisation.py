import uuid

from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from src.app.models.database import Base


class Organisation(Base):
    __tablename__ = "organisation"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, unique=True, index=True)
    display_name = Column(String(255), nullable=False)
    max_users = Column(
        Integer, nullable=False, default=50
    )  # User limit for registration
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Billing/invoicing info
    billing_email = Column(String(255))  # Where to send invoices
    billing_company = Column(String(255))

    # Relationships
    users = relationship("User", back_populates="organisation")
    api_usage_logs = relationship("ApiUsageLog", back_populates="organisation")

    def __repr__(self) -> str:
        return f"<Organisation(id={self.id}, name='{self.name}')>"
