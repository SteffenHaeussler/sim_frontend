import secrets
import uuid  # Added
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.auth.dependencies import require_active_user, require_auth
from src.app.auth.jwt_utils import create_access_token, create_refresh_token
from src.app.auth.password import hash_password, verify_password
from src.app.auth.schemas import (
    AuthResponse,
    DeleteAccountRequest,
    DeleteAccountResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    RefreshTokenRequest,  # Added
    RegisterRequest,
    ResetPasswordRequest,
    ResetPasswordResponse,
    UpdateProfileRequest,
    UpdateProfileResponse,
)
from src.app.config import config_service
from src.app.models.database import get_db
from src.app.models.organisation import Organisation
from src.app.models.password_reset import PasswordReset
from src.app.models.user import User
from src.app.services.email_service import EmailService
from src.app.utils.logging_utils import ServiceLogger

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post(
    "/register",
    response_model=AuthResponse,
    summary="Register new user",
    description="Create a new user account with email and password. Password must be at least 8 characters with uppercase and digit.",
    responses={
        400: {"description": "Email already registered"},
        503: {"description": "No active organisation available"},
    },
)
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
        ServiceLogger.log_auth_event("registration_failed_duplicate", register_data.email, success=False)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

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
    user_count_stmt = select(func.count(User.id)).where(User.organisation_id == organisation.id)
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
    ServiceLogger.log_auth_event("user_registered", new_user.email, success=True)

    # Create access token (even for inactive users, they just can't use protected endpoints)
    config = config_service.get_jwt_utils()
    access_token = create_access_token(
        user_id=new_user.id,
        email=new_user.email,
        organisation_id=new_user.organisation_id,
        expires_delta=timedelta(hours=config.get("jwt_expiration_hours")),
    )

    return AuthResponse(
        access_token=access_token,
        expires_in=config.get("jwt_expiration_hours") * 3600,
        user_email=new_user.email,
        first_name=new_user.first_name or "",
        last_name=new_user.last_name or "",
        is_active=is_active,
    )


@router.post(
    "/login",
    response_model=AuthResponse,
    summary="User login",
    description="Authenticate user with email and password. Returns access and refresh tokens.",
    responses={401: {"description": "Incorrect email or password"}},
)
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
        ServiceLogger.log_auth_event("login_failed", login_data.email, success=False)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create access token (short-lived) and refresh token (longer-lived)
    jwt_config = config_service.get_jwt_utils()

    # Access Token
    access_token_expire_minutes = jwt_config.get("jwt_access_expiration_minutes", 15)
    access_token = create_access_token(
        user_id=user.id,
        email=user.email,
        organisation_id=user.organisation_id,
        expires_delta=timedelta(minutes=access_token_expire_minutes),
    )
    access_token_expires_in_seconds = access_token_expire_minutes * 60

    # Refresh Token
    refresh_token_expire_days = jwt_config.get("JWT_REFRESH_EXPIRATION_DAYS", 7)
    refresh_token = create_refresh_token(
        user_id=user.id,
        email=user.email,
        organisation_id=user.organisation_id,
        expires_delta=timedelta(days=refresh_token_expire_days),
    )
    refresh_token_expires_in_seconds = refresh_token_expire_days * 24 * 3600

    ServiceLogger.log_auth_event("user_login", user.email, success=True)

    return AuthResponse(
        access_token=access_token,
        expires_in=access_token_expires_in_seconds,
        refresh_token=refresh_token,
        refresh_token_expires_in=refresh_token_expires_in_seconds,
        user_email=user.email,
        first_name=user.first_name or "",
        last_name=user.last_name or "",
        is_active=user.is_active,
    )


@router.post("/logout")
async def logout(_=require_auth()):
    """Logout user (client-side token removal)"""
    return {"message": "Successfully logged out"}


@router.post("/refresh_token", response_model=AuthResponse)
async def refresh_token_route(
    refresh_request: RefreshTokenRequest,
    _db: AsyncSession = Depends(get_db),  # Added db for potential future use (e.g. revocation list)
):
    """Refresh access token using a refresh token"""
    from src.app.auth.jwt_utils import verify_token  # Moved import here for clarity

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token_data = verify_token(token=refresh_request.refresh_token, expected_token_type="refresh")
    if not token_data or not token_data.user_id or not token_data.email:
        logger.warning(
            f"Invalid or expired refresh token provided for user_id: {token_data.user_id if token_data else 'unknown'}"
        )
        raise credentials_exception

    # Fetch user to ensure they still exist and are active (optional, but good practice)
    # For now, we trust the refresh token if it's valid and not expired.
    # A more robust implementation might check if the user is still active in the DB.

    jwt_config = config_service.get_jwt_utils()
    access_token_expire_minutes = jwt_config.get("JWT_ACCESS_EXPIRATION_MINUTES", 15)

    new_access_token = create_access_token(
        user_id=uuid.UUID(token_data.user_id),  # Convert string UUID from token back to UUID object
        email=token_data.email,
        organisation_id=uuid.UUID(token_data.organisation_id) if token_data.organisation_id else None,
        expires_delta=timedelta(minutes=access_token_expire_minutes),
    )
    access_token_expires_in_seconds = access_token_expire_minutes * 60

    ServiceLogger.log_auth_event("token_refreshed", token_data.email, success=True)

    # Return only new access token details.
    # Refresh token itself is not returned again here, nor are user details.
    return AuthResponse(
        access_token=new_access_token,
        expires_in=access_token_expires_in_seconds,
        token_type="bearer",
        # Fields below are not strictly necessary for a refresh response,
        # but AuthResponse requires them. They are not re-fetched from DB here.
        user_email=token_data.email,  # Email from token
        first_name="",  # Not available from refresh token directly without DB lookup
        last_name="",  # Not available from refresh token directly without DB lookup
        is_active=True,  # Assume active, or would need DB lookup. User must be active to use new access token.
    )


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
        password_reset = PasswordReset.create_reset_token(user_id=user.id, token=reset_token, expiration_hours=24)

        db.add(password_reset)
        await db.commit()

        # Get base URL for reset link
        base_url = str(request.base_url).rstrip("/")

        # Send password reset email - create service instance here to get current env vars
        email_service = EmailService()
        # Email service logging is handled internally

        await email_service.send_password_reset_email(
            to_email=user.email,
            reset_token=reset_token,
            base_url=base_url,
            user_name=user.first_name or user.email.split("@")[0],
        )

    # Always return success to prevent email enumeration
    return ForgotPasswordResponse(
        message="If an account with that email exists, a password reset link has been sent.",
        email=forgot_request.email,
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
    stmt = select(PasswordReset).where(PasswordReset.token == reset_request.token)
    result = await db.execute(stmt)
    password_reset = result.scalar_one_or_none()

    if not password_reset or not password_reset.is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    # Get the user
    user_stmt = select(User).where(User.id == password_reset.user_id)
    user_result = await db.execute(user_stmt)
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User not found")

    # Update user's password
    user.password_hash = hash_password(reset_request.new_password)

    # Mark the reset token as used
    password_reset.mark_as_used()

    # Commit changes
    await db.commit()

    return ResetPasswordResponse(message="Password has been reset successfully")


async def _get_user_by_token(token_data, db: AsyncSession) -> User:
    """Helper function to get user from token data"""
    import uuid

    stmt = select(User).where(User.id == uuid.UUID(token_data.user_id))
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.put("/profile", response_model=UpdateProfileResponse)
async def update_profile(
    profile_data: UpdateProfileRequest,
    token_data=Depends(require_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user profile (first name and last name)"""
    user = await _get_user_by_token(token_data, db)

    user.first_name = profile_data.first_name.strip()
    user.last_name = profile_data.last_name.strip()

    await db.commit()
    await db.refresh(user)
    ServiceLogger.log_auth_event("profile_updated", user.email, success=True)

    return UpdateProfileResponse(
        message="Profile updated successfully",
        user_email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
    )


@router.delete("/account", response_model=DeleteAccountResponse)
async def delete_account(
    delete_data: DeleteAccountRequest,
    token_data=Depends(require_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete user account (requires password confirmation)"""
    user = await _get_user_by_token(token_data, db)

    if not verify_password(delete_data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid password")

    # Delete related records first to avoid foreign key constraint violations
    from src.app.models.tracking import UserResponseRating

    # Delete user's response ratings first
    stmt = select(UserResponseRating).where(UserResponseRating.user_id == user.id)
    result = await db.execute(stmt)
    user_ratings = result.scalars().all()

    for rating in user_ratings:
        await db.delete(rating)

    # Now delete the user
    await db.delete(user)
    await db.commit()
    ServiceLogger.log_auth_event("account_deleted", user.email, success=True)

    return DeleteAccountResponse(message="Account deleted successfully")
