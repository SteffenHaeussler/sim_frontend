import asyncio
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import WebSocket

from src.app.services.scenario_service import ScenarioService


@pytest.mark.skip(reason="Scenario WebSocket endpoint moved to external agent - frontend connects directly")
@pytest.mark.asyncio
class TestScenarioIntegration:
    """Integration tests for complete scenario flow"""

    async def test_complete_scenario_flow(self):
        """Test the complete scenario analysis flow"""
        # Setup
        service = ScenarioService()
        mock_websocket = AsyncMock(spec=WebSocket)

        query = "What are the critical operations parameters for DC-101?"
        session_id = "test-session-123"

        messages_sent = []

        async def capture_message(message):
            messages_sent.append(message)

        mock_websocket.send_json = capture_message

        # Mock agent calls to return quickly
        with patch.object(service.agent_caller, "call_agents") as mock_calls:
            mock_calls.return_value = {
                "rec-1": {"status": "success", "result": "Temperature: 75°C"},
                "rec-2": {"status": "success", "result": "Pressure: 2.5 bar"},
                "rec-3": {"status": "success", "result": "Flow rate: 150 L/min"},
                "rec-4": {"status": "error", "error": "Connection timeout"},
                "rec-5": {"status": "success", "result": "Level: 85%"},
            }

            # Execute
            await service.process_scenario(query, session_id, mock_websocket)

        # Verify
        assert len(messages_sent) >= 6  # 1 recommendation + 5 results

        # Check recommendation message
        rec_msg = messages_sent[0]
        assert rec_msg["type"] == "scenario_recommendation"
        assert rec_msg["session_id"] == session_id
        assert len(rec_msg["recommendations"]) == 5
        assert rec_msg["query"] == query

        # Check result messages
        result_messages = messages_sent[1:]
        sub_ids_received = set()

        for msg in result_messages:
            assert msg["type"] == "scenario_result"
            assert msg["session_id"] == session_id
            assert msg["is_complete"] is True
            sub_ids_received.add(msg["sub_id"])

            if msg["sub_id"] == "rec-4":
                assert msg["error"] == "Connection timeout"
            else:
                assert msg["content"] != ""

        # Ensure all sub_ids were processed
        assert sub_ids_received == {"rec-1", "rec-2", "rec-3", "rec-4", "rec-5"}

    async def test_scenario_with_websocket_error(self):
        """Test scenario handling when WebSocket fails"""
        service = ScenarioService()
        mock_websocket = AsyncMock(spec=WebSocket)

        # Make WebSocket fail after first message
        call_count = 0

        async def failing_send(message):
            nonlocal call_count
            call_count += 1
            if call_count > 1:
                raise ConnectionError("WebSocket disconnected")

        mock_websocket.send_json = failing_send

        # Should handle error gracefully
        with pytest.raises(ConnectionError):
            await service.process_scenario("Test query", "session-123", mock_websocket)

    async def test_scenario_with_analysis_error(self):
        """Test scenario when analysis fails"""
        service = ScenarioService()
        mock_websocket = AsyncMock(spec=WebSocket)

        messages_sent = []

        async def capture_message(message):
            messages_sent.append(message)

        mock_websocket.send_json = capture_message

        # Mock analyzer to raise error
        with patch.object(service.analyzer, "analyze") as mock_analyze:
            mock_analyze.side_effect = ValueError("Invalid query format")

            await service.process_scenario("Bad query", "session-123", mock_websocket)

        # Should send error message
        assert len(messages_sent) == 1
        assert messages_sent[0]["type"] == "error"
        assert "Invalid query format" in messages_sent[0]["error"]

    async def test_scenario_message_ordering(self):
        """Test that messages maintain correct order"""
        service = ScenarioService()
        mock_websocket = AsyncMock(spec=WebSocket)

        messages_sent = []

        async def capture_message(message):
            messages_sent.append(message)

        mock_websocket.send_json = capture_message

        # Mock agent calls with delays
        async def delayed_calls(queries, session_id):
            results = {}
            for i, query in enumerate(queries):
                # Simulate varying response times
                await asyncio.sleep(0.01 * (5 - i))
                results[query.sub_id] = {"status": "success", "result": f"Result for {query.sub_id}"}
            return results

        with patch.object(service.agent_caller, "call_agents", delayed_calls):
            await service.process_scenario("Test concurrent execution", "session-123", mock_websocket)

        # Verify recommendation comes first
        assert messages_sent[0]["type"] == "scenario_recommendation"

        # Verify all results are sent
        result_sub_ids = [msg["sub_id"] for msg in messages_sent[1:]]
        assert len(result_sub_ids) == 5
        assert all(f"rec-{i}" in result_sub_ids for i in range(1, 6))

    async def test_scenario_with_empty_recommendations(self):
        """Test scenario when no recommendations are generated"""
        service = ScenarioService()
        mock_websocket = AsyncMock(spec=WebSocket)

        messages_sent = []

        async def capture_message(message):
            messages_sent.append(message)

        mock_websocket.send_json = capture_message

        # Mock generator to return empty list
        with patch.object(service.generator, "generate") as mock_generate:
            mock_generate.return_value = []

            await service.process_scenario("Unknown query", "session-123", mock_websocket)

        # Should still send recommendation message
        assert len(messages_sent) >= 1
        assert messages_sent[0]["type"] == "scenario_recommendation"
        assert messages_sent[0]["recommendations"] == []
