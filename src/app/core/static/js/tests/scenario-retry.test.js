import { ScenarioUIRenderer } from "../scenario-ui-renderer.js";

describe("ScenarioUIRenderer Retry Functionality", () => {
  let container;
  let renderer;

  beforeEach(() => {
    container = document.createElement("div");
    container.id = "messages";
    document.body.appendChild(container);
    renderer = new ScenarioUIRenderer(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  test("should show retry button on error", () => {
    const messageId = "test-123";
    const subId = "sub-1";
    const agentType = "sqlagent";
    const error = "Connection timeout";

    // Create scenario container
    renderer.createScenarioContainer(messageId, "Test question?");

    // Add error result
    renderer.addResult(messageId, subId, agentType, "", true, error);

    // Check retry button is visible
    const resultSection = container.querySelector(`[data-sub-id="${subId}"]`);
    const retryButton = resultSection.querySelector(".retry-button");
    const statusSpan = resultSection.querySelector(".result-status");
    const errorMessage = resultSection.querySelector(".error-message");

    expect(retryButton).toBeTruthy();
    expect(retryButton.style.display).toBe("inline-block");
    expect(retryButton.textContent).toBe("Retry");
    expect(statusSpan.textContent).toBe("❌");
    expect(statusSpan.className).toContain("error");
    expect(errorMessage).toBeTruthy();
    expect(errorMessage.textContent).toContain("Error: Connection timeout");
  });

  test("should hide retry button on successful result", () => {
    const messageId = "test-123";
    const subId = "sub-1";
    const agentType = "sqlagent";
    const content = "Temperature is 75°C";

    // Create scenario container
    renderer.createScenarioContainer(messageId, "Test question?");

    // Add successful result
    renderer.addResult(messageId, subId, agentType, content, true);

    // Check retry button is hidden
    const resultSection = container.querySelector(`[data-sub-id="${subId}"]`);
    const retryButton = resultSection.querySelector(".retry-button");
    const statusSpan = resultSection.querySelector(".result-status");

    expect(retryButton).toBeTruthy();
    expect(retryButton.style.display).toBe("none");
    expect(statusSpan.textContent).toBe("✓");
    expect(statusSpan.className).toContain("success");
  });

  test("should emit retry event when retry button clicked", (done) => {
    const messageId = "test-123";
    const subId = "sub-1";
    const agentType = "toolagent";
    const error = "Request failed";

    // Listen for retry event
    document.addEventListener("scenario-retry", (event) => {
      expect(event.detail.messageId).toBe(messageId);
      expect(event.detail.subId).toBe(subId);
      expect(event.detail.agentType).toBe(agentType);
      done();
    });

    // Create scenario container and add error
    renderer.createScenarioContainer(messageId, "Test question?");
    renderer.addResult(messageId, subId, agentType, "", true, error);

    // Click retry button
    const resultSection = container.querySelector(`[data-sub-id="${subId}"]`);
    const retryButton = resultSection.querySelector(".retry-button");
    retryButton.click();
  });

  test("should update UI to show retrying state", () => {
    const messageId = "test-123";
    const subId = "sub-1";
    const agentType = "sqlagent";
    const error = "Timeout error";

    // Create scenario container and add error
    renderer.createScenarioContainer(messageId, "Test question?");
    renderer.addResult(messageId, subId, agentType, "", true, error);

    // Get the result section
    const resultSection = container.querySelector(`[data-sub-id="${subId}"]`);

    // Click retry button
    const retryButton = resultSection.querySelector(".retry-button");
    retryButton.click();

    // Check UI updated to retrying state
    const statusSpan = resultSection.querySelector(".result-status");
    const contentDiv = resultSection.querySelector(".result-content");
    const retryMessage = contentDiv.querySelector(".retry-message");

    expect(statusSpan.textContent).toBe("⏳");
    expect(statusSpan.className).toBe("result-status");
    expect(retryButton.style.display).toBe("none");
    expect(retryMessage).toBeTruthy();
    expect(retryMessage.textContent).toBe("Retrying...");
  });
});
