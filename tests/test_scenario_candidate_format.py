from src.app.core.scenario_schema import ScenarioCandidate
from src.app.services.message_formatter import MessageFormatter


class TestScenarioCandidateFormat:
    """Test the new candidate format with endpoint information"""

    def test_scenario_candidate_structure(self):
        """Test that ScenarioCandidate has the expected fields"""
        candidate = ScenarioCandidate(
            sub_id="sub-1", question="SELECT temperature FROM sensors WHERE asset='DC-101'", endpoint="sqlagent"
        )

        assert candidate.sub_id == "sub-1"
        assert candidate.question == "SELECT temperature FROM sensors WHERE asset='DC-101'"
        assert candidate.endpoint == "sqlagent"

    def test_recommendation_with_candidates(self):
        """Test recommendation message with candidate objects"""
        formatter = MessageFormatter()

        candidates = [
            ScenarioCandidate(
                sub_id="sub-1", question="SELECT temperature, pressure FROM dc101_params", endpoint="sqlagent"
            ),
            ScenarioCandidate(sub_id="sub-2", question="Get real-time sensor data for DC-101", endpoint="toolagent"),
        ]

        message = formatter.format_recommendation(
            session_id="test-session",
            message_id="scenario-123",
            query="What are the critical parameters for DC-101?",
            recommendations=candidates,
        )

        assert message.type == "scenario_recommendation"
        assert message.query == "What are the critical parameters for DC-101?"
        assert len(message.recommendations) == 2

        # Check first candidate
        assert message.recommendations[0].sub_id == "sub-1"
        assert message.recommendations[0].question == "SELECT temperature, pressure FROM dc101_params"
        assert message.recommendations[0].endpoint == "sqlagent"

        # Check second candidate
        assert message.recommendations[1].sub_id == "sub-2"
        assert message.recommendations[1].question == "Get real-time sensor data for DC-101"
        assert message.recommendations[1].endpoint == "toolagent"

    def test_json_serialization(self):
        """Test that the message can be serialized to JSON"""
        formatter = MessageFormatter()

        candidates = [ScenarioCandidate(sub_id="sub-1", question="Test query", endpoint="sqlagent")]

        message = formatter.format_recommendation(
            session_id="test-session", message_id="scenario-123", query="Test question", recommendations=candidates
        )

        # Should be able to convert to dict and back
        json_data = message.model_dump()

        assert json_data["type"] == "scenario_recommendation"
        assert json_data["recommendations"][0]["sub_id"] == "sub-1"
        assert json_data["recommendations"][0]["question"] == "Test query"
        assert json_data["recommendations"][0]["endpoint"] == "sqlagent"
