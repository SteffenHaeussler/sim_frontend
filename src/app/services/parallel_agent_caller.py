import asyncio
import os

import httpx
from loguru import logger

from src.app.config import config_service
from src.app.core.scenario_schema import AgentQuery
from src.app.services.http_client import http_client_pool
from src.app.services.query_cache import QueryCache
from src.app.utils.constants import HTTP_OK
from src.app.utils.error_handlers import create_error_response
from src.app.utils.logging_utils import log_api_call, log_api_response, log_cache_hit, log_retry


class ParallelAgentCaller:
    """Calls multiple agents in parallel"""

    def __init__(self):
        self.config = config_service

        # Configurable timeouts with defaults
        self.sql_agent_timeout = float(os.getenv("SQL_AGENT_TIMEOUT", "30"))
        self.tool_agent_timeout = float(os.getenv("TOOL_AGENT_TIMEOUT", "60"))
        self.default_timeout = float(os.getenv("DEFAULT_AGENT_TIMEOUT", "30"))

        # Retry configuration
        self.max_retries = int(os.getenv("AGENT_MAX_RETRIES", "3"))
        self.retry_delay = float(os.getenv("AGENT_RETRY_DELAY", "1"))  # seconds

        # Initialize cache with 5 minute TTL
        self.cache = QueryCache(ttl_seconds=300)

    async def call_agents(self, queries: list[dict | AgentQuery], session_id: str) -> dict:
        """Call multiple agents in parallel"""
        if not queries:
            return {}

        # Create tasks for each query
        tasks = []
        for query in queries:
            # Handle both dict and AgentQuery objects
            if isinstance(query, dict):
                agent_type = query.get("agent_type", "")
                query_text = query.get("query", "")
                sub_id = query.get("sub_id", "")
            else:  # AgentQuery object
                agent_type = query.agent_type
                query_text = query.query
                sub_id = query.sub_id

            if agent_type == "sqlagent":
                task = self._call_sql_agent(query_text, session_id)
            elif agent_type == "toolagent":
                task = self._call_tool_agent(query_text, session_id)
            else:
                # Unknown agent type
                task = self._create_error_result(f"Unknown agent type: {agent_type}")

            tasks.append((sub_id, task))

        # Execute all tasks concurrently
        results = {}
        sub_ids_and_tasks = list(tasks)

        # Use asyncio.gather with return_exceptions=True to handle failures
        task_results = await asyncio.gather(*[task for _, task in sub_ids_and_tasks], return_exceptions=True)

        # Map results back to sub_ids
        for (sub_id, _), result in zip(sub_ids_and_tasks, task_results, strict=True):
            if isinstance(result, Exception):
                results[sub_id] = create_error_response(str(result), result=None)
            else:
                results[sub_id] = result

        return results

    async def _retry_on_failure(self, func, *args, **kwargs) -> dict:
        """Retry a function call on failure with exponential backoff"""
        last_error = None

        for attempt in range(self.max_retries):
            try:
                result = await func(*args, **kwargs)

                # If successful or error is not retryable, return
                if result["status"] == "success" or attempt == self.max_retries - 1:
                    return result

                # Check if error is retryable
                error = result.get("error", "")
                if "timed out" in error or "connect" in error.lower():
                    # Retryable error - wait before retry
                    delay = self.retry_delay * (2**attempt)  # Exponential backoff
                    log_retry(attempt + 1, self.max_retries, delay, error)
                    await asyncio.sleep(delay)
                    last_error = error
                else:
                    # Non-retryable error
                    return result

            except Exception as e:
                last_error = str(e)
                if attempt < self.max_retries - 1:
                    delay = self.retry_delay * (2**attempt)
                    await asyncio.sleep(delay)
                else:
                    logger.error(f"All retry attempts failed: {last_error}")
                    return create_error_response(last_error, result=None)

        return create_error_response(f"Failed after {self.max_retries} attempts: {last_error}", result=None)

    async def _call_sql_agent(self, query: str, session_id: str) -> dict:
        """Call SQL agent with timeout and retry"""
        return await self._retry_on_failure(self._call_sql_agent_once, query, session_id)

    async def _call_sql_agent_once(self, query: str, session_id: str) -> dict:
        """Single SQL agent call attempt"""
        # Check cache first
        cached_result = self.cache.get(query, "sql_agent")
        if cached_result:
            log_cache_hit("SQL agent", query)
            return cached_result

        try:
            client = http_client_pool.get_client()
            # Use the real SQL agent endpoint
            url = self.config.get_sql_agent_api_url()
            log_api_call("SQL agent", url, q_id=session_id, question=query)

            response = await client.get(
                url,
                params={"q_id": session_id, "question": query},
                headers={"Content-Type": "application/json", "Accept": "application/json"},
                timeout=self.sql_agent_timeout,
            )

            if response.status_code == HTTP_OK:
                result = {"result": response.text, "status": "success"}
                # Cache successful results
                self.cache.set(query, "sql_agent", result)
                return result
            else:
                log_api_response("SQL agent", response.status_code)
                return create_error_response(f"Agent returned status {response.status_code}", result=None)

        except TimeoutError:
            return create_error_response("Request timed out", result=None)
        except httpx.ConnectError:
            return create_error_response("Failed to connect to SQL agent", result=None)
        except Exception as e:
            logger.error(f"SQL agent call failed: {e}")
            return create_error_response(str(e), result=None)

    async def _call_tool_agent(self, query: str, session_id: str) -> dict:
        """Call tool agent with timeout and retry"""
        return await self._retry_on_failure(self._call_tool_agent_once, query, session_id)

    async def _call_tool_agent_once(self, query: str, session_id: str) -> dict:
        """Single tool agent call attempt"""
        # Check cache first
        cached_result = self.cache.get(query, "tool_agent")
        if cached_result:
            log_cache_hit("tool agent", query)
            return cached_result

        try:
            client = http_client_pool.get_client()
            # Use the general agent endpoint for tool agent
            # This assumes the backend routes to appropriate tool based on query
            url = self.config.get_agent_api_url()
            log_api_call("tool agent", url, q_id=session_id, question=query)

            response = await client.get(
                url,
                params={"q_id": session_id, "question": query},
                headers={"Content-Type": "application/json", "Accept": "application/json"},
                timeout=self.tool_agent_timeout,
            )

            if response.status_code == HTTP_OK:
                result = {"result": response.text, "status": "success"}
                # Cache successful results
                self.cache.set(query, "tool_agent", result)
                return result
            else:
                log_api_response("tool agent", response.status_code)
                return create_error_response(f"Agent returned status {response.status_code}", result=None)

        except TimeoutError:
            return create_error_response("Request timed out", result=None)
        except httpx.ConnectError:
            return create_error_response("Failed to connect to tool agent", result=None)
        except Exception as e:
            logger.error(f"Tool agent call failed: {e}")
            return create_error_response(str(e), result=None)

    async def _create_error_result(self, error_message: str) -> dict:
        """Create an error result"""
        return create_error_response(error_message, result=None)
