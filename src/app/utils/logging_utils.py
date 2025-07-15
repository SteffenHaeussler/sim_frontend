"""Consolidated logging utilities for consistent logging patterns"""

import time
from functools import wraps
from typing import Any

from loguru import logger


class LogContext:
    """Context manager for structured logging with timing"""

    def __init__(self, operation: str, **context):
        self.operation = operation
        self.context = context
        self.start_time = None

    def __enter__(self):
        self.start_time = time.time()
        logger.info(f"Starting {self.operation}", **self.context)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        duration_ms = (time.time() - self.start_time) * 1000

        if exc_type:
            logger.error(f"Failed {self.operation} after {duration_ms:.2f}ms: {exc_val}", **self.context)
        else:
            logger.info(f"Completed {self.operation} in {duration_ms:.2f}ms", **self.context)


def log_api_call(service: str, endpoint: str, **params):
    """Log an API call with consistent format"""
    logger.info(f"API call to {service}", endpoint=endpoint, service=service, **params)


def log_api_response(service: str, status_code: int, duration_ms: float | None = None):
    """Log an API response with consistent format"""
    extra = {"service": service, "status_code": status_code}
    if duration_ms is not None:
        extra["duration_ms"] = duration_ms

    if status_code >= 400:
        logger.error(f"{service} returned error status {status_code}", **extra)
    else:
        logger.info(f"{service} responded with status {status_code}", **extra)


def log_cache_hit(cache_type: str, key: str):
    """Log a cache hit"""
    logger.info(f"Cache hit for {cache_type}", cache_type=cache_type, key=key[:50] + "..." if len(key) > 50 else key)


def log_cache_miss(cache_type: str, key: str):
    """Log a cache miss"""
    logger.debug(f"Cache miss for {cache_type}", cache_type=cache_type, key=key[:50] + "..." if len(key) > 50 else key)


def log_config_value(config_name: str, value: Any, sensitive: bool = False):
    """Log a configuration value, masking sensitive data"""
    if sensitive and value:
        # Mask all but first 4 chars
        masked_value = value[:4] + "*" * (len(str(value)) - 4) if len(str(value)) > 4 else "****"
        logger.info(f"Config {config_name}: {masked_value}")
    else:
        logger.info(f"Config {config_name}: {value}")


def log_operation(operation: str):
    """Decorator to log function execution with timing"""

    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            start_time = time.time()
            logger.info(f"Starting {operation}")

            try:
                result = await func(*args, **kwargs)
                duration_ms = (time.time() - start_time) * 1000
                logger.info(f"Completed {operation} in {duration_ms:.2f}ms")
                return result
            except Exception as e:
                duration_ms = (time.time() - start_time) * 1000
                logger.error(f"Failed {operation} after {duration_ms:.2f}ms: {e}")
                raise

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            start_time = time.time()
            logger.info(f"Starting {operation}")

            try:
                result = func(*args, **kwargs)
                duration_ms = (time.time() - start_time) * 1000
                logger.info(f"Completed {operation} in {duration_ms:.2f}ms")
                return result
            except Exception as e:
                duration_ms = (time.time() - start_time) * 1000
                logger.error(f"Failed {operation} after {duration_ms:.2f}ms: {e}")
                raise

        # Return appropriate wrapper based on function type
        import asyncio

        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator


def log_retry(attempt: int, max_attempts: int, delay: float, reason: str | None = None):
    """Log a retry attempt"""
    extra = {"attempt": attempt, "max_attempts": max_attempts, "delay_seconds": delay}
    if reason:
        extra["reason"] = reason

    logger.info(f"Retrying operation (attempt {attempt}/{max_attempts}) after {delay}s delay", **extra)


def log_email_action(action: str, to_email: str, subject: str | None = None):
    """Log email-related actions"""
    extra = {"to_email": to_email, "action": action}
    if subject:
        extra["subject"] = subject

    logger.info(f"Email {action}: {to_email}", **extra)


# Structured logging helpers for specific domains
class ServiceLogger:
    """Domain-specific logging utilities"""

    @staticmethod
    def log_request(session_id: str, question: str, service_type: str):
        """Log incoming request details"""
        logger.info(
            f"Processing {service_type} request",
            session_id=session_id,
            question=question[:100] + "..." if len(question) > 100 else question,
            service_type=service_type,
        )

    @staticmethod
    def log_forward(url: str, headers: dict | None = None):
        """Log request forwarding"""
        extra = {"url": url}
        if headers:
            extra["headers"] = list(headers.keys())

        logger.info(f"Forwarding request to {url}", **extra)

    @staticmethod
    def log_auth_event(event: str, email: str | None = None, success: bool = True):
        """Log authentication events"""
        extra = {"event": event, "success": success}
        if email:
            extra["email"] = email

        level = logger.info if success else logger.warning
        level(f"Auth event: {event}", **extra)
