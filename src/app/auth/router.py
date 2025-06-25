from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_config
from ..models.database import get_db
from ..models.user import User
from ..models.organization import Organization
from .dependencies import require_auth
from .jwt_utils import create_access_token
from .password import hash_password, verify_password
from .schemas import LoginRequest, RegisterRequest, AuthResponse

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
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Get the organization to check max_users limit
    org_stmt = select(Organization).where(Organization.is_active == True).limit(1)
    org_result = await db.execute(org_stmt)
    organization = org_result.scalar_one_or_none()
    
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No active organization available for registration"
        )
    
    # Check current user count for this organization
    user_count_stmt = select(func.count(User.id)).where(User.organization_id == organization.id)
    user_count_result = await db.execute(user_count_stmt)
    current_users = user_count_result.scalar()
    
    # Determine if user should be active based on organization limit
    is_active = current_users < organization.max_users
    
    # Create new user
    hashed_password = hash_password(register_data.password)
    new_user = User(
        email=register_data.email,
        password_hash=hashed_password,
        first_name=register_data.first_name,
        last_name=register_data.last_name,
        organization_id=organization.id,
        is_active=is_active,
        is_verified=True,  # Auto-verify for simplicity
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    # Create access token (even for inactive users, they just can't use protected endpoints)
    config = get_config()
    access_token = create_access_token(
        user_id=new_user.id,
        email=new_user.email,
        expires_delta=timedelta(hours=config.api_mode.JWT_EXPIRATION_HOURS)
    )
    
    return AuthResponse(
        access_token=access_token,
        expires_in=config.api_mode.JWT_EXPIRATION_HOURS * 3600,
        user_email=new_user.email,
        is_active=is_active
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
        expires_delta=timedelta(hours=config.api_mode.JWT_EXPIRATION_HOURS)
    )
    
    return AuthResponse(
        access_token=access_token,
        expires_in=config.api_mode.JWT_EXPIRATION_HOURS * 3600,
        user_email=user.email,
        is_active=user.is_active
    )


@router.post("/logout")
async def logout(_=require_auth()):
    """Logout user (client-side token removal)"""
    return {"message": "Successfully logged out"}