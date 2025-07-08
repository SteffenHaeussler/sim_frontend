import secrets
from datetime import timedelta
from typing import Any

from fastapi import HTTPException, status
from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.auth.jwt_utils import create_access_token
from src.app.auth.password import hash_password, verify_password
from src.app.models.organisation import Organisation
from src.app.models.password_reset import PasswordReset
from src.app.models.user import User
from src.app.services.email_service import EmailService


class AuthService:
    """Service for handling authentication operations"""

    def __init__(self):
        self.email_service = EmailService()

    async def register_user(
        self, db: AsyncSession, email: str, password: str, first_name: str, last_name: str, organisation_name: str
    ) -> dict[str, Any]:
        """Register a new user"""
        # Check if user already exists
        stmt = select(User).where(User.email == email)
        result = await db.execute(stmt)
        existing_user = result.scalar_one_or_none()

        if existing_user:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User with this email already exists")

        # Get or create organisation
        organisation = await self._get_or_create_organisation(db, organisation_name)

        # Check user limit for organisation
        if not await self._check_user_limit(db, organisation.id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Organisation has reached the maximum limit of {organisation.max_users} users",
            )

        # Create new user
        hashed_password = hash_password(password)
        new_user = User(
            email=email,
            password_hash=hashed_password,
            first_name=first_name,
            last_name=last_name,
            organisation_id=organisation.id,
        )

        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)

        # Generate access token
        access_token = create_access_token(data={"sub": str(new_user.id)}, expires_delta=timedelta(hours=24))

        logger.info(f"New user registered: {email} for organisation: {organisation_name}")

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": str(new_user.id),
                "email": new_user.email,
                "first_name": new_user.first_name,
                "last_name": new_user.last_name,
                "organisation_name": organisation.display_name,
            },
        }

    async def login_user(self, db: AsyncSession, email: str, password: str) -> dict[str, Any]:
        """Login a user"""
        # Find user by email
        stmt = select(User).where(User.email == email, User.is_active.is_(True))
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user or not verify_password(password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

        # Get organisation info
        await db.refresh(user, ["organisation"])

        # Generate access token
        access_token = create_access_token(data={"sub": str(user.id)}, expires_delta=timedelta(hours=24))

        logger.info(f"User logged in: {email}")

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": str(user.id),
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "organisation_name": user.organisation.display_name,
            },
        }

    async def request_password_reset(self, db: AsyncSession, email: str, base_url: str) -> dict[str, Any]:
        """Request a password reset"""
        # Find user by email
        stmt = select(User).where(User.email == email, User.is_active.is_(True))
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user:
            # Return success even if user doesn't exist (security)
            logger.info(f"Password reset requested for non-existent email: {email}")
            return {"message": "If the email exists, a password reset link has been sent"}

        # Generate reset token
        reset_token = secrets.token_urlsafe(32)

        # Create or update password reset record
        stmt = select(PasswordReset).where(PasswordReset.user_id == user.id)
        result = await db.execute(stmt)
        existing_reset = result.scalar_one_or_none()

        if existing_reset:
            existing_reset.token = reset_token
            existing_reset.created_at = func.now()
        else:
            password_reset = PasswordReset(user_id=user.id, token=reset_token)
            db.add(password_reset)

        await db.commit()

        # Send reset email
        email_sent = await self.email_service.send_password_reset_email(
            to_email=user.email, reset_token=reset_token, base_url=base_url, user_name=user.first_name
        )

        if email_sent:
            logger.info(f"Password reset email sent to: {email}")
        else:
            logger.error(f"Failed to send password reset email to: {email}")

        return {"message": "If the email exists, a password reset link has been sent"}

    async def _get_or_create_organisation(self, db: AsyncSession, organisation_name: str) -> Organisation:
        """Get existing organisation or create new one"""
        # Try to find existing organisation by name (case-insensitive)
        stmt = select(Organisation).where(func.lower(Organisation.name) == organisation_name.lower())
        result = await db.execute(stmt)
        organisation = result.scalar_one_or_none()

        if organisation:
            return organisation

        # Create new organisation
        new_organisation = Organisation(
            name=organisation_name.lower(),
            display_name=organisation_name.title(),
        )
        db.add(new_organisation)
        await db.flush()  # Get the ID without committing

        logger.info(f"Created new organisation: {organisation_name}")
        return new_organisation

    async def _check_user_limit(self, db: AsyncSession, organisation_id) -> bool:
        """Check if organisation has reached user limit"""
        # Count current active users
        stmt = select(func.count(User.id)).where(User.organisation_id == organisation_id, User.is_active.is_(True))
        result = await db.execute(stmt)
        current_user_count = result.scalar()

        # Get organisation max_users
        stmt = select(Organisation.max_users).where(Organisation.id == organisation_id)
        result = await db.execute(stmt)
        max_users = result.scalar()

        return current_user_count < max_users
