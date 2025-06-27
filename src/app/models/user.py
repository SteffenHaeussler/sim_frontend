import uuid
from datetime import datetime, timezone

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
        UUID(as_uuid=True), ForeignKey("organisation.id"), nullable=False, index=True
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


class ApiUsageLog(Base):
    __tablename__ = "api_usage_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True
    )  # Nullable for unauthenticated requests
    organisation_id = Column(
        UUID(as_uuid=True), ForeignKey("organisation.id"), nullable=True, index=True
    )  # Nullable for unauthenticated requests

    # API call details for billing
    endpoint = Column(String(255), nullable=False, index=True)  # /agent, /lookup, etc.
    method = Column(String(10), nullable=False)  # GET, POST
    status_code = Column(String(10))  # 200, 404, etc.

    # Enhanced tracking details
    timestamp = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
    duration_ms = Column(String(50))  # How long the call took
    
    # Session and user context
    session_id = Column(String(255), index=True)  # Track user sessions
    request_id = Column(String(255), index=True)  # Track individual requests
    user_agent = Column(String(500))  # Browser/client information
    ip_address = Column(String(45))  # IPv4/IPv6 address
    
    # Request details
    query_params = Column(String(1000))  # Store query parameters if needed
    request_size = Column(String(20))  # Request body size in bytes
    response_size = Column(String(20))  # Response body size in bytes
    
    # Service usage tracking
    service_type = Column(String(50), index=True)  # ask-agent, lookup-service, auth, etc.
    template_used = Column(String(100))  # Which template was clicked (if any)
    
    # Error tracking
    error_message = Column(String(1000))  # Store error details if request failed

    # Relationships
    user = relationship("User", back_populates="api_usage_logs")
    organisation = relationship("Organisation", back_populates="api_usage_logs")

    def __repr__(self) -> str:
        return f"<ApiUsageLog(id={self.id}, user={self.user_id}, endpoint='{self.endpoint}')>"

    @classmethod
    def log_api_call(
        cls,
        endpoint: str,
        method: str = "GET",
        status_code: int = 200,
        duration_ms: float = None,
        user_id: uuid.UUID = None,
        organisation_id: uuid.UUID = None,
        session_id: str = None,
        request_id: str = None,
        user_agent: str = None,
        ip_address: str = None,
        query_params: str = None,
        request_size: int = None,
        response_size: int = None,
        service_type: str = None,
        template_used: str = None,
        error_message: str = None,
    ) -> "ApiUsageLog":
        """
        Log an API call with enhanced tracking

        Args:
            endpoint: API endpoint called
            method: HTTP method
            status_code: Response status
            duration_ms: Call duration for performance tracking
            user_id: User who made the call (optional for unauthenticated)
            organisation_id: Organisation to bill (optional for unauthenticated)
            session_id: User session identifier
            request_id: Individual request identifier
            user_agent: Browser/client information
            ip_address: Client IP address
            query_params: Query parameters for debugging
            request_size: Request body size in bytes
            response_size: Response body size in bytes
            service_type: Type of service used (ask-agent, lookup-service, auth)
            template_used: Which template was clicked (if any)
            error_message: Error details if request failed

        Returns:
            ApiUsageLog: New usage log entry
        """
        return cls(
            endpoint=endpoint,
            method=method,
            status_code=str(status_code),
            duration_ms=str(round(duration_ms, 2)) if duration_ms else None,
            user_id=user_id,
            organisation_id=organisation_id,
            session_id=session_id,
            request_id=request_id,
            user_agent=user_agent,
            ip_address=ip_address,
            query_params=query_params,
            request_size=str(request_size) if request_size else None,
            response_size=str(response_size) if response_size else None,
            service_type=service_type,
            template_used=template_used,
            error_message=error_message,
            timestamp=datetime.now(timezone.utc),
        )


class ApiResponseMetadata(Base):
    __tablename__ = "api_response_metadata"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Link to the original request
    usage_log_id = Column(
        UUID(as_uuid=True), ForeignKey("api_usage_logs.id"), nullable=False, index=True
    )
    
    # Response metadata
    response_status_code = Column(String(10), nullable=False)
    response_size_bytes = Column(Integer)
    response_time_ms = Column(String(50))  # Processing time
    
    # Content metadata (without storing full content)
    content_type = Column(String(100))  # application/json, text/plain, etc.
    content_preview = Column(String(500))  # First 500 chars for debugging
    has_images = Column(Boolean, default=False)  # Whether response contained images
    image_count = Column(Integer, default=0)  # Number of images in response
    
    # Service-specific metadata
    service_response_id = Column(String(255))  # External service response ID if available
    processing_steps = Column(String(1000))  # For semantic search: embedding→search→rank
    
    # Error information
    error_type = Column(String(100))  # timeout, api_error, validation_error, etc.
    error_details = Column(String(1000))  # Detailed error message
    
    # Timestamps
    created_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    
    # Relationships
    usage_log = relationship("ApiUsageLog", backref="response_metadata")

    def __repr__(self) -> str:
        return f"<ApiResponseMetadata(id={self.id}, status={self.response_status_code})>"

    @classmethod
    def create_metadata(
        cls,
        usage_log_id: uuid.UUID,
        response_status_code: int,
        response_size_bytes: int = None,
        response_time_ms: float = None,
        content_type: str = None,
        content_preview: str = None,
        has_images: bool = False,
        image_count: int = 0,
        service_response_id: str = None,
        processing_steps: str = None,
        error_type: str = None,
        error_details: str = None,
    ) -> "ApiResponseMetadata":
        """Create response metadata entry"""
        return cls(
            usage_log_id=usage_log_id,
            response_status_code=str(response_status_code),
            response_size_bytes=response_size_bytes,
            response_time_ms=str(round(response_time_ms, 2)) if response_time_ms else None,
            content_type=content_type,
            content_preview=content_preview[:500] if content_preview else None,
            has_images=has_images,
            image_count=image_count,
            service_response_id=service_response_id,
            processing_steps=processing_steps,
            error_type=error_type,
            error_details=error_details,
        )


class UserResponseRating(Base):
    __tablename__ = "user_response_ratings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Link to the response metadata (nullable for WebSocket responses)
    response_metadata_id = Column(
        UUID(as_uuid=True), ForeignKey("api_response_metadata.id"), nullable=True, index=True
    )
    
    # User who rated the response
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    
    # Rating information
    rating_type = Column(String(20), nullable=False)  # 'thumbs_up', 'thumbs_down'
    rating_value = Column(Integer, nullable=False)  # 1 for up, -1 for down
    
    # Optional feedback
    feedback_text = Column(String(1000))  # Optional text feedback
    
    # Context information
    session_id = Column(String(255), index=True)  # Link to user session
    message_context = Column(String(500))  # The question/query that led to this response
    
    # Timestamps
    rated_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    
    # Relationships
    response_metadata = relationship("ApiResponseMetadata", backref="ratings")
    user = relationship("User", backref="response_ratings")

    def __repr__(self) -> str:
        return f"<UserResponseRating(id={self.id}, rating={self.rating_type})>"

    @classmethod
    def create_rating(
        cls,
        response_metadata_id: uuid.UUID,
        user_id: uuid.UUID,
        rating_type: str,  # 'thumbs_up' or 'thumbs_down'
        session_id: str = None,
        message_context: str = None,
        feedback_text: str = None,
    ) -> "UserResponseRating":
        """Create a user rating for a response"""
        rating_value = 1 if rating_type == 'thumbs_up' else -1
        
        return cls(
            response_metadata_id=response_metadata_id,
            user_id=user_id,
            rating_type=rating_type,
            rating_value=rating_value,
            session_id=session_id,
            message_context=message_context[:500] if message_context else None,
            feedback_text=feedback_text[:1000] if feedback_text else None,
        )
