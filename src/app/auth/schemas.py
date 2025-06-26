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


# Response schema for both login and register
class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds until token expires
    user_email: str
    first_name: str
    is_active: bool


# Response schemas for password reset
class ForgotPasswordResponse(BaseModel):
    message: str
    email: str


class ResetPasswordResponse(BaseModel):
    message: str
