class LookupService {
  constructor() {
    this.initializeElements();
    this.initializeModules();
  }

  initializeElements() {
    this.lookupSessionElement = document.getElementById("lookup-session-id");
  }

  initializeModules() {
    // Initialize all lookup modules
    this.assetSearch = new window.AssetSearch();
    this.assetInfo = new window.AssetInfo();
    this.neighborSearch = new window.NeighborSearch();
    this.semanticSearch = new window.SemanticSearch();
  }

  updateSessionId() {
    if (this.lookupSessionElement && window.app) {
      this.lookupSessionElement.textContent = window.app.sessionId;
    }
  }

  handleNewSession() {
    // Initialize all modules
    this.assetSearch.initialize();
    this.assetInfo.initialize();
    this.neighborSearch.initialize();
    this.semanticSearch.initialize();

    // Reset all modules to their initial state
    this.assetSearch.reset();
    this.assetInfo.reset();
    this.neighborSearch.reset();
    this.semanticSearch.reset();

    // Update session ID display
    this.updateSessionId();

    console.log("New lookup service session started");
  }
}

// Initialize lookup service when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.lookupService = new LookupService();
});
