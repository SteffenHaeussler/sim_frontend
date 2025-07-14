from pydantic import BaseModel


class ScenarioMessage(BaseModel):
    """Base message structure for scenario analysis"""

    session_id: str
    message_id: str
    sub_id: str | None = None
    type: str  # "scenario_recommendation" or "scenario_result"


class ScenarioCandidate(BaseModel):
    """A single recommendation/candidate query"""

    sub_id: str
    question: str  # The recommended query
    endpoint: str  # "sqlagent" or "toolagent"


class ScenarioRecommendation(ScenarioMessage):
    """Initial recommendation message with candidates"""

    type: str = "scenario_recommendation"
    recommendations: list[ScenarioCandidate]  # List of candidate queries with endpoints
    query: str


class ScenarioResult(ScenarioMessage):
    """Result from parallel agent call"""

    type: str = "scenario_result"
    agent: str  # "sqlagent" or "toolagent"
    content: str
    is_complete: bool = False
    error: str | None = None


class AgentQuery(BaseModel):
    """Query to be sent to an agent"""

    agent_type: str  # "sqlagent" or "toolagent"
    query: str
    sub_id: str
