import threading
import uuid
from typing import Any

import httpx
from fastapi import Request
from loguru import logger

from src.app.config import config_service
from src.app.context import ctx_session_id
from src.app.services.http_client import http_client_pool
from src.app.utils.constants import DEFAULT_PAGE_SIZE, FIRE_AND_FORGET_TIMEOUT, HEADERS_TO_FORWARD
from src.app.utils.error_handlers import log_and_return_error
from src.app.utils.logging_utils import ServiceLogger, log_api_call, log_config_value
from src.app.utils.response_models import error_response, trigger_response


class AssetService:
    """Service for handling asset-related operations"""

    # Headers are defined in constants module

    def __init__(self):
        self.config = config_service

    def _get_or_create_session_id(self) -> str:
        """Get session ID from context or create a new one"""
        session_id = ctx_session_id.get()
        if session_id == "-" or not session_id:
            session_id = str(uuid.uuid4())
        return session_id

    def _extract_headers(self, request: Request) -> dict[str, str]:
        """Extract headers to forward from the incoming request"""
        headers_to_forward = {}
        if request.headers:
            for header_name in HEADERS_TO_FORWARD:
                if header_name in request.headers:
                    headers_to_forward[header_name] = request.headers[header_name]
        return headers_to_forward

    async def _trigger_agent_generic(
        self,
        question: str,
        request: Request,
        api_url: str,
        agent_type: str,
        config_url_name: str,
    ) -> dict[str, Any]:
        """Generic method to trigger any agent API"""
        session_id = self._get_or_create_session_id()

        ServiceLogger.log_request(session_id, question, agent_type)
        log_config_value("agent_base", self.config.agent_base, sensitive=True)
        log_config_value(config_url_name, getattr(self.config, config_url_name, "N/A"))
        ServiceLogger.log_forward(api_url)

        # Don't make the request if URL is empty/invalid
        if not api_url or api_url == "":
            logger.error(f"{agent_type} API URL is empty - check AGENT_BASE and {config_url_name} configuration")
            return error_response(f"{agent_type} API not configured", session_id=session_id)

        def send_request():
            try:
                headers_to_forward = self._extract_headers(request)
                ServiceLogger.log_forward(api_url, headers_to_forward)

                # Using sync client for fire-and-forget pattern
                # TODO: Consider converting to async with proper task management
                with httpx.Client() as client:
                    response = client.get(
                        api_url,
                        params={
                            "q_id": session_id,
                            "question": question,
                        },
                        headers=headers_to_forward,
                        timeout=FIRE_AND_FORGET_TIMEOUT,
                    )
                    logger.info(f"External API response: {response.status_code}")
            except Exception as e:
                logger.error(f"External API request failed: {e}")

        # Fire and forget request to external API
        threading.Thread(target=send_request, daemon=True).start()

        return trigger_response(session_id, question)

    async def trigger_agent_question(self, question: str, request: Request) -> dict[str, Any]:
        """Handle question from frontend and trigger external agent API"""
        return await self._trigger_agent_generic(
            question=question,
            request=request,
            api_url=self.config.get_agent_api_url(),
            agent_type="Agent",
            config_url_name="agent_url",
        )

    async def trigger_sql_agent_question(self, question: str, request: Request) -> dict[str, Any]:
        """Handle question from frontend and trigger external SQL agent API"""
        return await self._trigger_agent_generic(
            question=question,
            request=request,
            api_url=self.config.get_sql_agent_api_url(),
            agent_type="SQL Agent",
            config_url_name="agent_sql_url",
        )

    async def trigger_scenario_question(self, question: str, request: Request) -> dict[str, Any]:
        """Handle question from frontend and trigger external scenario agent API"""
        return await self._trigger_agent_generic(
            question=question,
            request=request,
            api_url=self.config.get_scenario_agent_api_url(),
            agent_type="Scenario Agent",
            config_url_name="agent_scenario_url",
        )

    async def _make_asset_api_call(self, endpoint: str, param_name: str, param_value: str) -> dict[str, Any]:
        """Generic method to make asset API calls"""
        url = self.config.get_asset_api_url(endpoint)
        log_api_call("asset_api", endpoint, **{param_name: param_value})

        try:
            client = http_client_pool.get_client()
            response = await client.get(url, params={param_name: param_value})
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            return log_and_return_error(
                e,
                f"Asset API HTTP error for {endpoint}",
                f"Asset API error: {e.response.status_code}",
                details=e.response.text,
            )
        except Exception as e:
            return log_and_return_error(e, f"Asset API request failed for {endpoint}", f"Failed to get {endpoint} info")

    async def get_asset_info(self, asset_id: str) -> dict[str, Any]:
        """Get asset information by asset ID"""
        return await self._make_asset_api_call("asset", "asset_id", asset_id)

    async def get_neighbor_assets(self, asset_id: str) -> dict[str, Any]:
        """Get neighboring assets by asset ID"""
        return await self._make_asset_api_call("neighbor", "asset_id", asset_id)

    async def get_name_from_id(self, asset_id: str) -> dict[str, Any]:
        """Get asset name from asset ID"""
        return await self._make_asset_api_call("name", "asset_id", asset_id)

    async def get_id_from_name(self, name: str) -> dict[str, Any]:
        """Get asset ID from asset name"""
        return await self._make_asset_api_call("id", "name", name)

    def get_lookup_assets(self, request: Request) -> list[dict]:
        """Get all lookup assets from application state"""
        return request.app.state.lookup_assets or []

    def search_assets(
        self,
        request: Request,
        name: str | None = None,
        asset_type: str | None = None,
        type: str | None = None,
        page: int = 1,
        limit: int = DEFAULT_PAGE_SIZE,
    ) -> dict[str, Any]:
        """Search and filter lookup assets with pagination"""
        assets = self.get_lookup_assets(request)

        # Apply filters
        filtered_assets = assets
        if name:
            filtered_assets = [a for a in filtered_assets if name.lower() in a.get("name", "").lower()]
        if asset_type:
            filtered_assets = [a for a in filtered_assets if a.get("asset_type", "").lower() == asset_type.lower()]
        if type:
            filtered_assets = [a for a in filtered_assets if a.get("type", "").lower() == type.lower()]

        # Pagination
        total = len(filtered_assets)
        start = (page - 1) * limit
        end = start + limit
        paginated_assets = filtered_assets[start:end]

        # Extract unique asset_types and types from all filtered assets
        asset_types = list({a.get("asset_type", "") for a in filtered_assets if a.get("asset_type")})
        types = list({a.get("type", "") for a in filtered_assets if a.get("type")})

        total_pages = (total + limit - 1) // limit if limit > 0 else 0

        return {
            "assets": paginated_assets,
            "total": total,
            "total_count": total,  # For backward compatibility
            "page": page,
            "limit": limit,
            "pages": total_pages,
            "total_pages": total_pages,  # For backward compatibility
            "asset_types": sorted(asset_types),
            "types": sorted(types),
        }
