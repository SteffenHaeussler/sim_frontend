import uuid
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..config import get_config
from ..models.audit import AuditLog
from ..models.database import get_db
from ..models.session import UserSession
from ..models.user import User
from .dependencies import get_current_active_user, get_current_user
from .jwt_utils import create_access_token, create_refresh_token, verify_token
from .password import hash_password, hash_token, is_password_strong, verify_password
from .schemas import (
    ChangePasswordRequest,
    CurrentUserResponse,
    LoginRequest,
    LoginResponse,
    PasswordStrengthResponse,
    RefreshTokenRequest,
    SessionResponse,
    TokenResponse,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/login", response_model=LoginResponse)
async def login(
    login_data: LoginRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Authenticate user and return access tokens
    """
    config = get_config()

    # Get user with role and organization
    stmt = (
        select(User)
        .options(selectinload(User.role), selectinload(User.organization))
        .where(User.email == login_data.email)
    )

    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    # Check if user exists and password is correct
    if not user or not verify_password(login_data.password, user.password_hash):
        # Log failed login attempt
        background_tasks.add_task(
            log_failed_login,
            db,
            login_data.email,
            "Invalid credentials",
            request.client.host if request.client else None,
            request.headers.get("User-Agent"),
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        )

    # Check if user can login
    if not user.can_login:
        reason = "Account deactivated"
        if not user.is_active:
            reason = "Account deactivated"
        elif not user.is_verified:
            reason = "Account not verified"
        elif user.is_locked:
            reason = "Account locked"

        background_tasks.add_task(
            log_failed_login,
            db,
            login_data.email,
            reason,
            request.client.host if request.client else None,
            request.headers.get("User-Agent"),
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=reason)

    # Create session
    session_id = uuid.uuid4()
    access_token = create_access_token(
        user_id=user.id,
        email=user.email,
        role=user.role.name,
        organization_id=user.organization_id,
        session_id=session_id,
    )

    refresh_token = create_refresh_token(user_id=user.id, session_id=session_id)

    # Hash tokens for storage
    access_token_hash = hash_token(access_token)
    refresh_token_hash = hash_token(refresh_token)

    # Store session in database
    expires_hours = config.api_mode.JWT_EXPIRATION_HOURS
    if login_data.remember_me:
        expires_hours = 24 * 7  # 7 days for "remember me"

    session = UserSession.create_session(
        user_id=user.id,
        token_hash=access_token_hash,
        refresh_token_hash=refresh_token_hash,
        expires_hours=expires_hours,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
    )
    session.id = session_id  # Use our generated ID

    db.add(session)

    # Update user login info
    user.reset_failed_login()

    # Commit changes
    await db.commit()

    # Log successful login
    background_tasks.add_task(
        log_successful_login,
        db,
        user.id,
        user.organization_id,
        session_id,
        request.client.host if request.client else None,
        request.headers.get("User-Agent"),
    )

    return LoginResponse(
        user=UserResponse.model_validate(user),
        tokens=TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=expires_hours * 3600,
        ),
        permissions=user.role.get_permissions(),
        session_id=session_id,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    refresh_data: RefreshTokenRequest, db: AsyncSession = Depends(get_db)
):
    """
    Refresh access token using refresh token
    """
    # Verify refresh token
    token_data = verify_token(refresh_data.refresh_token)
    if not token_data or token_data.token_type != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
        )

    # Get session
    session_id = uuid.UUID(token_data.session_id)
    user_id = uuid.UUID(token_data.user_id)

    stmt = select(UserSession).where(
        and_(
            UserSession.id == session_id,
            UserSession.user_id == user_id,
            UserSession.is_active == True,
        )
    )
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()

    if not session or not session.can_refresh:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid",
        )

    # Get user with role
    user_stmt = select(User).options(selectinload(User.role)).where(User.id == user_id)
    user_result = await db.execute(user_stmt)
    user = user_result.scalar_one_or_none()

    if not user or not user.can_login:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User cannot login"
        )

    # Create new tokens
    new_access_token = create_access_token(
        user_id=user.id,
        email=user.email,
        role=user.role.name,
        organization_id=user.organization_id,
        session_id=session_id,
    )

    new_refresh_token = create_refresh_token(user_id=user.id, session_id=session_id)

    # Update session with new token hashes
    session.token_hash = hash_token(new_access_token)
    session.refresh_token_hash = hash_token(new_refresh_token)
    session.extend_session()
    session.extend_refresh_token()

    await db.commit()

    config = get_config()
    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        expires_in=config.api_mode.JWT_EXPIRATION_HOURS * 3600,
    )


@router.post("/logout")
async def logout(
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Logout current user (deactivate session)
    """
    # Get current session from token
    authorization = request.headers.get("Authorization", "")
    if authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        token_data = verify_token(token)

        if token_data and token_data.session_id:
            session_id = uuid.UUID(token_data.session_id)

            # Deactivate session
            stmt = select(UserSession).where(UserSession.id == session_id)
            result = await db.execute(stmt)
            session = result.scalar_one_or_none()

            if session:
                session.deactivate()
                await db.commit()

                # Log logout
                background_tasks.add_task(
                    log_logout,
                    db,
                    current_user.id,
                    current_user.organization_id,
                    session_id,
                    request.client.host if request.client else None,
                    request.headers.get("User-Agent"),
                )

    return {"message": "Successfully logged out"}


@router.get("/me", response_model=CurrentUserResponse)
async def get_current_user_info(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get current user information with permissions and session details
    """
    # Get current session
    authorization = request.headers.get("Authorization", "")
    session_info = None

    if authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        token_data = verify_token(token)

        if token_data and token_data.session_id:
            session_id = uuid.UUID(token_data.session_id)
            stmt = select(UserSession).where(UserSession.id == session_id)
            result = await db.execute(stmt)
            session = result.scalar_one_or_none()

            if session:
                session_info = SessionResponse.model_validate(session)

    return CurrentUserResponse(
        user=UserResponse.model_validate(current_user),
        permissions=current_user.role.get_permissions(),
        session=session_info,
        organization_limits={
            "max_users": current_user.organization.max_users,
            "subscription_tier": current_user.organization.subscription_tier,
            "is_enterprise": current_user.organization.is_enterprise,
        },
    )


@router.post("/change-password")
async def change_password(
    password_data: ChangePasswordRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Change current user's password
    """
    # Verify current password
    if not verify_password(password_data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    # Update password
    current_user.password_hash = hash_password(password_data.new_password)
    await db.commit()

    return {"message": "Password changed successfully"}


@router.post("/password-strength", response_model=PasswordStrengthResponse)
async def check_password_strength(password: str):
    """
    Check password strength
    """
    is_strong, issues = is_password_strong(password)

    # Calculate strength score (0-5)
    score = 5 - len(issues)
    if score < 0:
        score = 0

    return PasswordStrengthResponse(is_strong=is_strong, issues=issues, score=score)


@router.get("/sessions", response_model=List[SessionResponse])
async def get_user_sessions(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all active sessions for current user
    """
    stmt = (
        select(UserSession)
        .where(
            and_(UserSession.user_id == current_user.id, UserSession.is_active == True)
        )
        .order_by(UserSession.last_used_at.desc())
    )

    result = await db.execute(stmt)
    sessions = result.scalars().all()

    return [SessionResponse.model_validate(session) for session in sessions]


@router.delete("/sessions/{session_id}")
async def revoke_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Revoke a specific session
    """
    stmt = select(UserSession).where(
        and_(UserSession.id == session_id, UserSession.user_id == current_user.id)
    )
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Session not found"
        )

    session.deactivate()
    await db.commit()

    return {"message": "Session revoked successfully"}


# Background task functions
async def log_failed_login(
    db: AsyncSession, email: str, reason: str, ip_address: str, user_agent: str
):
    """Background task to log failed login"""
    try:
        async with db.begin():
            audit_log = AuditLog.log_login_failure(
                email=email, reason=reason, ip_address=ip_address, user_agent=user_agent
            )
            db.add(audit_log)
    except Exception:
        pass  # Don't let audit logging break the request


async def log_successful_login(
    db: AsyncSession,
    user_id: uuid.UUID,
    org_id: uuid.UUID,
    session_id: uuid.UUID,
    ip_address: str,
    user_agent: str,
):
    """Background task to log successful login"""
    try:
        async with db.begin():
            audit_log = AuditLog.log_login_success(
                user_id=user_id,
                organization_id=org_id,
                session_id=session_id,
                ip_address=ip_address,
                user_agent=user_agent,
            )
            db.add(audit_log)
    except Exception:
        pass


async def log_logout(
    db: AsyncSession,
    user_id: uuid.UUID,
    org_id: uuid.UUID,
    session_id: uuid.UUID,
    ip_address: str,
    user_agent: str,
):
    """Background task to log logout"""
    try:
        async with db.begin():
            audit_log = AuditLog.log_logout(
                user_id=user_id,
                organization_id=org_id,
                session_id=session_id,
                ip_address=ip_address,
                user_agent=user_agent,
            )
            db.add(audit_log)
    except Exception:
        pass
