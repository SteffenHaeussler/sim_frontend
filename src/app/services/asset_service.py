import threading
import uuid
from typing import Any, Dict, Optional

import httpx
from fastapi import Request
from loguru import logger

from src.app.config import config_service


class AssetService:
    """Service for handling asset-related operations"""

    def __init__(self):
        self.config = config_service

    async def trigger_agent_question(
        self, question: str, session_id: Optional[str] = None, request_id: Optional[str] = None, event_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Handle question from frontend and trigger external agent API"""
        # Use frontend session ID if provided, otherwise generate one
        if not session_id:
            session_id = str(uuid.uuid4())

        # Get external API URL from config
        api_url = self.config.get_agent_api_url()

        logger.info(f"Received question: {question}")
        logger.info(f"Session ID: {session_id}")
        logger.info(f"Request ID: {request_id}")
        logger.info(f"Event ID: {event_id}")
        logger.info(f"Config agent_base: {self.config.agent_base}")
        logger.info(f"Config agent_url: {self.config.agent_url}")
        logger.info(f"Forwarding to: {api_url}")

        # Don't make the request if URL is empty/invalid
        if not api_url or api_url == "":
            logger.error(
                "Agent API URL is empty - check AGENT_BASE and AGENT_URL configuration"
            )
            return {
                "status": "error",
                "message": "Agent API not configured",
                "session_id": session_id,
            }

        def send_request():
            try:
                # Prepare headers for external service
                headers = {}
                if session_id:
                    headers["X-Session-ID"] = session_id
                if request_id:
                    headers["X-Request-ID"] = request_id
                if event_id:
                    headers["X-Event-ID"] = event_id
                
                with httpx.Client() as client:
                    response = client.get(
                        api_url,
                        params={
                            "q_id": session_id,
                            "question": question,
                        },
                        headers=headers,
                        timeout=2,
                    )
                    logger.info(f"External API response: {response.status_code}")
            except Exception as e:
                logger.error(f"External API request failed: {e}")

        # Fire and forget request to external API
        threading.Thread(target=send_request, daemon=True).start()

        return {"status": "triggered", "session_id": session_id, "request_id": request_id, "event_id": event_id, "question": question}

    async def get_asset_info(self, asset_id: str, session_id: str = None, request_id: str = None, event_id: str = None) -> Dict[str, Any]:
        """Get asset information by asset ID"""
        full_url = f"{self.config.get_asset_api_url('asset')}/{asset_id}"

        logger.info(f"Getting asset info for: {asset_id}")
        logger.info(f"Forwarding to: {full_url}")

        try:
            # Prepare headers for external service
            headers = {}
            if session_id:
                headers["X-Session-ID"] = session_id
            if request_id:
                headers["X-Request-ID"] = request_id
            if event_id:
                headers["X-Event-ID"] = event_id
                
            async with httpx.AsyncClient() as client:
                response = await client.get(full_url, headers=headers, timeout=10)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Asset API request failed: {e}")
            return {"error": str(e), "asset_id": asset_id}

    async def get_neighbor_assets(self, asset_id: str, session_id: str = None, request_id: str = None, event_id: str = None) -> Dict[str, Any]:
        """Get neighboring assets by asset ID"""
        full_url = f"{self.config.get_asset_api_url('neighbor')}/{asset_id}"

        logger.info(f"Getting neighbors for: {asset_id}")
        logger.info(f"Forwarding to: {full_url}")

        try:
            # Prepare headers for external service
            headers = {}
            if session_id:
                headers["X-Session-ID"] = session_id
            if request_id:
                headers["X-Request-ID"] = request_id
            if event_id:
                headers["X-Event-ID"] = event_id
                
            async with httpx.AsyncClient() as client:
                response = await client.get(full_url, headers=headers, timeout=10)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Neighbor API request failed: {e}")
            return {"error": str(e), "asset_id": asset_id}

    async def get_name_from_id(self, asset_id: str, session_id: str = None, request_id: str = None, event_id: str = None) -> Dict[str, Any]:
        """Get asset name from asset ID"""
        full_url = f"{self.config.get_asset_api_url('name')}/{asset_id}"

        logger.info(f"Getting name for asset: {asset_id}")
        logger.info(f"Forwarding to: {full_url}")

        try:
            # Prepare headers for external service
            headers = {}
            if session_id:
                headers["X-Session-ID"] = session_id
            if request_id:
                headers["X-Request-ID"] = request_id
            if event_id:
                headers["X-Event-ID"] = event_id
                
            async with httpx.AsyncClient() as client:
                response = await client.get(full_url, headers=headers, timeout=10)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Name API request failed: {e}")
            return {"error": str(e), "asset_id": asset_id}

    async def get_id_from_name(self, name: str, session_id: str = None, request_id: str = None, event_id: str = None) -> Dict[str, Any]:
        """Get asset ID from asset name"""
        full_url = f"{self.config.get_asset_api_url('id')}/{name}"

        logger.info(f"Getting ID for asset name: {name}")
        logger.info(f"Forwarding to: {full_url}")

        try:
            # Prepare headers for external service
            headers = {}
            if session_id:
                headers["X-Session-ID"] = session_id
            if request_id:
                headers["X-Request-ID"] = request_id
            if event_id:
                headers["X-Event-ID"] = event_id
                
            async with httpx.AsyncClient() as client:
                response = await client.get(full_url, headers=headers, timeout=10)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"ID API request failed: {e}")
            return {"error": str(e), "name": name}

    def get_lookup_assets(self, request: Request) -> Dict[str, Any]:
        """Get all lookup assets from application state"""
        try:
            assets = request.app.state.lookup_assets
            return {"assets": assets, "count": len(assets)}
        except Exception as e:
            logger.error(f"Failed to get lookup assets: {e}")
            return {"error": str(e), "assets": [], "count": 0}

    def search_assets(
        self,
        request: Request,
        name: Optional[str] = None,
        asset_type: Optional[str] = None,
        type: Optional[str] = None,
        page: int = 1,
        limit: int = 50,
    ) -> Dict[str, Any]:
        """Search and filter lookup assets with pagination"""
        try:
            assets = request.app.state.lookup_assets
            filtered_assets = assets

            # Filter by name (case-insensitive partial match)
            if name:
                filtered_assets = [
                    asset
                    for asset in filtered_assets
                    if name.lower() in asset.get("name", "").lower()
                ]

            # Filter by asset_type (exact match)
            if asset_type:
                filtered_assets = [
                    asset
                    for asset in filtered_assets
                    if asset.get("asset_type", "").lower() == asset_type.lower()
                ]

            # Filter by type (exact match)
            if type:
                filtered_assets = [
                    asset
                    for asset in filtered_assets
                    if asset.get("type", "").lower() == type.lower()
                ]

            # Calculate pagination
            total_count = len(filtered_assets)
            start_idx = (page - 1) * limit
            end_idx = start_idx + limit
            paginated_assets = filtered_assets[start_idx:end_idx]

            # Get unique asset types and types for filter options
            asset_types = list(set(asset.get("asset_type", "") for asset in assets))
            asset_types = [t for t in asset_types if t]  # Remove empty strings
            asset_types.sort()

            types = list(set(asset.get("type", "") for asset in assets))
            types = [t for t in types if t]  # Remove empty strings
            types.sort()

            return {
                "assets": paginated_assets,
                "total_count": total_count,
                "page": page,
                "limit": limit,
                "total_pages": (total_count + limit - 1) // limit,
                "asset_types": asset_types,
                "types": types,
                "filters": {"name": name, "asset_type": asset_type, "type": type},
            }
        except Exception as e:
            logger.error(f"Failed to search assets: {e}")
            return {"error": str(e), "assets": [], "total_count": 0}
