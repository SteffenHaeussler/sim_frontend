from pydantic import BaseModel, EmailStr


# Request schemas
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str = ""
    last_name: str = ""


# Response schema for both login and register
class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds until token expires
    user_email: str
    is_active: bool
