import uuid
from typing import Optional

from fastapi import Response
from loguru import logger

from src.app.models.tracking import ApiResponseMetadata


class ResponseAnalyzer:
    """Analyzes responses to extract metadata for logging"""
    
    def extract_response_data(self, response: Response) -> dict:
        """Extract basic response data"""
        content_type = response.headers.get("content-type", "")
        
        # Get response body and size
        response_body = None
        response_size = None
        
        # Try to read response body safely
        try:
            if hasattr(response, 'body') and response.body:
                response_body = response.body
                response_size = len(response_body)
            elif hasattr(response, '_body') and response._body:
                response_body = response._body  
                response_size = len(response_body)
        except Exception as e:
            logger.debug(f"Could not read response body: {e}")
        
        # Determine error message if applicable
        error_message = None
        if response.status_code >= 400:
            error_message = f"HTTP {response.status_code}"
        
        return {
            "response_body": response_body,
            "response_size": response_size,
            "content_type": content_type,
            "error_message": error_message
        }
    
    def create_response_metadata(
        self, 
        usage_log_id: uuid.UUID, 
        response: Response, 
        response_body: bytes, 
        duration_ms: float, 
        content_type: str,
        service_type: str,
        error_message: str = None
    ) -> ApiResponseMetadata:
        """Create response metadata entry"""
        
        # Analyze response content
        content_preview = None
        has_images = False
        image_count = 0
        processing_steps = None
        error_type = None
        
        if response_body:
            try:
                # Try to decode response as text for preview
                if content_type.startswith("application/json") or content_type.startswith("text/"):
                    response_text = response_body.decode('utf-8')
                    content_preview = response_text[:500]  # First 500 characters
                    
                    # Check for images in ask-agent responses
                    if service_type == 'ask-agent' and "$%$%Plot:" in response_text:
                        has_images = True
                        image_count = response_text.count("$%$%Plot:")
                    
                    # Extract processing steps for semantic search
                    if service_type == 'semantic-search':
                        processing_steps = "embedding→search→ranking"
                        
            except UnicodeDecodeError:
                content_preview = f"Binary content ({len(response_body)} bytes)"
        
        # Determine error type from status code
        if response.status_code >= 400:
            if response.status_code == 401:
                error_type = "authentication_error"
            elif response.status_code == 403:
                error_type = "authorization_error"
            elif response.status_code == 404:
                error_type = "not_found_error"
            elif response.status_code == 422:
                error_type = "validation_error"
            elif response.status_code >= 500:
                error_type = "server_error"
            else:
                error_type = "client_error"
        
        return ApiResponseMetadata.create_metadata(
            usage_log_id=usage_log_id,
            response_status_code=response.status_code,
            response_size_bytes=len(response_body) if response_body else None,
            response_time_ms=duration_ms,
            content_type=content_type,
            content_preview=content_preview,
            has_images=has_images,
            image_count=image_count,
            processing_steps=processing_steps,
            error_type=error_type,
            error_details=error_message,
        )