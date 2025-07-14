import pytest
from pydantic import ValidationError

from src.app.core.scenario_websocket_schema import ScenarioQueryMessage


class TestScenarioValidation:
    """Test input validation for scenario WebSocket messages"""

    def test_valid_message(self):
        """Test that valid messages pass validation"""
        message = ScenarioQueryMessage(
            type="query", query="What are the critical parameters for DC-101?", message_id="scenario-123-abc"
        )

        assert message.query == "What are the critical parameters for DC-101?"
        assert message.message_id == "scenario-123-abc"

    def test_empty_query_rejected(self):
        """Test that empty queries are rejected"""
        with pytest.raises(ValidationError) as exc_info:
            ScenarioQueryMessage(type="query", query="", message_id="scenario-123")

        errors = exc_info.value.errors()
        assert any("at least 1 character" in str(e) for e in errors)

    def test_whitespace_only_query_rejected(self):
        """Test that whitespace-only queries are rejected"""
        with pytest.raises(ValidationError) as exc_info:
            ScenarioQueryMessage(type="query", query="   \t\n   ", message_id="scenario-123")

        errors = exc_info.value.errors()
        assert any("Query cannot be empty" in str(e) for e in errors)

    def test_long_query_rejected(self):
        """Test that queries over 1000 chars are rejected"""
        with pytest.raises(ValidationError) as exc_info:
            ScenarioQueryMessage(type="query", query="x" * 1001, message_id="scenario-123")

        errors = exc_info.value.errors()
        assert any("at most 1000 characters" in str(e) for e in errors)

    def test_missing_message_id_rejected(self):
        """Test that missing message_id is rejected"""
        with pytest.raises(ValidationError) as exc_info:
            ScenarioQueryMessage(
                type="query",
                query="Valid query",
                # message_id missing
            )

        errors = exc_info.value.errors()
        assert any("message_id" in str(e) for e in errors)

    def test_script_tag_rejected(self):
        """Test that script tags are rejected"""
        with pytest.raises(ValidationError) as exc_info:
            ScenarioQueryMessage(
                type="query", query="What is <script>alert('XSS')</script> the temperature?", message_id="scenario-123"
            )

        errors = exc_info.value.errors()
        assert any("dangerous content" in str(e) for e in errors)

    def test_javascript_url_rejected(self):
        """Test that javascript: URLs are rejected"""
        with pytest.raises(ValidationError) as exc_info:
            ScenarioQueryMessage(type="query", query="Check this javascript:alert('XSS')", message_id="scenario-123")

        errors = exc_info.value.errors()
        assert any("dangerous content" in str(e) for e in errors)

    def test_event_handler_rejected(self):
        """Test that event handlers are rejected"""
        with pytest.raises(ValidationError) as exc_info:
            ScenarioQueryMessage(
                type="query", query="What is the onerror=alert('XSS') value?", message_id="scenario-123"
            )

        errors = exc_info.value.errors()
        assert any("dangerous content" in str(e) for e in errors)

    def test_invalid_message_id_format(self):
        """Test that invalid message_id formats are rejected"""
        with pytest.raises(ValidationError) as exc_info:
            ScenarioQueryMessage(type="query", query="Valid query", message_id="scenario@123#invalid")

        errors = exc_info.value.errors()
        assert any("Invalid message_id format" in str(e) for e in errors)

    def test_valid_message_id_formats(self):
        """Test various valid message_id formats"""
        valid_ids = ["scenario-123-abc", "scenario_123_ABC", "SCENARIO-123", "123-456-789", "test_message_123"]

        for msg_id in valid_ids:
            message = ScenarioQueryMessage(type="query", query="Test query", message_id=msg_id)
            assert message.message_id == msg_id

    def test_query_sanitization(self):
        """Test that queries are properly sanitized"""
        message = ScenarioQueryMessage(type="query", query="  What is the temperature?  \n", message_id="scenario-123")

        # Should be trimmed
        assert message.query == "What is the temperature?"
