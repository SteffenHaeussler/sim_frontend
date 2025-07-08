from pydantic import BaseModel


class RatingRequest(BaseModel):
    rating_type: str  # 'thumbs_up' or 'thumbs_down'
    message_context: str | None = None
    feedback_text: str | None = None


class RatingResponse(BaseModel):
    message: str
    rating_id: str
    rating_type: str
