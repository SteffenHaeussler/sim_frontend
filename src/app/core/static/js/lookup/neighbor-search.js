class NeighborSearch {
    constructor() {
        this.initialized = false;
    }

    initialize() {
        if (this.initialized) return;

        this.initialized = true;

        // Get DOM elements
        this.neighborAssetId = document.getElementById('neighbor-asset-id');
        this.getNeighborsBtn = document.getElementById('get-neighbors');
        this.neighborResults = document.getElementById('neighbor-results');

        // Set up event listeners
        if (this.getNeighborsBtn) {
            this.getNeighborsBtn.addEventListener('click', () => this.handleGetNeighbors());
        }
        if (this.neighborAssetId) {
            this.neighborAssetId.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleGetNeighbors();
                }
            });
        }
    }

    async handleGetNeighbors() {
        // Check authentication first
        if (!window.authAPI || !window.authAPI.isLoggedIn()) {
            if (window.authUI && window.authUI.showLoginModal) {
                window.authUI.showLoginModal();
            } else {
                alert('Please log in to use the Lookup service.');
            }
            return;
        }
        const assetId = this.neighborAssetId ? this.neighborAssetId.value.trim() : '';
        if (!assetId) {
            this.showNeighborResults(null, 'Please enter an asset ID');
            return;
        }

        try {
            // Make API call to neighbor endpoint
            const response = await fetch(`/api/neighbor/${encodeURIComponent(assetId)}`);
            const data = await response.json();

            if (data.error) {
                this.showNeighborResults(null, `Asset ID "${assetId}" was not found. Please check and try again.`);
            } else {
                this.showNeighborResults(data, null);
            }
        } catch (error) {
            console.error('Failed to get neighbors:', error);
            this.showNeighborResults(null, 'Failed to fetch neighbor information');
        }
    }

    showNeighborResults(neighborData, errorMessage) {
        if (!this.neighborResults) return;

        if (errorMessage) {
            this.neighborResults.innerHTML = `
                <div class="neighbor-placeholder">
                    ${errorMessage}
                </div>
            `;
            return;
        }

        if (!neighborData) {
            this.neighborResults.innerHTML = `
                <div class="neighbor-placeholder">
                    Enter an asset ID to find neighboring assets
                </div>
            `;
            return;
        }

        // Display neighbor IDs as a list
        let neighborsHtml = '';

        // Handle different response formats - could be array or object with array
        let neighborIds = [];
        if (Array.isArray(neighborData)) {
            neighborIds = neighborData;
        } else if (neighborData.neighbors && Array.isArray(neighborData.neighbors)) {
            neighborIds = neighborData.neighbors;
        } else if (neighborData.ids && Array.isArray(neighborData.ids)) {
            neighborIds = neighborData.ids;
        } else {
            // Try to extract any array from the response
            for (const [key, value] of Object.entries(neighborData)) {
                if (Array.isArray(value)) {
                    neighborIds = value;
                    break;
                }
            }
        }

        if (neighborIds.length === 0) {
            this.neighborResults.innerHTML = `
                <div class="neighbor-placeholder">
                    No neighboring assets found for this ID
                </div>
            `;
            return;
        }

        neighborIds.forEach(neighborId => {
            const escapedId = String(neighborId).replace(/'/g, "\\'").replace(/"/g, '\\"');
            neighborsHtml += `
                <div class="neighbor-item">
                    <span class="neighbor-id">${neighborId}</span>
                    <button class="neighbor-copy-btn" onclick="window.lookupService.neighborSearch.copyNeighborId('${escapedId}', this)" title="Copy neighbor ID">
                        <img src="/static/icons/copy.svg" alt="Copy">
                    </button>
                </div>
            `;
        });

        this.neighborResults.innerHTML = neighborsHtml;
    }

    async copyNeighborId(neighborId, button) {
        try {
            await navigator.clipboard.writeText(neighborId);
            console.log('Neighbor ID copied to clipboard:', neighborId);

            // Show visual feedback
            const originalIcon = button.innerHTML;
            button.innerHTML = '<img src="/static/icons/copy-active.svg" alt="Copied">';
            button.disabled = true;
            button.title = 'Copied!';

            // Reset after 2 seconds
            setTimeout(() => {
                button.innerHTML = originalIcon;
                button.disabled = false;
                button.title = 'Copy neighbor ID';
            }, 2000);
        } catch (err) {
            console.error('Failed to copy neighbor ID: ', err);
        }
    }

    reset() {
        // Clear input field
        if (this.neighborAssetId) {
            this.neighborAssetId.value = '';
        }
        
        // Reset results view
        if (this.neighborResults) {
            this.neighborResults.innerHTML = `
                <div class="neighbor-placeholder">
                    Enter an asset ID to find neighboring assets
                </div>
            `;
        }
    }
}

// Export for use in lookup service
window.NeighborSearch = NeighborSearch;