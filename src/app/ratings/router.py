from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from src.app.auth.dependencies import require_active_user
from src.app.models.database import get_db
from src.app.models.user import UserResponseRating
from src.app.ratings.schemas import RatingRequest, RatingResponse

router = APIRouter(prefix="/ratings", tags=["ratings"])


@router.post("/submit", response_model=RatingResponse)
async def submit_rating(
    rating_request: RatingRequest,
    token_data=Depends(require_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit a user rating for a response"""
    user_id = UUID(token_data.user_id)
    
    logger.info(f"Rating submission: user_id={user_id}, session_id={rating_request.session_id}, rating_type={rating_request.rating_type}")
    
    # For ask-agent WebSocket responses, we don't have response metadata
    # So we'll create a simplified rating that links directly to session and user
    # without requiring response_metadata_id
    
    # Check if user already rated this session/message combination
    existing_rating_stmt = select(UserResponseRating).where(
        UserResponseRating.user_id == user_id,
        UserResponseRating.session_id == rating_request.session_id,
        UserResponseRating.message_context == rating_request.message_context
    )
    existing_result = await db.execute(existing_rating_stmt)
    existing_rating = existing_result.scalar_one_or_none()
    
    if existing_rating:
        # Update existing rating
        existing_rating.rating_type = rating_request.rating_type
        existing_rating.rating_value = 1 if rating_request.rating_type == 'thumbs_up' else -1
        existing_rating.feedback_text = rating_request.feedback_text
        
        await db.commit()
        await db.refresh(existing_rating)
        
        logger.info(f"Rating updated: {existing_rating.id}")
        return RatingResponse(
            message="Rating updated successfully",
            rating_id=str(existing_rating.id),
            rating_type=existing_rating.rating_type
        )
    else:
        # Create new rating without response_metadata_id (for WebSocket responses)
        new_rating = UserResponseRating(
            response_metadata_id=None,  # No response metadata for WebSocket responses
            user_id=user_id,
            rating_type=rating_request.rating_type,
            rating_value=1 if rating_request.rating_type == 'thumbs_up' else -1,
            session_id=rating_request.session_id,
            message_context=rating_request.message_context[:500] if rating_request.message_context else None,
            feedback_text=rating_request.feedback_text[:1000] if rating_request.feedback_text else None,
        )
        
        db.add(new_rating)
        await db.commit()
        await db.refresh(new_rating)
        
        logger.info(f"New rating created: {new_rating.id}")
        return RatingResponse(
            message="Rating submitted successfully",
            rating_id=str(new_rating.id),
            rating_type=new_rating.rating_type
        )


