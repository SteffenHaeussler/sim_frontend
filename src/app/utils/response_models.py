"""Common response models for API responses"""

from typing import Any, Literal

from pydantic import BaseModel, Field


class SuccessResponse(BaseModel):
    """Standard success response"""

    status: Literal["success"] = "success"
    message: str | None = None
    data: dict[str, Any] | None = None


class ErrorResponse(BaseModel):
    """Standard error response"""

    status: Literal["error"] = "error"
    error: str
    details: str | None = None
    code: int | None = None


class AgentResponse(BaseModel):
    """Response from agent services"""

    status: str
    result: str | None = None
    error: str | None = None
    session_id: str | None = None

    model_config = {
        "json_schema_extra": {
            "example": {
                "status": "success",
                "result": "Agent response text",
                "session_id": "123e4567-e89b-12d3-a456-426614174000",
            }
        }
    }


class TriggerResponse(BaseModel):
    """Response for trigger endpoints"""

    status: str
    session_id: str
    question: str | None = None
    message: str | None = None

    model_config = {
        "json_schema_extra": {
            "example": {
                "status": "triggered",
                "session_id": "123e4567-e89b-12d3-a456-426614174000",
                "question": "What is the temperature?",
            }
        }
    }


class AssetInfoResponse(BaseModel):
    """Response for asset information endpoints"""

    asset_id: str | None = None
    name: str | None = None
    asset_type: str | None = None
    error: str | None = None

    model_config = {
        "json_schema_extra": {
            "example": {"asset_id": "asset_001", "name": "Temperature Sensor 1", "asset_type": "sensor"}
        }
    }


class PaginatedResponse(BaseModel):
    """Response for paginated endpoints"""

    items: list[Any] = Field(default_factory=list)
    total: int
    page: int
    limit: int
    pages: int

    model_config = {"json_schema_extra": {"example": {"items": [], "total": 100, "page": 1, "limit": 20, "pages": 5}}}


# Helper functions to create responses
def success_response(message: str | None = None, **data) -> dict:
    """Create a success response"""
    response = {"status": "success"}
    if message:
        response["message"] = message
    if data:
        response["data"] = data
    return response


def error_response(error: str, status_code: int | None = None, **details) -> dict:
    """Create an error response"""
    response = {"status": "error", "error": error}
    if status_code:
        response["code"] = status_code
    if details:
        response.update(details)
    return response


def trigger_response(session_id: str, question: str | None = None) -> dict:
    """Create a trigger response"""
    response = {"status": "triggered", "session_id": session_id}
    if question:
        response["question"] = question
    return response
