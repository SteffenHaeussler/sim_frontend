import asyncio
import os
import uuid
from typing import List

from fastapi import WebSocket
from loguru import logger

from src.app.services.message_formatter import MessageFormatter
from src.app.services.parallel_agent_caller import ParallelAgentCaller
from src.app.services.query_cache import QueryCache
from src.app.services.recommendation_generator import RecommendationGenerator
from src.app.services.scenario_analyzer import ScenarioAnalyzer


class ScenarioService:
    """Orchestrates scenario analysis workflow"""
    
    def __init__(self):
        self.analyzer = ScenarioAnalyzer()
        self.generator = RecommendationGenerator()
        self.formatter = MessageFormatter()
        self.agent_caller = ParallelAgentCaller()
        
        # Initialize cache with configurable TTL
        cache_ttl = int(os.getenv("SCENARIO_CACHE_TTL", "300"))  # 5 minutes default
        self.cache = QueryCache(ttl_seconds=cache_ttl)
        self.use_cache = os.getenv("SCENARIO_USE_CACHE", "true").lower() == "true"
        
        # Store queries for retry functionality
        self.query_store = {}
    
    async def process_scenario(self, query: str, session_id: str, 
                             websocket: WebSocket, user_id: str = None) -> None:
        """Process a scenario analysis request"""
        message_id = f"scenario-{uuid.uuid4()}"
        
        try:
            # Step 1: Analyze the query
            analysis = self.analyzer.analyze(query)
            logger.info(f"Query analysis: {analysis}")
            
            domain = analysis.get("domain", "general")
            
            # Check cache if enabled
            cached_results = None
            if self.use_cache:
                cached_results = self.cache.get(query, domain)
                if cached_results:
                    logger.info(f"Cache hit for query: {query[:50]}...")
            
            # Step 2: Generate recommendations
            recommendations = self.generator.generate(query, analysis)
            recommendation_texts = [rec.query for rec in recommendations]
            
            # Store queries for retry functionality
            self.query_store[message_id] = {
                rec.sub_id: rec.query for rec in recommendations
            }
            
            # Step 3: Send initial recommendation message
            rec_message = self.formatter.format_recommendation(
                session_id=session_id,
                message_id=message_id,
                query=query,
                recommendations=recommendation_texts
            )
            await self._send_websocket_message(websocket, rec_message.model_dump())
            
            # Step 4: Execute parallel agent calls or use cached results
            if cached_results:
                results = cached_results
            else:
                results = await self.agent_caller.call_agents(recommendations, session_id)
                
                # Cache successful results if caching is enabled
                if self.use_cache and self._should_cache_results(results):
                    self.cache.set(query, domain, results)
                    logger.info(f"Cached results for query: {query[:50]}...")
            
            # Step 5: Stream results as they complete
            for sub_id, result in results.items():
                result_message = self.formatter.format_result(
                    session_id=session_id,
                    message_id=message_id,
                    sub_id=sub_id,
                    agent=self._get_agent_type_for_sub_id(recommendations, sub_id),
                    content=result.get("result", ""),
                    is_complete=True,
                    error=result.get("error") if result["status"] == "error" else None
                )
                await self._send_websocket_message(websocket, result_message.model_dump())
                
        except Exception as e:
            logger.error(f"Scenario processing error: {e}")
            # Send error message
            error_message = {
                "session_id": session_id,
                "message_id": message_id,
                "type": "error",
                "error": str(e)
            }
            await self._send_websocket_message(websocket, error_message)
    
    async def _send_websocket_message(self, websocket: WebSocket, message: dict):
        """Send a message via WebSocket"""
        await websocket.send_json(message)
    
    def _get_agent_type_for_sub_id(self, recommendations: List, sub_id: str) -> str:
        """Get agent type for a given sub_id"""
        for rec in recommendations:
            if rec.sub_id == sub_id:
                return rec.agent_type
        return "unknown"
    
    def _should_cache_results(self, results: dict) -> bool:
        """Determine if results should be cached"""
        # Only cache if at least 80% of results are successful
        if not results:
            return False
        
        successful = sum(1 for r in results.values() if r.get("status") == "success")
        success_rate = successful / len(results)
        
        return success_rate >= 0.8
    
    async def retry_agent_call(self, message_id: str, sub_id: str, agent_type: str,
                             session_id: str, websocket: WebSocket, user_id: str = None) -> None:
        """Retry a single failed agent call"""
        try:
            logger.info(f"Retrying agent call - sub_id: {sub_id}, type: {agent_type}")
            
            # Get the original query from store
            original_query = ""
            if message_id in self.query_store and sub_id in self.query_store[message_id]:
                original_query = self.query_store[message_id][sub_id]
            else:
                logger.warning(f"Original query not found for retry: {message_id}/{sub_id}")
                # Send error
                error_message = self.formatter.format_result(
                    session_id=session_id,
                    message_id=message_id,
                    sub_id=sub_id,
                    agent=agent_type,
                    content="",  # Empty content for error
                    is_complete=True,
                    error="Original query not found for retry"
                )
                await self._send_websocket_message(websocket, error_message.model_dump())
                return
            
            # Call the specific agent
            if agent_type == "sqlagent":
                result = await self.agent_caller._call_sql_agent(original_query, session_id)
            elif agent_type == "toolagent":
                result = await self.agent_caller._call_tool_agent(original_query, session_id)
            else:
                result = {"status": "error", "error": f"Unknown agent type: {agent_type}", "result": None}
            
            # Send the result
            result_message = self.formatter.format_result(
                session_id=session_id,
                message_id=message_id,
                sub_id=sub_id,
                agent=agent_type,
                content=result.get("result") or "",  # Ensure content is never None
                is_complete=True,
                error=result.get("error") if result["status"] == "error" else None
            )
            await self._send_websocket_message(websocket, result_message.model_dump())
            
        except Exception as e:
            logger.error(f"Retry error: {e}")
            # Send error message
            error_message = self.formatter.format_result(
                session_id=session_id,
                message_id=message_id,
                sub_id=sub_id,
                agent=agent_type,
                content="",
                is_complete=True,
                error=f"Retry failed: {str(e)}"
            )
            await self._send_websocket_message(websocket, error_message.model_dump())