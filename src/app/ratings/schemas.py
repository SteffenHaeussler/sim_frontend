from pydantic import BaseModel, Field


class RatingRequest(BaseModel):
    rating_type: str = Field(..., pattern="^(thumbs_up|thumbs_down)$")
    message_context: str | None = Field(default=None, max_length=5000)
    feedback_text: str | None = Field(default=None, max_length=1000)


class RatingResponse(BaseModel):
    message: str
    rating_id: str
    rating_type: str
