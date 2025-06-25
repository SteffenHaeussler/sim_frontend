import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from src.app.models.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(100))
    last_name = Column(String(100))
    organisation_id = Column(
        UUID(as_uuid=True), ForeignKey("organisations.id"), nullable=False, index=True
    )
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    organisation = relationship("Organisation", back_populates="users")
    api_usage_logs = relationship("ApiUsageLog", back_populates="user")

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
            return self.email.split("@")[0]


class Organisation(Base):
    __tablename__ = "organisations"

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


class ApiUsageLog(Base):
    __tablename__ = "api_usage_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    organisation_id = Column(
        UUID(as_uuid=True), ForeignKey("organisations.id"), nullable=False, index=True
    )

    # API call details for billing
    endpoint = Column(String(255), nullable=False, index=True)  # /agent, /lookup, etc.
    method = Column(String(10), nullable=False)  # GET, POST
    status_code = Column(String(10))  # 200, 404, etc.

    # Billing details
    timestamp = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    duration_ms = Column(String(50))  # How long the call took

    # Optional: detailed request info for debugging
    query_params = Column(String(1000))  # Store query parameters if needed

    # Relationships
    user = relationship("User", back_populates="api_usage_logs")
    organisation = relationship("Organisation", back_populates="api_usage_logs")

    def __repr__(self) -> str:
        return f"<ApiUsageLog(id={self.id}, user={self.user_id}, endpoint='{self.endpoint}')>"

    @classmethod
    def log_api_call(
        cls,
        user_id: uuid.UUID,
        organisation_id: uuid.UUID,
        endpoint: str,
        method: str = "GET",
        status_code: int = 200,
        duration_ms: float = None,
        query_params: str = None,
    ) -> "ApiUsageLog":
        """
        Log an API call for billing purposes

        Args:
            user_id: User who made the call
            organisation_id: Organisation to bill
            endpoint: API endpoint called
            method: HTTP method
            status_code: Response status
            duration_ms: Call duration for performance tracking
            query_params: Query parameters for debugging

        Returns:
            ApiUsageLog: New usage log entry
        """
        return cls(
            user_id=user_id,
            organisation_id=organisation_id,
            endpoint=endpoint,
            method=method,
            status_code=str(status_code),
            duration_ms=str(round(duration_ms, 2)) if duration_ms else None,
            query_params=query_params,
            timestamp=datetime.utcnow(),
        )
