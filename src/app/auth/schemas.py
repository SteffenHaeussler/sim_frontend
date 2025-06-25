from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, Dict, List, Any
from datetime import datetime
import uuid

# Request schemas
class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    remember_me: bool = False

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str
    
    @validator('new_password')
    def validate_password_strength(cls, v):
        from .password import is_password_strong
        is_strong, issues = is_password_strong(v)
        if not is_strong:
            raise ValueError(f"Password is not strong enough: {', '.join(issues)}")
        return v

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    
    @validator('new_password')
    def validate_password_strength(cls, v):
        from .password import is_password_strong
        is_strong, issues = is_password_strong(v)
        if not is_strong:
            raise ValueError(f"Password is not strong enough: {', '.join(issues)}")
        return v

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role_id: uuid.UUID
    organization_id: Optional[uuid.UUID] = None  # Will use current user's org if not provided
    
    @validator('password')
    def validate_password_strength(cls, v):
        from .password import is_password_strong
        is_strong, issues = is_password_strong(v)
        if not is_strong:
            raise ValueError(f"Password is not strong enough: {', '.join(issues)}")
        return v

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role_id: Optional[uuid.UUID] = None
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None

# Response schemas
class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds until access token expires

class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    first_name: Optional[str]
    last_name: Optional[str]
    full_name: str
    is_active: bool
    is_verified: bool
    is_locked: bool
    last_login: Optional[datetime]
    created_at: datetime
    role: "RoleResponse"
    organization: "OrganizationResponse"
    
    class Config:
        from_attributes = True

class RoleResponse(BaseModel):
    id: uuid.UUID
    name: str
    display_name: str
    description: Optional[str]
    permissions: Dict[str, List[str]]
    
    class Config:
        from_attributes = True

class OrganizationResponse(BaseModel):
    id: uuid.UUID
    name: str
    display_name: str
    subscription_tier: str
    is_active: bool
    
    class Config:
        from_attributes = True

class SessionResponse(BaseModel):
    id: uuid.UUID
    ip_address: Optional[str]
    user_agent: Optional[str]
    browser_info: Dict[str, str]
    created_at: datetime
    last_used_at: datetime
    expires_at: datetime
    is_active: bool
    
    class Config:
        from_attributes = True

class CurrentUserResponse(BaseModel):
    user: UserResponse
    permissions: Dict[str, List[str]]
    session: SessionResponse
    organization_limits: Dict[str, Any]

class LoginResponse(BaseModel):
    user: UserResponse
    tokens: TokenResponse
    permissions: Dict[str, List[str]]
    session_id: uuid.UUID

class PasswordStrengthResponse(BaseModel):
    is_strong: bool
    issues: List[str]
    score: int  # 0-5 strength score

class ApiKeyCreate(BaseModel):
    name: str
    permissions: Optional[Dict[str, List[str]]] = None
    expires_days: Optional[int] = None

class ApiKeyResponse(BaseModel):
    id: uuid.UUID
    name: str
    key_prefix: str  # First 8 characters for identification
    permissions: Dict[str, List[str]]
    is_active: bool
    expires_at: Optional[datetime]
    last_used_at: Optional[datetime]
    created_at: datetime
    
    class Config:
        from_attributes = True

class ApiKeyCreatedResponse(BaseModel):
    api_key: str  # Full key shown only once
    key_info: ApiKeyResponse

# Error response schemas
class ErrorResponse(BaseModel):
    detail: str
    error_code: Optional[str] = None
    extra_info: Optional[Dict[str, Any]] = None

class ValidationErrorResponse(BaseModel):
    detail: str
    field_errors: List[Dict[str, str]]

# Update forward references
UserResponse.model_rebuild()
RoleResponse.model_rebuild()
OrganizationResponse.model_rebuild()