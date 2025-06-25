from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, desc
from sqlalchemy.orm import selectinload
from typing import List, Optional
import uuid

from ..models.database import get_db
from ..models.user import User
from ..models.role import Role
from ..models.organization import Organization
from ..models.audit import AuditLog
from ..models.session import UserSession
from .schemas import (
    UserCreate, UserUpdate, UserResponse, 
    RoleResponse, OrganizationResponse
)
from .password import hash_password
from .dependencies import require_admin, require_manager, get_current_active_user

router = APIRouter(prefix="/admin", tags=["admin"])

@router.get("/users", response_model=List[UserResponse])
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    organization_id: Optional[uuid.UUID] = None,
    role_id: Optional[uuid.UUID] = None,
    is_active: Optional[bool] = None,
    current_user: User = Depends(require_manager),
    db: AsyncSession = Depends(get_db)
):
    """
    List users (managers can only see users in their organization)
    """
    # Build query
    stmt = select(User).options(
        selectinload(User.role),
        selectinload(User.organization)
    )
    
    # Managers can only see users in their organization
    if not current_user.is_admin:
        stmt = stmt.where(User.organization_id == current_user.organization_id)
    elif organization_id:
        stmt = stmt.where(User.organization_id == organization_id)
    
    # Apply filters
    if role_id:
        stmt = stmt.where(User.role_id == role_id)
    if is_active is not None:
        stmt = stmt.where(User.is_active == is_active)
    
    # Apply pagination
    stmt = stmt.offset(skip).limit(limit).order_by(User.created_at.desc())
    
    result = await db.execute(stmt)
    users = result.scalars().all()
    
    return [UserResponse.model_validate(user) for user in users]

@router.post("/users", response_model=UserResponse)
async def create_user(
    user_data: UserCreate,
    current_user: User = Depends(require_manager),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new user (managers can only create users in their organization)
    """
    # Check if email already exists
    existing_user = await db.execute(
        select(User).where(User.email == user_data.email)
    )
    if existing_user.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Determine organization
    target_org_id = user_data.organization_id
    if not current_user.is_admin:
        # Managers can only create users in their own organization
        target_org_id = current_user.organization_id
    elif not target_org_id:
        # Default to current user's organization if not specified
        target_org_id = current_user.organization_id
    
    # Check if organization exists and user can create users there
    org_stmt = select(Organization).where(Organization.id == target_org_id)
    org_result = await db.execute(org_stmt)
    organization = org_result.scalar_one_or_none()
    
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    if not current_user.is_admin and target_org_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot create users in other organizations"
        )
    
    # Check organization user limits
    user_count_stmt = select(func.count(User.id)).where(
        and_(User.organization_id == target_org_id, User.is_active == True)
    )
    user_count_result = await db.execute(user_count_stmt)
    current_user_count = user_count_result.scalar()
    
    if not organization.can_add_users(current_user_count):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Organization has reached maximum user limit ({organization.max_users})"
        )
    
    # Verify role exists
    role_stmt = select(Role).where(Role.id == user_data.role_id)
    role_result = await db.execute(role_stmt)
    role = role_result.scalar_one_or_none()
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    
    # Create user
    new_user = User(
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        role_id=user_data.role_id,
        organization_id=target_org_id,
        is_active=True,
        is_verified=True  # Admin-created users are auto-verified
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    # Load relationships for response
    stmt = select(User).options(
        selectinload(User.role),
        selectinload(User.organization)
    ).where(User.id == new_user.id)
    result = await db.execute(stmt)
    user_with_relations = result.scalar_one()
    
    return UserResponse.model_validate(user_with_relations)

@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: uuid.UUID,
    current_user: User = Depends(require_manager),
    db: AsyncSession = Depends(get_db)
):
    """
    Get user by ID
    """
    stmt = select(User).options(
        selectinload(User.role),
        selectinload(User.organization)
    ).where(User.id == user_id)
    
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Managers can only see users in their organization
    if not current_user.is_admin and user.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot access users from other organizations"
        )
    
    return UserResponse.model_validate(user)

@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: uuid.UUID,
    user_data: UserUpdate,
    current_user: User = Depends(require_manager),
    db: AsyncSession = Depends(get_db)
):
    """
    Update user
    """
    # Get user
    stmt = select(User).options(
        selectinload(User.role),
        selectinload(User.organization)
    ).where(User.id == user_id)
    
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check permissions
    if not current_user.is_admin and user.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify users from other organizations"
        )
    
    # Prevent non-admins from modifying admin users
    if not current_user.is_admin and user.role.name == "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify admin users"
        )
    
    # Update fields
    if user_data.first_name is not None:
        user.first_name = user_data.first_name
    if user_data.last_name is not None:
        user.last_name = user_data.last_name
    if user_data.is_active is not None:
        user.is_active = user_data.is_active
    if user_data.is_verified is not None:
        user.is_verified = user_data.is_verified
    
    # Handle role change
    if user_data.role_id is not None:
        # Verify new role exists
        role_stmt = select(Role).where(Role.id == user_data.role_id)
        role_result = await db.execute(role_stmt)
        new_role = role_result.scalar_one_or_none()
        
        if not new_role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Role not found"
            )
        
        # Prevent non-admins from assigning admin role
        if not current_user.is_admin and new_role.name == "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot assign admin role"
            )
        
        user.role_id = user_data.role_id
    
    await db.commit()
    await db.refresh(user)
    
    return UserResponse.model_validate(user)

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: uuid.UUID,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete user (admin only, soft delete by deactivating)
    """
    # Get user
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prevent deleting self
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    # Soft delete by deactivating
    user.is_active = False
    
    # Deactivate all user sessions
    session_stmt = select(UserSession).where(UserSession.user_id == user_id)
    session_result = await db.execute(session_stmt)
    sessions = session_result.scalars().all()
    
    for session in sessions:
        session.deactivate()
    
    await db.commit()
    
    return {"message": "User deactivated successfully"}

@router.get("/roles", response_model=List[RoleResponse])
async def list_roles(
    current_user: User = Depends(require_manager),
    db: AsyncSession = Depends(get_db)
):
    """
    List all available roles
    """
    stmt = select(Role).order_by(Role.name)
    result = await db.execute(stmt)
    roles = result.scalars().all()
    
    return [RoleResponse.model_validate(role) for role in roles]

@router.get("/organizations", response_model=List[OrganizationResponse])
async def list_organizations(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    List all organizations (admin only)
    """
    stmt = select(Organization).order_by(Organization.name)
    result = await db.execute(stmt)
    organizations = result.scalars().all()
    
    return [OrganizationResponse.model_validate(org) for org in organizations]

@router.get("/audit-logs")
async def get_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    user_id: Optional[uuid.UUID] = None,
    action: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Get audit logs (admin only)
    """
    stmt = select(AuditLog)
    
    # Apply filters
    if user_id:
        stmt = stmt.where(AuditLog.user_id == user_id)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    
    # Apply pagination
    stmt = stmt.offset(skip).limit(limit).order_by(desc(AuditLog.created_at))
    
    result = await db.execute(stmt)
    audit_logs = result.scalars().all()
    
    return [
        {
            "id": str(log.id),
            "user_id": str(log.user_id) if log.user_id else None,
            "action": log.action,
            "resource": log.resource,
            "details": log.details,
            "success": log.success,
            "created_at": log.created_at,
            "ip_address": str(log.ip_address) if log.ip_address else None
        }
        for log in audit_logs
    ]

@router.post("/users/{user_id}/unlock")
async def unlock_user(
    user_id: uuid.UUID,
    current_user: User = Depends(require_manager),
    db: AsyncSession = Depends(get_db)
):
    """
    Unlock a locked user account
    """
    # Get user
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check permissions
    if not current_user.is_admin and user.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot unlock users from other organizations"
        )
    
    # Unlock user
    user.unlock_account()
    await db.commit()
    
    return {"message": "User account unlocked successfully"}