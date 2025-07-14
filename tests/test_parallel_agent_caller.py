import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from src.app.core.scenario_schema import AgentQuery
from src.app.services.parallel_agent_caller import ParallelAgentCaller


class TestParallelAgentCaller:
    """Test parallel agent caller functionality"""

    @pytest.mark.asyncio
    async def test_call_multiple_agents_success(self):
        """Test successful parallel calls to multiple agents"""
        caller = ParallelAgentCaller()

        queries = [
            AgentQuery(agent_type="sqlagent", query="Query 1", sub_id="rec-1"),
            AgentQuery(agent_type="toolagent", query="Query 2", sub_id="rec-2"),
            AgentQuery(agent_type="sqlagent", query="Query 3", sub_id="rec-3"),
        ]

        # Mock the agent calls
        with (
            patch.object(caller, "_call_sql_agent", new_callable=AsyncMock) as mock_sql,
            patch.object(caller, "_call_tool_agent", new_callable=AsyncMock) as mock_tool,
        ):
            mock_sql.return_value = {"result": "SQL result", "status": "success"}
            mock_tool.return_value = {"result": "Tool result", "status": "success"}

            results = await caller.call_agents(queries, "test-session")

            assert len(results) == 3
            assert mock_sql.call_count == 2  # Two SQL queries
            assert mock_tool.call_count == 1  # One tool query

            # Check results are mapped correctly
            assert results["rec-1"]["result"] == "SQL result"
            assert results["rec-2"]["result"] == "Tool result"
            assert results["rec-3"]["result"] == "SQL result"

    @pytest.mark.asyncio
    async def test_handle_agent_failures(self):
        """Test handling failures in agent calls"""
        caller = ParallelAgentCaller()

        queries = [
            AgentQuery(agent_type="sqlagent", query="Query 1", sub_id="rec-1"),
            AgentQuery(agent_type="toolagent", query="Query 2", sub_id="rec-2"),
        ]

        with (
            patch.object(caller, "_call_sql_agent", new_callable=AsyncMock) as mock_sql,
            patch.object(caller, "_call_tool_agent", new_callable=AsyncMock) as mock_tool,
        ):
            # SQL succeeds, tool fails
            mock_sql.return_value = {"result": "SQL result", "status": "success"}
            mock_tool.side_effect = Exception("Connection error")

            results = await caller.call_agents(queries, "test-session")

            assert len(results) == 2
            assert results["rec-1"]["status"] == "success"
            assert results["rec-2"]["status"] == "error"
            assert "Connection error" in results["rec-2"]["error"]

    @pytest.mark.asyncio
    async def test_concurrent_execution(self):
        """Test that agents are called concurrently, not sequentially"""
        caller = ParallelAgentCaller()

        queries = [
            AgentQuery(agent_type="sqlagent", query="Query 1", sub_id="rec-1"),
            AgentQuery(agent_type="sqlagent", query="Query 2", sub_id="rec-2"),
            AgentQuery(agent_type="sqlagent", query="Query 3", sub_id="rec-3"),
        ]

        call_times = []

        async def mock_slow_call(query, session_id):
            call_times.append(asyncio.get_event_loop().time())
            await asyncio.sleep(0.1)  # Simulate slow call
            return {"result": f"Result for {query}", "status": "success"}

        with patch.object(caller, "_call_sql_agent", side_effect=mock_slow_call):
            start_time = asyncio.get_event_loop().time()
            results = await caller.call_agents(queries, "test-session")
            end_time = asyncio.get_event_loop().time()

            # If executed sequentially, would take ~0.3s
            # If concurrent, should take ~0.1s
            total_time = end_time - start_time
            assert total_time < 0.2  # Allow some overhead
            assert len(results) == 3

    @pytest.mark.asyncio
    async def test_empty_queries_list(self):
        """Test handling empty queries list"""
        caller = ParallelAgentCaller()
        results = await caller.call_agents([], "test-session")
        assert results == {}

    @pytest.mark.asyncio
    async def test_timeout_handling(self):
        """Test handling timeouts for slow agents"""
        caller = ParallelAgentCaller()

        queries = [
            AgentQuery(agent_type="sqlagent", query="Query 1", sub_id="rec-1"),
        ]

        async def mock_timeout_call(query, session_id):
            # Simulate timeout by raising TimeoutError
            raise TimeoutError("Request timed out")

        with patch.object(caller, "_call_sql_agent", side_effect=mock_timeout_call):
            results = await caller.call_agents(queries, "test-session")

            # The timeout error should be caught and handled
            assert results["rec-1"]["status"] == "error"
            assert "timed out" in results["rec-1"]["error"].lower()
