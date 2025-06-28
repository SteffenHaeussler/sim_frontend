from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from src.app.auth.dependencies import require_active_user
from src.app.models.database import get_db
from src.app.models.tracking import UserResponseRating
from src.app.ratings.schemas import RatingRequest, RatingResponse

router = APIRouter(prefix="/ratings", tags=["ratings"])


@router.post("/submit", response_model=RatingResponse)
async def submit_rating(
    rating_request: RatingRequest,
    request: Request,
    session_id: str = None,
    token_data=Depends(require_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit a user rating for a response"""
    user_id = UUID(token_data.user_id)
    
    logger.info(f"Rating submission: user_id={user_id}, session_id={rating_request.session_id}, rating_type={rating_request.rating_type}")
    
    # Always create a new rating - each button click should be tracked separately
    new_rating = UserResponseRating(
        usage_log_id=None,  # Will be linked via event_id matching
        user_id=user_id,
        rating_type=rating_request.rating_type,
        rating_value=1 if rating_request.rating_type == 'thumbs_up' else -1,
        session_id=rating_request.session_id,
        event_id=rating_request.event_id,  # Store the unique event ID
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


