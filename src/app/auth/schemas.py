from pydantic import BaseModel, EmailStr, Field, field_validator


# Request schemas
class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)
    remember_me: bool = False


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)
    first_name: str = Field(default="", max_length=50)
    last_name: str = Field(default="", max_length=50)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=100)

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1)


# Response schema for both login and register
class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds until access_token expires
    refresh_token: str | None = None
    refresh_token_expires_in: int | None = None  # seconds until refresh_token expires
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
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)


class UpdateProfileResponse(BaseModel):
    message: str
    user_email: str
    first_name: str
    last_name: str


class DeleteAccountRequest(BaseModel):
    password: str = Field(..., min_length=1)  # Require password confirmation for security


class DeleteAccountResponse(BaseModel):
    message: str
