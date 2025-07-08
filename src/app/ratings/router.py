from uuid import UUID

from fastapi import APIRouter, Depends, Request
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.auth.dependencies import require_active_user
from src.app.models.database import get_db
from src.app.models.tracking import UserResponseRating
from src.app.ratings.schemas import RatingRequest, RatingResponse

router = APIRouter(prefix="/ratings", tags=["ratings"])


@router.post("/submit", response_model=RatingResponse)
async def submit_rating(
    rating_request: RatingRequest,
    request: Request,
    token_data=Depends(require_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit a user rating for a response"""
    user_id = UUID(token_data.user_id)

    # Extract tracking IDs from headers (with fallback to query params for backward compatibility)
    session_id = request.headers.get("x-session-id") or request.query_params.get("session_id")
    event_id = request.headers.get("x-event-id") or request.query_params.get("event_id")
    request_id = request.headers.get("x-request-id") or request.query_params.get("request_id")

    logger.info(
        f"Rating submission: user_id={user_id}, session_id={session_id}, event_id={event_id}, request_id={request_id}, rating_type={rating_request.rating_type}"
    )

    # Always create a new rating - each button click should be tracked separately
    new_rating = UserResponseRating(
        usage_log_id=None,  # Will be linked via event_id matching
        user_id=user_id,
        rating_type=rating_request.rating_type,
        rating_value=1 if rating_request.rating_type == "thumbs_up" else -1,
        session_id=session_id,
        event_id=event_id,  # Store the unique event ID
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
        rating_type=new_rating.rating_type,
    )
