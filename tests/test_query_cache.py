import time

from src.app.services.query_cache import QueryCache


class TestQueryCache:
    """Test the query caching functionality"""

    def test_cache_hit_and_miss(self):
        """Test basic cache hit and miss scenarios"""
        cache = QueryCache(ttl_seconds=60)

        query = "What is the temperature of DC-101?"
        domain = "process_performance"
        data = {"result": "Temperature is 75°C"}

        # Initial miss
        assert cache.get(query, domain) is None

        # Set cache
        cache.set(query, domain, data)

        # Cache hit
        cached = cache.get(query, domain)
        assert cached == data

        # Different query should miss
        assert cache.get("Different query", domain) is None

        # Different domain should miss
        assert cache.get(query, "different_domain") is None

    def test_cache_expiration(self):
        """Test that cached items expire"""
        cache = QueryCache(ttl_seconds=0.1)  # 100ms TTL

        query = "Test query"
        domain = "test"
        data = {"result": "test"}

        cache.set(query, domain, data)

        # Should hit immediately
        assert cache.get(query, domain) == data

        # Wait for expiration
        time.sleep(0.2)

        # Should miss after expiration
        assert cache.get(query, domain) is None

    def test_cache_eviction(self):
        """Test that old items are evicted when cache is full"""
        cache = QueryCache(ttl_seconds=300)
        cache.max_size = 3  # Small cache for testing

        # Fill cache
        for i in range(3):
            cache.set(f"query{i}", "domain", {"data": i})

        assert len(cache.cache) == 3

        # Add one more - should evict oldest
        cache.set("query3", "domain", {"data": 3})

        assert len(cache.cache) == 3
        assert cache.get("query0", "domain") is None  # Oldest was evicted
        assert cache.get("query3", "domain") == {"data": 3}  # New one exists

    def test_cache_stats(self):
        """Test cache statistics"""
        cache = QueryCache(ttl_seconds=60)

        # Empty cache stats
        stats = cache.get_stats()
        assert stats["size"] == 0
        assert stats["total_hits"] == 0

        # Add items and get them
        cache.set("query1", "domain", {"data": 1})
        cache.set("query2", "domain", {"data": 2})

        cache.get("query1", "domain")
        cache.get("query1", "domain")
        cache.get("query2", "domain")

        stats = cache.get_stats()
        assert stats["size"] == 2
        assert stats["total_hits"] == 3

    def test_query_normalization(self):
        """Test that queries are normalized for better cache hits"""
        cache = QueryCache()

        data = {"result": "test"}

        # Set with one format
        cache.set("  What is the TEMPERATURE?  ", "domain", data)

        # Should hit with different format
        assert cache.get("what is the temperature?", "domain") == data
        assert cache.get("WHAT IS THE TEMPERATURE?", "domain") == data
        assert cache.get("  what is the temperature?  ", "domain") == data

    def test_clear_cache(self):
        """Test clearing the cache"""
        cache = QueryCache()

        # Add some items
        for i in range(5):
            cache.set(f"query{i}", "domain", {"data": i})

        assert len(cache.cache) == 5

        # Clear
        cache.clear()

        assert len(cache.cache) == 0
        assert cache.get("query0", "domain") is None
