from src.app.core.scenario_schema import ScenarioCandidate, ScenarioRecommendation, ScenarioResult
from src.app.services.message_formatter import MessageFormatter


class TestMessageFormatter:
    """Test message formatter functionality"""

    def test_format_recommendation_message(self):
        """Test formatting initial recommendation message"""
        formatter = MessageFormatter()

        recommendations = [
            ScenarioCandidate(sub_id="sub-1", question="Check temperature trends for DC-101", endpoint="sqlagent"),
            ScenarioCandidate(sub_id="sub-2", question="Analyze pressure patterns", endpoint="toolagent"),
            ScenarioCandidate(sub_id="sub-3", question="Review historical alarms", endpoint="sqlagent"),
            ScenarioCandidate(sub_id="sub-4", question="Compare with similar units", endpoint="toolagent"),
            ScenarioCandidate(sub_id="sub-5", question="Generate performance report", endpoint="sqlagent"),
        ]

        message = formatter.format_recommendation(
            session_id="test-session",
            message_id="scenario-001",
            query="Analyze distillation column",
            recommendations=recommendations,
        )

        assert isinstance(message, ScenarioRecommendation)
        assert message.session_id == "test-session"
        assert message.message_id == "scenario-001"
        assert message.sub_id is None
        assert message.type == "scenario_recommendation"
        assert len(message.recommendations) == 5
        assert message.query == "Analyze distillation column"
        assert message.recommendations[0].sub_id == "sub-1"
        assert message.recommendations[0].question == "Check temperature trends for DC-101"
        assert message.recommendations[0].endpoint == "sqlagent"

    def test_format_result_message(self):
        """Test formatting agent result message"""
        formatter = MessageFormatter()

        message = formatter.format_result(
            session_id="test-session",
            message_id="scenario-001",
            sub_id="rec-1",
            agent="sqlagent",
            content="Temperature data shows normal patterns",
            is_complete=True,
        )

        assert isinstance(message, ScenarioResult)
        assert message.session_id == "test-session"
        assert message.message_id == "scenario-001"
        assert message.sub_id == "rec-1"
        assert message.type == "scenario_result"
        assert message.agent == "sqlagent"
        assert message.content == "Temperature data shows normal patterns"
        assert message.is_complete is True
        assert message.error is None

    def test_format_error_result(self):
        """Test formatting error result message"""
        formatter = MessageFormatter()

        message = formatter.format_result(
            session_id="test-session",
            message_id="scenario-001",
            sub_id="rec-2",
            agent="toolagent",
            content="",
            is_complete=True,
            error="Connection timeout",
        )

        assert isinstance(message, ScenarioResult)
        assert message.error == "Connection timeout"
        assert message.is_complete is True
        assert message.content == ""

    def test_format_partial_result(self):
        """Test formatting partial streaming result"""
        formatter = MessageFormatter()

        message = formatter.format_result(
            session_id="test-session",
            message_id="scenario-001",
            sub_id="rec-3",
            agent="sqlagent",
            content="Analyzing data...",
            is_complete=False,
        )

        assert message.is_complete is False
        assert message.content == "Analyzing data..."

    def test_message_serialization(self):
        """Test that messages can be serialized to dict/JSON"""
        formatter = MessageFormatter()

        # Test recommendation message
        rec_message = formatter.format_recommendation(
            session_id="test-session",
            message_id="scenario-001",
            query="Test query",
            recommendations=[
                ScenarioCandidate(sub_id="sub-1", question="Rec 1", endpoint="sqlagent"),
                ScenarioCandidate(sub_id="sub-2", question="Rec 2", endpoint="toolagent"),
            ],
        )

        rec_dict = rec_message.model_dump()
        assert rec_dict["type"] == "scenario_recommendation"
        assert "recommendations" in rec_dict

        # Test result message
        result_message = formatter.format_result(
            session_id="test-session",
            message_id="scenario-001",
            sub_id="rec-1",
            agent="sqlagent",
            content="Result content",
            is_complete=True,
        )

        result_dict = result_message.model_dump()
        assert result_dict["type"] == "scenario_result"
        assert result_dict["agent"] == "sqlagent"
