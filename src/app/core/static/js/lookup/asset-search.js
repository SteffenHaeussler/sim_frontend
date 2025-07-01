class AssetSearch {
    constructor() {
        this.initialized = false;
        this.currentPage = 1;
    }

    initialize() {
        if (this.initialized) {
            // If already initialized, just reload the data
            this.loadFilterOptions();
            this.loadAllAssets();
            return;
        }

        this.initialized = true;

        // Get DOM elements
        this.assetNameSearch = document.getElementById('asset-name-search');
        this.assetTypeFilter = document.getElementById('asset-type-filter');
        this.typeFilter = document.getElementById('type-filter');
        this.clearFiltersBtn = document.getElementById('clear-filters');
        this.assetList = document.getElementById('asset-list');
        this.resultsCount = document.getElementById('results-count');
        this.prevPageBtn = document.getElementById('prev-page');
        this.nextPageBtn = document.getElementById('next-page');
        this.pageInfo = document.getElementById('page-info');

        // Set up event listeners
        if (this.assetNameSearch) this.assetNameSearch.addEventListener('input', () => this.searchAssets());
        if (this.assetTypeFilter) this.assetTypeFilter.addEventListener('change', () => this.searchAssets());
        if (this.typeFilter) this.typeFilter.addEventListener('change', () => this.searchAssets());
        if (this.clearFiltersBtn) this.clearFiltersBtn.addEventListener('click', () => this.clearFilters());
        if (this.prevPageBtn) this.prevPageBtn.addEventListener('click', () => this.changePage(-1));
        if (this.nextPageBtn) this.nextPageBtn.addEventListener('click', () => this.changePage(1));

        // Load initial data and populate table
        this.loadFilterOptions();
        this.loadAllAssets();
    }

    async loadFilterOptions() {
        try {
            const trackingHeaders = window.app ? window.app.getTrackingHeaders() : {};
            const response = await window.authAPI.authenticatedFetch('/lookup/search', {
                headers: trackingHeaders
            });
            const data = await response.json();

            // Populate asset type filter
            if (this.assetTypeFilter) {
                this.assetTypeFilter.innerHTML = '<option value="">Assets</option>';
                data.asset_types.forEach(type => {
                    const option = document.createElement('option');
                    option.value = type;
                    option.textContent = type;
                    this.assetTypeFilter.appendChild(option);
                });
            }

            // Populate type filter
            if (this.typeFilter) {
                this.typeFilter.innerHTML = '<option value="">Types</option>';
                data.types.forEach(type => {
                    const option = document.createElement('option');
                    option.value = type;
                    option.textContent = type;
                    this.typeFilter.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Failed to load filter options:', error);
        }
    }

    async loadAllAssets() {
        // Reset to first page and clear filters for initial load
        this.currentPage = 1;
        this.searchAssets();
    }

    async searchAssets() {
        // Check authentication first
        if (!window.authAPI || !window.authAPI.isLoggedIn()) {
            if (window.authUI && window.authUI.showLoginModal) {
                window.authUI.showLoginModal();
            } else {
                alert('Please log in to use the Lookup service.');
            }
            return;
        }

        const name = this.assetNameSearch ? this.assetNameSearch.value.trim() : '';
        const assetType = this.assetTypeFilter ? this.assetTypeFilter.value : '';
        const type = this.typeFilter ? this.typeFilter.value : '';

        try {
            const params = new URLSearchParams({
                page: this.currentPage,
                limit: 10
            });

            if (name) params.append('name', name);
            if (assetType) params.append('asset_type', assetType);
            if (type) params.append('type', type);

            const trackingHeaders = window.app ? window.app.getTrackingHeaders() : {};
            const response = await window.authAPI.authenticatedFetch(`/lookup/search?${params}`, {
                headers: trackingHeaders
            });
            const data = await response.json();

            this.displayAssets(data);
        } catch (error) {
            console.error('Search failed:', error);
        }
    }

    displayAssets(data) {
        // Update results count
        if (this.resultsCount) {
            this.resultsCount.textContent = `${data.total_count} assets`;
        }

        // Clear and populate asset list
        if (this.assetList) {
            this.assetList.innerHTML = '';

            data.assets.forEach(asset => {
                const assetItem = document.createElement('div');
                assetItem.className = 'asset-item';
                assetItem.innerHTML = `
                    <span class="asset-name">${asset.name}</span>
                    <span class="asset-type">${asset.asset_type}</span>
                `;
                assetItem.addEventListener('click', () => this.selectAsset(asset));
                this.assetList.appendChild(assetItem);
            });
        }

        // Update pagination
        this.updatePagination(data);
    }

    updatePagination(data) {
        if (this.pageInfo) {
            this.pageInfo.textContent = `Page ${data.page} of ${data.total_pages}`;
        }
        if (this.prevPageBtn) {
            this.prevPageBtn.disabled = data.page <= 1;
        }
        if (this.nextPageBtn) {
            this.nextPageBtn.disabled = data.page >= data.total_pages;
        }
    }

    changePage(direction) {
        this.currentPage += direction;
        this.searchAssets();
    }

    clearFilters() {
        if (this.assetNameSearch) this.assetNameSearch.value = '';
        if (this.assetTypeFilter) this.assetTypeFilter.value = '';
        if (this.typeFilter) this.typeFilter.value = '';
        this.currentPage = 1;
        this.searchAssets();
    }

    selectAsset(asset) {
        console.log('Selected asset:', asset);

        // Notify asset info module about the selection
        if (window.lookupService && window.lookupService.assetInfo) {
            window.lookupService.assetInfo.populateAssetName(asset.name);
        }
    }

    reset() {
        // Clear search fields
        if (this.assetNameSearch) this.assetNameSearch.value = '';
        if (this.assetTypeFilter) this.assetTypeFilter.value = '';
        if (this.typeFilter) this.typeFilter.value = '';
        this.currentPage = 1;

        // Reload all assets to populate the table
        this.loadAllAssets();
    }
}

// Export for use in lookup service
window.AssetSearch = AssetSearch;