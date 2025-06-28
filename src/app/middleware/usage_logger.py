import uuid
from typing import Optional

from loguru import logger

from src.app.models.database import get_db
from src.app.models.tracking import ApiUsageLog


class UsageLogger:
    """Handles logging API usage to the database"""
    
    async def log_usage(
        self,
        endpoint: str,
        method: str,
        status_code: int,
        duration_ms: float,
        user_id: Optional[uuid.UUID],
        organisation_id: Optional[uuid.UUID],
        session_id: Optional[str],
        event_id: Optional[str],
        user_agent: str,
        ip_address: str,
        query_params: Optional[str],
        request_size: Optional[int],
        response_size: Optional[int],
        service_type: str,
        template_used: Optional[str],
        error_message: Optional[str],
        response_metadata = None
    ) -> Optional[uuid.UUID]:
        """Log API usage and response metadata to database"""
        try:
            async for db in get_db():
                # Create and save usage log
                usage_log = ApiUsageLog.log_api_call(
                    endpoint=endpoint,
                    method=method,
                    status_code=status_code,
                    duration_ms=duration_ms,
                    user_id=user_id,
                    organisation_id=organisation_id,
                    session_id=session_id,
                    event_id=event_id,
                    user_agent=user_agent,
                    ip_address=ip_address,
                    query_params=query_params,
                    request_size=request_size,
                    response_size=response_size,
                    service_type=service_type,
                    template_used=template_used,
                    error_message=error_message,
                )
                
                db.add(usage_log)
                await db.flush()  # Get the usage_log.id without committing yet
                
                # Add response metadata if provided
                if response_metadata:
                    db.add(response_metadata)
                
                await db.commit()
                return usage_log.id
                
        except Exception as e:
            logger.error(f"Failed to log API usage and response metadata: {e}")
            return None