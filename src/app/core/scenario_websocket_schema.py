from typing import Literal, Union

from pydantic import BaseModel, Field, field_validator


class ScenarioQueryMessage(BaseModel):
    """Schema for query messages"""
    type: Literal["query"] = Field(default="query")
    query: str = Field(..., min_length=1, max_length=1000, description="The scenario query")
    message_id: str = Field(..., min_length=1, max_length=100, description="Unique message identifier")
    
    @field_validator('query')
    @classmethod
    def validate_query(cls, v: str) -> str:
        """Validate and sanitize query"""
        # Strip whitespace
        v = v.strip()
        
        # Check it's not empty after stripping
        if not v:
            raise ValueError("Query cannot be empty")
        
        # Check for potentially malicious content
        dangerous_patterns = [
            '<script', 'javascript:', 'onerror=', 'onclick=',
            'onload=', 'eval(', 'expression(', 'vbscript:'
        ]
        
        v_lower = v.lower()
        for pattern in dangerous_patterns:
            if pattern in v_lower:
                raise ValueError(f"Query contains potentially dangerous content: {pattern}")
        
        return v
    
    @field_validator('message_id')
    @classmethod
    def validate_message_id(cls, v: str) -> str:
        """Validate message ID format"""
        # Should match the format from frontend: scenario-timestamp-random
        import re
        
        # Allow alphanumeric, hyphens, and underscores
        if not re.match(r'^[a-zA-Z0-9\-_]+$', v):
            raise ValueError("Invalid message_id format")
        
        return v


class ScenarioRetryMessage(BaseModel):
    """Schema for retry messages"""
    type: Literal["retry"] = Field(default="retry")
    message_id: str = Field(..., description="Original message ID")
    sub_id: str = Field(..., description="Sub-message ID to retry")
    agent_type: str = Field(..., description="Agent type (sqlagent or toolagent)")
    
    @field_validator('agent_type')
    @classmethod
    def validate_agent_type(cls, v: str) -> str:
        """Validate agent type"""
        if v not in ['sqlagent', 'toolagent']:
            raise ValueError("Agent type must be 'sqlagent' or 'toolagent'")
        return v


# Union type for all possible WebSocket messages
ScenarioWebSocketMessage = Union[ScenarioQueryMessage, ScenarioRetryMessage]


class ScenarioErrorResponse(BaseModel):
    """Error response schema"""
    type: Literal["error"] = Field(default="error")
    error: str = Field(..., description="Error message")
    message_id: str | None = Field(default=None, description="Related message ID if available")