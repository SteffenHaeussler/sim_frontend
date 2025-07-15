"""Common error handling utilities for the application"""

from collections.abc import Callable
from typing import Any

import httpx
from loguru import logger


def handle_http_errors(service_name: str, default_error_msg: str = "API request failed") -> Callable:
    """Decorator factory to handle common HTTP errors"""

    def decorator(func: Callable) -> Callable:
        async def wrapper(*args, **kwargs) -> dict[str, Any]:
            try:
                return await func(*args, **kwargs)
            except httpx.HTTPStatusError as e:
                logger.error(f"{service_name} HTTP error: {e.response.status_code} - {e.response.text}")
                return {
                    "error": f"{service_name} error: {e.response.status_code}",
                    "status": "error",
                    "details": e.response.text,
                }
            except httpx.TimeoutException as e:
                logger.error(f"{service_name} timeout: {e}")
                return {"error": f"{service_name} timeout", "status": "error"}
            except httpx.ConnectError as e:
                logger.error(f"Failed to connect to {service_name}: {e}")
                return {"error": f"Failed to connect to {service_name}", "status": "error"}
            except Exception as e:
                logger.error(f"{service_name} request failed: {e}")
                return {"error": default_error_msg, "status": "error"}

        return wrapper

    return decorator


def create_error_response(error_msg: str, status: str = "error", **extra_fields) -> dict[str, Any]:
    """Create a standardized error response"""
    response = {"status": status, "error": error_msg}
    response.update(extra_fields)
    return response


def log_and_return_error(error: Exception, context: str, default_msg: str, **extra_fields) -> dict[str, Any]:
    """Log an error and return standardized error response"""
    logger.error(f"{context}: {error}")
    return create_error_response(default_msg, **extra_fields)
