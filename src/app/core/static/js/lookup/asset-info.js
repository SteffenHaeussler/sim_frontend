class AssetInfo {
  constructor() {
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return;

    this.initialized = true;

    // Get DOM elements
    this.assetInfoName = document.getElementById("asset-info-name");
    this.getAssetInfoBtn = document.getElementById("get-asset-info");
    this.assetDetails = document.getElementById("asset-details");

    // Set up event listeners
    if (this.getAssetInfoBtn) {
      this.getAssetInfoBtn.addEventListener("click", () =>
        this.handleGetAssetInfo(),
      );
    }
    if (this.assetInfoName) {
      this.assetInfoName.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          this.handleGetAssetInfo();
        }
      });
    }
  }

  populateAssetName(assetName) {
    if (this.assetInfoName) {
      this.assetInfoName.value = assetName;
      // Automatically trigger asset info lookup
      this.handleGetAssetInfo();
    }
  }

  async handleGetAssetInfo() {
    // Check authentication first
    if (!window.authAPI || !window.authAPI.isLoggedIn()) {
      if (window.authUI && window.authUI.showLoginModal) {
        window.authUI.showLoginModal();
      } else {
        alert("Please log in to use the Lookup service.");
      }
      return;
    }
    const assetInput = this.assetInfoName
      ? this.assetInfoName.value.trim()
      : "";
    if (!assetInput) {
      this.showAssetDetails(null, "Please enter an asset name or ID");
      return;
    }

    try {
      let assetId;
      let inputType;

      // Check if input looks like a UUID (asset ID)
      const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isUuid = uuidPattern.test(assetInput);
      inputType = isUuid ? "ID" : "name";

      if (isUuid) {
        // Input is already an asset ID, skip the first API call
        assetId = assetInput;
        console.log("Input detected as UUID, using directly:", assetId);
      } else {
        // Input is an asset name, get ID from name first
        console.log("Input detected as name, fetching ID for:", assetInput);
        const trackingHeaders = window.app
          ? window.app.getTrackingHeaders()
          : {};
        const idResponse = await window.authAPI.authenticatedFetch(
          `/api/id/${encodeURIComponent(assetInput)}`,
          {
            headers: trackingHeaders,
          },
        );
        const idData = await idResponse.json();

        if (idData.error) {
          this.showAssetDetails(
            null,
            `Asset name "${assetInput}" was not found. Please check the spelling and try again.`,
          );
          return;
        }

        // Extract the asset ID from the response
        assetId = idData.id || idData.asset_id || idData;
        if (!assetId) {
          this.showAssetDetails(
            null,
            `No ID found for asset name "${assetInput}". Please verify the name is correct.`,
          );
          return;
        }
      }

      // Get asset details using the ID
      const trackingHeaders2 = window.app
        ? window.app.getTrackingHeaders()
        : {};
      const assetResponse = await window.authAPI.authenticatedFetch(
        `/api/asset/${encodeURIComponent(assetId)}`,
        {
          headers: trackingHeaders2,
        },
      );
      const assetData = await assetResponse.json();

      if (assetData.error) {
        this.showAssetDetails(
          null,
          `Asset with ${inputType} "${assetInput}" was not found. Please check and try again.`,
        );
      } else {
        this.showAssetDetails(assetData, null);
      }
    } catch (error) {
      console.error("Failed to get asset info:", error);
      this.showAssetDetails(null, "Failed to fetch asset information");
    }
  }

  showAssetDetails(assetData, errorMessage) {
    if (!this.assetDetails) return;

    if (errorMessage) {
      this.assetDetails.innerHTML = `
                <div class="details-placeholder">
                    ${errorMessage}
                </div>
            `;
      return;
    }

    if (!assetData) {
      this.assetDetails.innerHTML = `
                <div class="details-placeholder">
                    Enter an asset name to view details
                </div>
            `;
      return;
    }

    // Display JSON response as key-value rows with custom ordering
    let detailsHtml = "";

    // Collect all key-value pairs first
    const allFields = {};

    const processObject = (obj, prefix = "") => {
      for (const [key, value] of Object.entries(obj)) {
        const displayKey = prefix ? `${prefix}.${key}` : key;

        if (value && typeof value === "object" && !Array.isArray(value)) {
          // Nested object - recurse
          processObject(value, displayKey);
        } else {
          // Simple value - store in collection
          allFields[displayKey] = Array.isArray(value)
            ? JSON.stringify(value)
            : String(value);
        }
      }
    };

    processObject(assetData);

    // Define priority order for important fields
    const priorityFields = ["name", "id", "description"];

    // Create rows for priority fields first
    priorityFields.forEach((fieldName) => {
      if (allFields[fieldName]) {
        const displayValue = allFields[fieldName];
        const escapedValue = displayValue
          .replace(/'/g, "\\'")
          .replace(/"/g, '\\"');
        detailsHtml += `
                    <div class="asset-detail-item">
                        <span class="detail-label">${fieldName}:</span>
                        <span class="detail-value">${displayValue}</span>
                        <button class="copy-value-btn" onclick="window.lookupService.assetInfo.copyAssetValue('${escapedValue}', this)" title="Copy value">
                            <img src="/static/icons/copy.svg" alt="Copy">
                        </button>
                    </div>
                `;
        delete allFields[fieldName]; // Remove from remaining fields
      }
    });

    // Sort remaining fields alphabetically and create rows
    const remainingFields = Object.keys(allFields).sort();
    remainingFields.forEach((fieldName) => {
      const displayValue = allFields[fieldName];
      const escapedValue = displayValue
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"');
      detailsHtml += `
                <div class="asset-detail-item">
                    <span class="detail-label">${fieldName}:</span>
                    <span class="detail-value">${displayValue}</span>
                    <button class="copy-value-btn" onclick="window.lookupService.assetInfo.copyAssetValue('${escapedValue}', this)" title="Copy value">
                        <img src="/static/icons/copy.svg" alt="Copy">
                    </button>
                </div>
            `;
    });

    this.assetDetails.innerHTML = detailsHtml;
  }

  async copyAssetValue(value, button) {
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(value);
        console.log("Asset value copied to clipboard using modern API:", value);
      } else {
        // Fallback to legacy method
        this.copyToClipboardFallback(value);
        console.log(
          "Asset value copied to clipboard using fallback method:",
          value,
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
        button.title = "Copy value";
      }, 2000);
    } catch (err) {
      console.error("Failed to copy asset value: ", err);

      // Try fallback method if modern API fails
      try {
        this.copyToClipboardFallback(value);
        console.log(
          "Asset value copied to clipboard using fallback after error:",
          value,
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
          button.title = "Copy value";
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
    if (this.assetInfoName) {
      this.assetInfoName.value = "";
    }

    // Reset details view
    if (this.assetDetails) {
      this.assetDetails.innerHTML = `
                <div class="details-placeholder">
                    Enter an asset name to view details
                </div>
            `;
    }
  }
}

// Export for use in lookup service
window.AssetInfo = AssetInfo;
