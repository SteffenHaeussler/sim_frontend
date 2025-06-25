from pydantic import BaseModel


class HealthCheckResponse(BaseModel):
    version: str
    timestamp: float


class SemanticRequest(BaseModel):
    query: str
