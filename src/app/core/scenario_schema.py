from typing import List, Optional

from pydantic import BaseModel


class ScenarioMessage(BaseModel):
    """Base message structure for scenario analysis"""
    session_id: str
    message_id: str
    sub_id: Optional[str] = None
    type: str  # "scenario_recommendation" or "scenario_result"


class ScenarioRecommendation(ScenarioMessage):
    """Initial recommendation message"""
    type: str = "scenario_recommendation"
    recommendations: List[str]
    query: str


class ScenarioResult(ScenarioMessage):
    """Result from parallel agent call"""
    type: str = "scenario_result"
    agent: str  # "sqlagent" or "toolagent"
    content: str
    is_complete: bool = False
    error: Optional[str] = None


class AgentQuery(BaseModel):
    """Query to be sent to an agent"""
    agent_type: str  # "sqlagent" or "toolagent"
    query: str
    sub_id: str