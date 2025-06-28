from typing import Optional

from pydantic import BaseModel, EmailStr


# Request schemas
class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    remember_me: bool = False


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str = ""
    last_name: str = ""


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


# Response schema for both login and register
class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds until access_token expires
    refresh_token: Optional[str] = None
    refresh_token_expires_in: Optional[int] = None  # seconds until refresh_token expires
    user_email: str
    first_name: str
    last_name: str
    is_active: bool


# Response schemas for password reset
class ForgotPasswordResponse(BaseModel):
    message: str
    email: str


class ResetPasswordResponse(BaseModel):
    message: str


# Profile management schemas
class UpdateProfileRequest(BaseModel):
    first_name: str
    last_name: str


class UpdateProfileResponse(BaseModel):
    message: str
    user_email: str
    first_name: str
    last_name: str


class DeleteAccountRequest(BaseModel):
    password: str  # Require password confirmation for security


class DeleteAccountResponse(BaseModel):
    message: str
