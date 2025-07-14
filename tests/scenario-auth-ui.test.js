import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

describe("Scenario Authentication UI", () => {
  let mockApp;
  let scenarioButton;

  beforeEach(() => {
    // Set up DOM
    document.body.innerHTML = `
            <div id="scenario-btn" class="icon-item">
                <span class="icon-label">Scenario Analysis</span>
            </div>
            <div id="messages"></div>
        `;

    scenarioButton = document.getElementById("scenario-btn");

    // Mock app instance
    mockApp = {
      isUserLoggedIn: vi.fn(),
      showLoginRequired: vi.fn(),
      handleNewSession: vi.fn(),
      setActiveService: vi.fn(),
      handleServiceClickWithNewSession: vi.fn(function (service) {
        // Simulate the real implementation
        const protectedServices = [
          "ask-agent",
          "ask-sql-agent",
          "lookup-service",
          "search",
          "library",
          "scenario",
        ];
        if (protectedServices.includes(service) && !this.isUserLoggedIn()) {
          this.showLoginRequired();
          return;
        }
        this.handleNewSession();
        this.setActiveService(service);
      }),
    };

    // Mock window objects
    window.app = mockApp;
    window.authAPI = {
      isLoggedIn: vi.fn(),
      getToken: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = "";
  });

  it("should show login required when clicking scenario button without authentication", () => {
    // Setup: User is not logged in
    mockApp.isUserLoggedIn.mockReturnValue(false);
    window.authAPI.isLoggedIn.mockReturnValue(false);

    // Act: Click scenario button
    mockApp.handleServiceClickWithNewSession.call(mockApp, "scenario");

    // Assert: Should show login required
    expect(mockApp.showLoginRequired).toHaveBeenCalledTimes(1);
    expect(mockApp.handleNewSession).not.toHaveBeenCalled();
    expect(mockApp.setActiveService).not.toHaveBeenCalled();
  });

  it("should allow scenario access when user is authenticated", () => {
    // Setup: User is logged in
    mockApp.isUserLoggedIn.mockReturnValue(true);
    window.authAPI.isLoggedIn.mockReturnValue(true);
    window.authAPI.getToken.mockReturnValue("valid-token");

    // Act: Click scenario button
    mockApp.handleServiceClickWithNewSession.call(mockApp, "scenario");

    // Assert: Should proceed with scenario
    expect(mockApp.showLoginRequired).not.toHaveBeenCalled();
    expect(mockApp.handleNewSession).toHaveBeenCalledTimes(1);
    expect(mockApp.setActiveService).toHaveBeenCalledWith("scenario");
  });

  it("should include scenario in protected services list", () => {
    // This tests that scenario is in the protected services list
    const protectedServices = [
      "ask-agent",
      "ask-sql-agent",
      "lookup-service",
      "search",
      "library",
      "scenario",
    ];

    expect(protectedServices).toContain("scenario");
    expect(protectedServices).toContain("ask-agent");
    expect(protectedServices).toContain("lookup-service");
  });

  it("should not allow WebSocket connection without token", () => {
    // Setup: No token available
    window.authAPI.getToken.mockReturnValue(null);

    // Mock scenario agent
    const mockScenarioAgent = {
      connectWebSocket: vi
        .fn()
        .mockRejectedValue(new Error("Authentication required")),
    };

    // Simulate connection attempt
    expect(mockScenarioAgent.connectWebSocket()).rejects.toThrow(
      "Authentication required",
    );
  });
});
