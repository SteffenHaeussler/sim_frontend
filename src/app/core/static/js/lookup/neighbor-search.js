class NeighborSearch {
  constructor() {
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return;

    this.initialized = true;

    // Get DOM elements
    this.neighborAssetId = document.getElementById("neighbor-asset-id");
    this.getNeighborsBtn = document.getElementById("get-neighbors");
    this.neighborResults = document.getElementById("neighbor-results");

    // Set up event listeners
    if (this.getNeighborsBtn) {
      this.getNeighborsBtn.addEventListener("click", () =>
        this.handleGetNeighbors(),
      );
    }
    if (this.neighborAssetId) {
      this.neighborAssetId.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
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
        alert("Please log in to use the Lookup service.");
      }
      return;
    }
    const assetId = this.neighborAssetId
      ? this.neighborAssetId.value.trim()
      : "";
    if (!assetId) {
      this.showNeighborResults(null, "Please enter an asset ID");
      return;
    }

    try {
      // Make API call to neighbor endpoint
      const trackingHeaders = window.app ? window.app.getTrackingHeaders() : {};
      const response = await window.authAPI.authenticatedFetch(
        `/api/neighbor/${encodeURIComponent(assetId)}`,
        {
          headers: trackingHeaders,
        },
      );
      const data = await response.json();

      if (data.error) {
        this.showNeighborResults(
          null,
          `Asset ID "${assetId}" was not found. Please check and try again.`,
        );
      } else {
        this.showNeighborResults(data, null);
      }
    } catch (error) {
      console.error("Failed to get neighbors:", error);
      this.showNeighborResults(null, "Failed to fetch neighbor information");
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
    let neighborsHtml = "";

    // Handle different response formats - could be array or object with array
    let neighborIds = [];
    if (Array.isArray(neighborData)) {
      neighborIds = neighborData;
    } else if (
      neighborData.neighbors &&
      Array.isArray(neighborData.neighbors)
    ) {
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

    neighborIds.forEach((neighborId) => {
      const escapedId = String(neighborId)
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"');
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
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(neighborId);
        console.log(
          "Neighbor ID copied to clipboard using modern API:",
          neighborId,
        );
      } else {
        // Fallback to legacy method
        this.copyToClipboardFallback(neighborId);
        console.log(
          "Neighbor ID copied to clipboard using fallback method:",
          neighborId,
        );
      }

      // Show visual feedback
      const originalIcon = button.innerHTML;
      button.innerHTML =
        '<img src="/static/icons/copy-active.svg" alt="Copied">';
      button.disabled = true;
      button.title = "Copied!";

      // Reset after 2 seconds
      setTimeout(() => {
        button.innerHTML = originalIcon;
        button.disabled = false;
        button.title = "Copy neighbor ID";
      }, 2000);
    } catch (err) {
      console.error("Failed to copy neighbor ID: ", err);

      // Try fallback method if modern API fails
      try {
        this.copyToClipboardFallback(neighborId);
        console.log(
          "Neighbor ID copied to clipboard using fallback after error:",
          neighborId,
        );

        // Show visual feedback
        const originalIcon = button.innerHTML;
        button.innerHTML =
          '<img src="/static/icons/copy-active.svg" alt="Copied">';
        button.disabled = true;
        button.title = "Copied!";

        // Reset after 2 seconds
        setTimeout(() => {
          button.innerHTML = originalIcon;
          button.disabled = false;
          button.title = "Copy neighbor ID";
        }, 2000);
      } catch (fallbackErr) {
        console.error("Fallback copy also failed: ", fallbackErr);
        // Show error feedback
        button.title = "Failed to copy - try manual selection";
      }
    }
  }

  copyToClipboardFallback(text) {
    // Create a temporary textarea element
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      // Use execCommand as fallback
      const successful = document.execCommand("copy");
      if (!successful) {
        throw new Error("execCommand copy returned false");
      }
    } finally {
      document.body.removeChild(textArea);
    }
  }

  reset() {
    // Clear input field
    if (this.neighborAssetId) {
      this.neighborAssetId.value = "";
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
