from typing import ClassVar

import httpx


class HTTPClientPool:
    """Singleton HTTP client pool for external API calls"""

    _instance: ClassVar["HTTPClientPool | None"] = None
    _client: httpx.AsyncClient | None = None

    def __new__(cls) -> "HTTPClientPool":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def get_client(self) -> httpx.AsyncClient:
        """Get or create the shared HTTP client with connection pooling"""
        if self._client is None:
            self._client = httpx.AsyncClient(
                limits=httpx.Limits(
                    max_keepalive_connections=20,
                    max_connections=100,
                    keepalive_expiry=30.0,
                ),
                timeout=httpx.Timeout(30.0),
                http2=True,
            )
        return self._client

    async def close(self) -> None:
        """Close the HTTP client and cleanup connections"""
        if self._client:
            await self._client.aclose()
            self._client = None


# Global instance
http_client_pool: HTTPClientPool = HTTPClientPool()
