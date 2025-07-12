from typing import List, Optional

from src.app.core.scenario_schema import ScenarioRecommendation, ScenarioResult


class MessageFormatter:
    """Formats messages for scenario analysis"""
    
    def format_recommendation(self, session_id: str, message_id: str, 
                            query: str, recommendations: List[str]) -> ScenarioRecommendation:
        """Format initial recommendation message"""
        return ScenarioRecommendation(
            session_id=session_id,
            message_id=message_id,
            sub_id=None,
            type="scenario_recommendation",
            recommendations=recommendations,
            query=query
        )
    
    def format_result(self, session_id: str, message_id: str, sub_id: str,
                     agent: str, content: str, is_complete: bool, 
                     error: Optional[str] = None) -> ScenarioResult:
        """Format agent result message"""
        return ScenarioResult(
            session_id=session_id,
            message_id=message_id,
            sub_id=sub_id,
            type="scenario_result",
            agent=agent,
            content=content,
            is_complete=is_complete,
            error=error
        )