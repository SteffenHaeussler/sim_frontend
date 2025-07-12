import asyncio

import pytest

from src.app.services.scenario_error_handler import ScenarioErrorHandler


class TestScenarioErrorHandler:
    """Test the scenario error handler functionality"""
    
    def test_handle_agent_timeout_error(self):
        """Test handling of agent timeout errors"""
        handler = ScenarioErrorHandler()
        
        error = TimeoutError("Agent call timed out after 30s")
        result = handler.handle_agent_error("sqlagent", "rec-1", error)
        
        assert result["sub_id"] == "rec-1"
        assert result["agent"] == "sqlagent"
        assert result["is_complete"] is True
        assert result["error"] == "Agent call timed out"
        assert "timed out" in result["content"]
    
    def test_handle_connection_error(self):
        """Test handling of connection errors"""
        handler = ScenarioErrorHandler()
        
        error = ConnectionError("Failed to connect to agent")
        result = handler.handle_agent_error("toolagent", "rec-2", error)
        
        assert result["sub_id"] == "rec-2"
        assert result["agent"] == "toolagent"
        assert result["is_complete"] is True
        assert result["error"] == "Connection failed"
        assert "Unable to connect" in result["content"]
    
    def test_handle_generic_error(self):
        """Test handling of generic errors"""
        handler = ScenarioErrorHandler()
        
        error = Exception("Something went wrong")
        result = handler.handle_agent_error("sqlagent", "rec-3", error)
        
        assert result["sub_id"] == "rec-3"
        assert result["agent"] == "sqlagent"
        assert result["is_complete"] is True
        assert result["error"] == "Unexpected error"
        assert "An error occurred" in result["content"]
    
    def test_format_error_message(self):
        """Test error message formatting"""
        handler = ScenarioErrorHandler()
        
        # Test timeout formatting
        msg = handler.format_error_message("timeout", "sqlagent")
        assert "sqlagent" in msg
        assert "timed out" in msg
        
        # Test connection error formatting
        msg = handler.format_error_message("connection", "toolagent")
        assert "toolagent" in msg
        assert "connect" in msg
        
        # Test generic error formatting
        msg = handler.format_error_message("generic", "sqlagent")
        assert "sqlagent" in msg
        assert "error occurred" in msg
    
    def test_classify_error(self):
        """Test error classification"""
        handler = ScenarioErrorHandler()
        
        # Timeout errors
        assert handler.classify_error(TimeoutError()) == "timeout"
        assert handler.classify_error(asyncio.TimeoutError()) == "timeout"
        
        # Connection errors
        assert handler.classify_error(ConnectionError()) == "connection"
        assert handler.classify_error(ConnectionRefusedError()) == "connection"
        
        # Generic errors
        assert handler.classify_error(ValueError()) == "generic"
        assert handler.classify_error(Exception()) == "generic"
    
    def test_handle_websocket_error(self):
        """Test handling of WebSocket-specific errors"""
        handler = ScenarioErrorHandler()
        
        error_data = {
            "type": "error",
            "message_id": "scenario-001",
            "error": "WebSocket connection lost"
        }
        
        result = handler.handle_websocket_error(error_data)
        
        assert result["type"] == "scenario_error"
        assert result["message_id"] == "scenario-001"
        assert "connection lost" in result["content"]
        assert result["is_critical"] is True