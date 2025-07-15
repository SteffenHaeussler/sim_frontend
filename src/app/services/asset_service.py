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

    def _get_mock_asset_data(self, endpoint: str, param_value: str, request: Request | None = None) -> dict[str, Any]:
        """Get mock asset data when external API is not available

        Args:
            endpoint: The API endpoint (asset, neighbor, name, id)
            param_value: The parameter value to look up
            request: Optional request object to access app state
        """
        # Use lookup assets data if available
        if request and hasattr(request, "app") and hasattr(request.app, "state"):
            lookup_assets = getattr(request.app.state, "lookup_assets", [])
        else:
            # Fallback - try to load directly
            try:
                import json
                from pathlib import Path

                lookup_file = Path(__file__).parent.parent / "data" / "lookup_asset.json"
                if lookup_file.exists():
                    with open(lookup_file) as f:
                        lookup_assets = json.load(f)
                else:
                    lookup_assets = []
            except Exception:
                lookup_assets = []

        if endpoint == "asset":
            # Find asset by ID (using name field as ID for lookup assets)
            for asset in lookup_assets:
                if asset.get("name") == param_value:
                    return {
                        "id": param_value,
                        "name": asset.get("name", param_value),
                        "type": asset.get("type", "unknown"),
                        "asset_type": asset.get("asset_type", "unknown"),
                        "status": "active",
                        "description": f"Asset information for {param_value}",
                    }
            # Not found in lookup assets
            return {
                "id": param_value,
                "name": f"Asset {param_value}",
                "type": "unknown",
                "status": "active",
                "description": f"Mock asset information for {param_value}",
            }
        elif endpoint == "neighbor":
            # Find the index of the current asset
            current_index = -1
            for i, asset in enumerate(lookup_assets):
                if asset.get("name") == param_value:
                    current_index = i
                    break

            # Return neighboring assets based on position
            neighbor_ids = []
            if current_index >= 0:
                # Get immediate neighbors (2 before and 2 after)
                start = max(0, current_index - 2)
                end = min(len(lookup_assets), current_index + 3)

                for i in range(start, end):
                    if i != current_index and lookup_assets[i].get("name"):
                        neighbor_ids.append(lookup_assets[i].get("name"))
            else:
                # If asset not found in lookup data, return some default neighbors
                # This is different for each asset based on hash
                import hashlib

                hash_val = int(hashlib.md5(param_value.encode()).hexdigest()[:8], 16)
                start_idx = hash_val % max(1, len(lookup_assets) - 4)
                for i in range(start_idx, min(start_idx + 4, len(lookup_assets))):
                    if lookup_assets[i].get("name") != param_value:
                        neighbor_ids.append(lookup_assets[i].get("name"))
                        if len(neighbor_ids) >= 4:
                            break

            # Return in the same format as the external API
            return neighbor_ids
        elif endpoint == "name":
            # Return name for given ID
            for asset in lookup_assets:
                if asset.get("name") == param_value:
                    return {
                        "asset_id": param_value,
                        "name": f"Asset {param_value}",
                    }
            return {
                "asset_id": param_value,
                "name": f"Asset Name for {param_value}",
            }
        elif endpoint == "id":
            # Find ID by name match
            for asset in lookup_assets:
                asset_name = asset.get("name", "")
                if param_value.lower() in asset_name.lower():
                    return {
                        "name": param_value,
                        "asset_id": asset_name,
                    }
            # Generate a consistent ID if not found
            return {
                "name": param_value,
                "asset_id": f"asset_{abs(hash(param_value)) % 1000:03d}",
            }
        else:
            return {"error": f"Unknown endpoint: {endpoint}"}

    async def _make_asset_api_call(
        self, endpoint: str, param_name: str, param_value: str, request: Request | None = None
    ) -> dict[str, Any]:
        """Generic method to make asset API calls"""
        url = self.config.get_asset_api_url(endpoint)

        # For neighbor endpoint, replace {id} in URL with actual ID
        if endpoint == "neighbor" and "{id}" in url:
            url = url.replace("{id}", param_value)
            params = None
        else:
            params = {param_name: param_value}

        log_api_call("asset_api", endpoint, **{param_name: param_value})

        try:
            client = http_client_pool.get_client()
            response = await client.get(url, params=params if params else None, timeout=5.0)
            response.raise_for_status()

            # Handle the response
            data = response.json()

            # If it's a list, find the specific item
            if isinstance(data, list) and endpoint == "asset":
                # Find the asset with matching ID or name
                for item in data:
                    if (
                        item.get("id") == param_value
                        or item.get("name") == param_value
                        or item.get("tag") == param_value
                    ):
                        return item
                # If not found, return error
                return {"error": f"Asset {param_value} not found", "status": "not_found"}

            return data
        except (httpx.ConnectError, httpx.TimeoutException) as e:
            # If external API is not available, fall back to mock data
            logger.warning(f"External API not available at {url} ({type(e).__name__}), using mock data")
            return self._get_mock_asset_data(endpoint, param_value, request)
        except httpx.HTTPStatusError as e:
            # For redirect errors (3xx), client errors (4xx) and server errors (5xx), fall back to mock data
            if e.response.status_code >= 300:
                logger.warning(f"External API returned status {e.response.status_code} for {url}, using mock data")
                return self._get_mock_asset_data(endpoint, param_value, request)
            return log_and_return_error(
                e,
                f"Asset API HTTP error for {endpoint}",
                f"Asset API error: {e.response.status_code}",
                details=e.response.text,
            )
        except Exception as e:
            # For any other errors, fall back to mock data
            logger.warning(f"Asset API request failed for {endpoint} ({type(e).__name__}: {str(e)}), using mock data")
            return self._get_mock_asset_data(endpoint, param_value, request)

    async def get_asset_info(self, asset_id: str, request: Request | None = None) -> dict[str, Any]:
        """Get asset information by asset ID"""
        return await self._make_asset_api_call("asset", "asset_id", asset_id, request)

    async def get_neighbor_assets(self, asset_id: str, request: Request | None = None) -> dict[str, Any]:
        """Get neighboring assets by asset ID"""
        return await self._make_asset_api_call("neighbor", "asset_id", asset_id, request)

    async def get_name_from_id(self, asset_id: str, request: Request | None = None) -> dict[str, Any]:
        """Get asset name from asset ID"""
        return await self._make_asset_api_call("name", "asset_id", asset_id, request)

    async def get_id_from_name(self, name: str, request: Request | None = None) -> dict[str, Any]:
        """Get asset ID from asset name"""
        return await self._make_asset_api_call("id", "name", name, request)

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
