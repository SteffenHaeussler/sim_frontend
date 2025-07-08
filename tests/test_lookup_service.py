from fastapi import status


class TestLookupServiceSearch:
    """Test detailed lookup service search functionality"""

    def test_search_with_multiple_filters(self, client, auth_headers):
        """Test search with multiple filter parameters"""
        response = client.get(
            "/lookup/search?name=Temperature&asset_type=sensor&type=temperature", headers=auth_headers
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_count"] == 1
        assert data["assets"][0]["name"] == "Temperature Sensor 1"
        assert data["assets"][0]["asset_type"] == "sensor"
        assert data["assets"][0]["type"] == "temperature"

    def test_search_case_insensitive(self, client, auth_headers):
        """Test that search is case insensitive"""
        response = client.get("/lookup/search?name=temperature", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_count"] == 1
        assert data["assets"][0]["name"] == "Temperature Sensor 1"

    def test_search_partial_match(self, client, auth_headers):
        """Test that search supports partial matching"""
        response = client.get("/lookup/search?name=Temp", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_count"] == 1
        assert "Temperature" in data["assets"][0]["name"]

    def test_search_pagination_limits(self, client, auth_headers):
        """Test pagination with different limits"""
        # Test with limit of 1
        response = client.get("/lookup/search?limit=1", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["limit"] == 1
        assert len(data["assets"]) == 1
        assert data["total_pages"] == 3  # 3 total assets, 1 per page

        # Test with limit of 5 (should return all 3)
        response = client.get("/lookup/search?limit=5", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["limit"] == 5
        assert len(data["assets"]) == 3
        assert data["total_pages"] == 1

    def test_search_pagination_pages(self, client, auth_headers):
        """Test pagination across multiple pages"""
        # Page 1 with limit 2
        response = client.get("/lookup/search?limit=2&page=1", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["page"] == 1
        assert len(data["assets"]) == 2

        # Page 2 with limit 2 (should have 1 remaining asset)
        response = client.get("/lookup/search?limit=2&page=2", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["page"] == 2
        assert len(data["assets"]) == 1

    def test_search_invalid_page(self, client, auth_headers):
        """Test search with invalid page number"""
        response = client.get("/lookup/search?page=999", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["assets"]) == 0


class TestLookupServiceAssetTypes:
    """Test asset type filtering and management"""

    def test_get_all_asset_types(self, client, auth_headers):
        """Test that search returns all unique asset types"""
        response = client.get("/lookup/search", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Check that we get asset types in the response structure
        assert "asset_types" in data
        expected_types = ["sensor", "valve", "meter"]
        for asset_type in expected_types:
            assert asset_type in data["asset_types"]

    def test_filter_by_asset_type(self, client, auth_headers):
        """Test filtering by different asset types"""
        asset_types = ["sensor", "valve", "meter"]

        for asset_type in asset_types:
            response = client.get(f"/lookup/search?asset_type={asset_type}", headers=auth_headers)
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["total_count"] == 1
            assert data["assets"][0]["asset_type"] == asset_type

    def test_get_all_types(self, client, auth_headers):
        """Test that search returns all unique types"""
        response = client.get("/lookup/search", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Check that we get types in the response structure
        assert "types" in data
        expected_types = ["temperature", "pressure", "flow"]
        for type_name in expected_types:
            assert type_name in data["types"]


class TestLookupServiceErrorHandling:
    """Test error handling in lookup service"""

    def test_search_with_invalid_parameters(self, client, auth_headers):
        """Test search with invalid parameter values"""
        # Test with invalid limit (should handle gracefully)
        response = client.get("/lookup/search?limit=-1", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

        # Test with invalid page (should handle gracefully)
        response = client.get("/lookup/search?page=0", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK

    def test_search_empty_database_simulation(self, client, auth_headers):
        """Test search behavior when no assets match"""
        response = client.get("/lookup/search?name=NonExistentAsset", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_count"] == 0
        assert len(data["assets"]) == 0
        assert data["total_pages"] == 0


class TestLookupAssetsList:
    """Test the lookup assets list endpoint"""

    def test_get_lookup_assets_structure(self, client, auth_headers):
        """Test the structure of the lookup assets response"""
        response = client.get("/lookup/assets", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Check response structure
        assert "assets" in data
        assert "count" in data
        assert isinstance(data["assets"], list)
        assert isinstance(data["count"], int)
        assert data["count"] == len(data["assets"])

    def test_lookup_assets_contain_required_fields(self, client, auth_headers):
        """Test that assets contain all required fields"""
        response = client.get("/lookup/assets", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        for asset in data["assets"]:
            required_fields = ["id", "name", "asset_type", "type"]
            for field in required_fields:
                assert field in asset
                assert asset[field] is not None
                assert len(str(asset[field])) > 0
