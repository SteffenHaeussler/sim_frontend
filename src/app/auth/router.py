import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.auth.dependencies import require_auth
from src.app.auth.email_service import EmailService
from src.app.auth.jwt_utils import create_access_token
from src.app.auth.password import hash_password, verify_password
from src.app.auth.schemas import (
    AuthResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    ResetPasswordResponse,
)
from src.app.config import get_config
from src.app.models.database import get_db
from src.app.models.password_reset import PasswordReset
from src.app.models.user import Organisation, User

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/register", response_model=AuthResponse)
async def register(
    register_data: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """Register a new user"""
    # Check if user already exists
    stmt = select(User).where(User.email == register_data.email)
    result = await db.execute(stmt)
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered"
        )

    # Get the organisation to check max_users limit
    org_stmt = select(Organisation).where(Organisation.is_active).limit(1)
    org_result = await db.execute(org_stmt)
    organisation = org_result.scalar_one_or_none()

    if not organisation:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No active organisation available for registration",
        )

    # Check current user count for this organisation
    user_count_stmt = select(func.count(User.id)).where(
        User.organisation_id == organisation.id
    )
    user_count_result = await db.execute(user_count_stmt)
    current_users = user_count_result.scalar()

    # Determine if user should be active based on organisation limit
    is_active = current_users < organisation.max_users

    # Create new user
    hashed_password = hash_password(register_data.password)
    new_user = User(
        email=register_data.email,
        password_hash=hashed_password,
        first_name=register_data.first_name,
        last_name=register_data.last_name,
        organisation_id=organisation.id,
        is_active=is_active,
    )

    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Create access token (even for inactive users, they just can't use protected endpoints)
    config = get_config()
    access_token = create_access_token(
        user_id=new_user.id,
        email=new_user.email,
        expires_delta=timedelta(hours=config.api_mode.JWT_EXPIRATION_HOURS),
    )

    return AuthResponse(
        access_token=access_token,
        expires_in=config.api_mode.JWT_EXPIRATION_HOURS * 3600,
        user_email=new_user.email,
        first_name=new_user.first_name or "",
        is_active=is_active,
    )


@router.post("/login", response_model=AuthResponse)
async def login(
    login_data: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Login user"""
    # Get user by email
    stmt = select(User).where(User.email == login_data.email)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create access token (even for inactive users - they get token but is_active=False)
    config = get_config()
    access_token = create_access_token(
        user_id=user.id,
        email=user.email,
        expires_delta=timedelta(hours=config.api_mode.JWT_EXPIRATION_HOURS),
    )

    return AuthResponse(
        access_token=access_token,
        expires_in=config.api_mode.JWT_EXPIRATION_HOURS * 3600,
        user_email=user.email,
        first_name=user.first_name or "",
        is_active=user.is_active,
    )


@router.post("/logout")
async def logout(_=require_auth()):
    """Logout user (client-side token removal)"""
    return {"message": "Successfully logged out"}


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(
    request: Request,
    forgot_request: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Request password reset
    
    Sends a password reset email if the user exists.
    Always returns success to prevent email enumeration attacks.
    """
    # Get user by email
    stmt = select(User).where(User.email == forgot_request.email)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if user:
        # Generate secure random token
        reset_token = secrets.token_urlsafe(32)
        
        # Create password reset record
        password_reset = PasswordReset.create_reset_token(
            user_id=user.id,
            token=reset_token,
            expiration_hours=24
        )
        
        db.add(password_reset)
        await db.commit()
        
        # Get base URL for reset link
        base_url = str(request.base_url).rstrip('/')
        
        # Send password reset email - create service instance here to get current env vars
        email_service = EmailService()
        logger.info(f"Email service configured: {email_service.is_configured}")
        logger.info(f"SMTP server: {email_service.smtp_server}")
        logger.info(f"SMTP username: {email_service.smtp_username}")
        
        await email_service.send_password_reset_email(
            to_email=user.email,
            reset_token=reset_token,
            base_url=base_url,
            user_name=user.first_name or user.email.split("@")[0]
        )
    
    # Always return success to prevent email enumeration
    return ForgotPasswordResponse(
        message="If an account with that email exists, a password reset link has been sent.",
        email=forgot_request.email
    )


@router.post("/reset-password", response_model=ResetPasswordResponse)
async def reset_password(
    reset_request: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Reset password using valid token
    """
    # Find the password reset request
    stmt = select(PasswordReset).where(
        PasswordReset.token == reset_request.token
    )
    result = await db.execute(stmt)
    password_reset = result.scalar_one_or_none()
    
    if not password_reset or not password_reset.is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    # Get the user
    user_stmt = select(User).where(User.id == password_reset.user_id)
    user_result = await db.execute(user_stmt)
    user = user_result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not found"
        )
    
    # Update user's password
    user.password_hash = hash_password(reset_request.new_password)
    
    # Mark the reset token as used
    password_reset.mark_as_used()
    
    # Commit changes
    await db.commit()
    
    return ResetPasswordResponse(
        message="Password has been reset successfully"
    )
