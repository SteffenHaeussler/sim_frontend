from typing import Optional
from pydantic import BaseModel


class RatingRequest(BaseModel):
    rating_type: str  # 'thumbs_up' or 'thumbs_down'
    session_id: str
    message_context: Optional[str] = None
    feedback_text: Optional[str] = None
    response_metadata_id: Optional[str] = None  # If frontend can provide this


class RatingResponse(BaseModel):
    message: str
    rating_id: str
    rating_type: str