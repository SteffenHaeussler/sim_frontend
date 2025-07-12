import hashlib
import json
import time
from typing import Any, Dict, Optional


class QueryCache:
    """Simple in-memory cache for scenario queries"""
    
    def __init__(self, ttl_seconds: int = 300):  # 5 minutes default TTL
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.ttl = ttl_seconds
        self.max_size = 100  # Maximum number of cached items
        
    def _generate_key(self, query: str, domain: str) -> str:
        """Generate a cache key from query and domain"""
        # Normalize query for better cache hits
        normalized_query = query.lower().strip()
        
        # Create a unique key
        content = f"{domain}:{normalized_query}"
        return hashlib.md5(content.encode()).hexdigest()
    
    def get(self, query: str, domain: str) -> Optional[Dict[str, Any]]:
        """Get cached result if available and not expired"""
        key = self._generate_key(query, domain)
        
        if key not in self.cache:
            return None
        
        cached_item = self.cache[key]
        
        # Check if expired
        if time.time() > cached_item["expires_at"]:
            del self.cache[key]
            return None
        
        # Update hit count
        cached_item["hits"] += 1
        
        return cached_item["data"]
    
    def set(self, query: str, domain: str, data: Dict[str, Any]) -> None:
        """Cache a result with TTL"""
        # Clean up if cache is too large
        if len(self.cache) >= self.max_size:
            self._evict_oldest()
        
        key = self._generate_key(query, domain)
        
        self.cache[key] = {
            "data": data,
            "expires_at": time.time() + self.ttl,
            "created_at": time.time(),
            "hits": 0,
            "query": query,
            "domain": domain
        }
    
    def _evict_oldest(self) -> None:
        """Remove oldest entry from cache"""
        if not self.cache:
            return
        
        # Find oldest entry
        oldest_key = min(
            self.cache.keys(),
            key=lambda k: self.cache[k]["created_at"]
        )
        
        del self.cache[oldest_key]
    
    def clear(self) -> None:
        """Clear all cached items"""
        self.cache.clear()
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        total_hits = sum(item["hits"] for item in self.cache.values())
        
        return {
            "size": len(self.cache),
            "max_size": self.max_size,
            "total_hits": total_hits,
            "ttl_seconds": self.ttl
        }