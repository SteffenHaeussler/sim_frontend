from pydantic import BaseModel, Field


class HealthCheckResponse(BaseModel):
    version: str
    timestamp: float


class SemanticRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
