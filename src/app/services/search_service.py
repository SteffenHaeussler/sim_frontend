from typing import Any, Dict

import httpx
from loguru import logger

from src.app.config import config_service
from src.app.core.schema import SemanticRequest


class SearchService:
    """Service for handling semantic search operations"""

    def __init__(self):
        self.config = config_service

    async def perform_semantic_search(self, request: SemanticRequest) -> Dict[str, Any]:
        """
        Perform semantic search with embedding → search → ranking pipeline
        """
        if not self.config.semantic_base:
            logger.error("semantic_base environment variable not set")
            return {"error": "Semantic service not configured", "step": "config"}

        logger.info(f"Starting semantic search for query: {request.query}")

        try:
            async with httpx.AsyncClient() as client:
                # Step 1: Get embedding for the query
                embedding_data = await self._get_embedding(client, request.query)

                # Step 2: Perform search using embedding
                search_data = await self._perform_search(client, embedding_data)

                # Step 3: Rank the search results
                ranked_result = await self._rank_results(
                    client, request.query, search_data
                )

                return ranked_result

        except httpx.HTTPStatusError as e:
            logger.error(
                f"Semantic API HTTP error: {e.response.status_code} - {e.response.text}"
            )
            return {
                "error": f"Semantic API error: {e.response.status_code}",
                "details": e.response.text,
                "step": "api_call",
            }
        except httpx.TimeoutException as e:
            logger.error(f"Semantic API timeout: {e}")
            return {"error": "Semantic API timeout", "step": "timeout"}
        except Exception as e:
            logger.error(f"Semantic search failed: {e}")
            return {"error": str(e), "step": "unknown"}

    async def _get_embedding(
        self, client: httpx.AsyncClient, query: str
    ) -> Dict[str, Any]:
        """Get embedding for the query"""
        embedding_endpoint = self.config.get_semantic_api_url("embedding")

        logger.info(f"Step 1: Getting embedding from {embedding_endpoint}")

        emb_response = await client.get(
            embedding_endpoint, params={"text": query}, timeout=30
        )
        emb_response.raise_for_status()
        embedding_data = emb_response.json()

        logger.info("Step 1: Embedding completed successfully")
        return embedding_data

    async def _perform_search(
        self, client: httpx.AsyncClient, embedding_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Perform search using embedding"""
        search_endpoint = self.config.get_semantic_api_url("search")
        logger.info(f"Step 2: Performing search at {search_endpoint}")

        search_payload = {
            "embedding": embedding_data.get("embedding"),
            "n_items": 10,  # Default value
            "table": self.config.semantic_table,
        }

        search_response = await client.post(
            search_endpoint, json=search_payload, timeout=30
        )
        search_response.raise_for_status()
        search_data = search_response.json()

        logger.info(
            f"Step 2: Search completed, found {len(search_data.get('results', []))} results"
        )
        return search_data

    async def _rank_results(
        self, client: httpx.AsyncClient, query: str, search_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Rank the search results"""
        rank_endpoint = self.config.get_semantic_api_url("ranking")
        logger.info(f"Step 3: Ranking results at {rank_endpoint}")

        candidates = []

        for candidate in search_data.get("results", []):
            rank_payload = {
                "question": query,
                "text": candidate["description"],
            }

            rank_response = await client.get(
                rank_endpoint, params=rank_payload, timeout=30
            )
            rank_response.raise_for_status()
            rank_data = rank_response.json()

            candidate["score"] = rank_data.get("score")
            candidate["question"] = rank_data.get("question")

            candidates.append(candidate)

        logger.info("Step 3: Ranking completed, returning best result")

        candidates = sorted(
            candidates, key=lambda x: getattr(x, "score", 0), reverse=True
        )

        # Return the final ranked results with metadata
        return candidates[0] if candidates else {"error": "No results found"}
