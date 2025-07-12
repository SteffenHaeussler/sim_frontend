import asyncio
from typing import Any, Dict


class ScenarioErrorHandler:
    """Handles errors in scenario analysis pipeline"""
    
    def handle_agent_error(self, agent_type: str, sub_id: str, error: Exception) -> Dict[str, Any]:
        """Handle errors from agent calls"""
        error_type = self.classify_error(error)
        
        return {
            "sub_id": sub_id,
            "agent": agent_type,
            "is_complete": True,
            "error": self._get_error_summary(error_type),
            "content": self.format_error_message(error_type, agent_type)
        }
    
    def classify_error(self, error: Exception) -> str:
        """Classify the type of error"""
        if isinstance(error, (TimeoutError, asyncio.TimeoutError)):
            return "timeout"
        elif isinstance(error, (ConnectionError, ConnectionRefusedError)):
            return "connection"
        else:
            return "generic"
    
    def _get_error_summary(self, error_type: str) -> str:
        """Get a short error summary"""
        summaries = {
            "timeout": "Agent call timed out",
            "connection": "Connection failed",
            "generic": "Unexpected error"
        }
        return summaries.get(error_type, "Unknown error")
    
    def format_error_message(self, error_type: str, agent_type: str) -> str:
        """Format error message for display"""
        messages = {
            "timeout": f"The {agent_type} call timed out. Please try again later.",
            "connection": f"Unable to connect to {agent_type}. Please check the service status.",
            "generic": f"An error occurred while calling {agent_type}. Please try again."
        }
        return messages.get(error_type, f"Unknown error in {agent_type}")
    
    def handle_websocket_error(self, error_data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle WebSocket-specific errors"""
        return {
            "type": "scenario_error",
            "message_id": error_data.get("message_id"),
            "content": f"WebSocket error: {error_data.get('error', 'Unknown error')}",
            "is_critical": self._is_critical_error(error_data.get("error", ""))
        }
    
    def _is_critical_error(self, error_message: str) -> bool:
        """Determine if error is critical"""
        critical_keywords = ["connection lost", "disconnected", "closed"]
        return any(keyword in error_message.lower() for keyword in critical_keywords)