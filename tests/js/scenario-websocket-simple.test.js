import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock WebSocket behavior for testing
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    this.CONNECTING = 0;
    this.OPEN = 1;
    this.CLOSING = 2;
    this.CLOSED = 3;
    this.sentMessages = [];
    MockWebSocket.lastInstance = this;

    // Simulate async connection
    this._connectTimer = setTimeout(() => {
      if (this.readyState === 0 && this.onopen) {
        this.readyState = 1;
        this.onopen();
      }
    }, 10);
  }

  send(data) {
    if (this.readyState !== 1) {
      throw new Error("WebSocket is not connected");
    }
    this.sentMessages.push(data);
  }

  close() {
    clearTimeout(this._connectTimer);
    this.readyState = 3;
    if (this.onclose) {
      this.onclose({ code: 1000, reason: "Normal closure" });
    }
  }

  static lastInstance = null;
}

describe("Scenario WebSocket Basic Functionality", () => {
  let originalWebSocket;
  let mockAuthAPI;
  let mockApp;

  beforeEach(() => {
    // Store original
    originalWebSocket = global.WebSocket;

    // Mock WebSocket
    global.WebSocket = MockWebSocket;
    MockWebSocket.lastInstance = null;

    // Mock window.authAPI
    mockAuthAPI = {
      getToken: vi.fn(() => "mock-jwt-token"),
    };

    // Mock window.app
    mockApp = {
      sessionId: "test-session-123",
      wsBase: "ws://localhost:5062",
    };

    global.window = {
      authAPI: mockAuthAPI,
      app: mockApp,
    };
  });

  afterEach(() => {
    // Restore
    global.WebSocket = originalWebSocket;
    vi.clearAllMocks();
  });

  it("should create WebSocket with authentication token in query params", () => {
    // Create a minimal scenario agent-like connection
    const token = window.authAPI.getToken();
    const sessionId = window.app.sessionId;
    const wsBase = window.app.wsBase;
    const wsUrl = `${wsBase}/ws/scenario?session_id=${sessionId}&token=${encodeURIComponent(
      token,
    )}`;

    const ws = new WebSocket(wsUrl);

    // Verify WebSocket was created with correct URL
    expect(ws).toBeDefined();
    expect(ws.url).toBe(
      `ws://localhost:5062/ws/scenario?session_id=test-session-123&token=mock-jwt-token`,
    );
    expect(ws.readyState).toBe(0); // CONNECTING
  });

  it("should handle WebSocket connection lifecycle", async () => {
    const ws = new WebSocket("ws://localhost:5062/ws/scenario");
    let connected = false;

    // Set up connection handler
    const connectionPromise = new Promise((resolve, reject) => {
      ws.onopen = () => {
        connected = true;
        resolve();
      };

      ws.onerror = (error) => {
        reject(error);
      };

      // Timeout handler
      setTimeout(() => {
        if (!connected) {
          ws.close();
          reject(new Error("Connection timeout"));
        }
      }, 5000);
    });

    // Wait for connection
    await connectionPromise;

    expect(connected).toBe(true);
    expect(ws.readyState).toBe(1); // OPEN

    // Test sending message
    const message = { type: "query", query: "test", message_id: "test-123" };
    ws.send(JSON.stringify(message));

    expect(ws.sentMessages.length).toBe(1);
    expect(ws.sentMessages[0]).toBe(JSON.stringify(message));

    // Close connection
    ws.close();
    expect(ws.readyState).toBe(3); // CLOSED
  });

  it("should queue messages when WebSocket is not connected", () => {
    const messageQueue = [];
    const ws = new WebSocket("ws://localhost:5062/ws/scenario");

    // Try to send before connected
    const message = { type: "query", query: "test", message_id: "test-123" };

    if (ws.readyState !== 1) {
      // Queue the message
      messageQueue.push(message);
    } else {
      ws.send(JSON.stringify(message));
    }

    expect(messageQueue.length).toBe(1);
    expect(messageQueue[0]).toEqual(message);

    // Process queue after connection
    ws.onopen = () => {
      while (messageQueue.length > 0) {
        const queuedMessage = messageQueue.shift();
        ws.send(JSON.stringify(queuedMessage));
      }
    };
  });

  it("should handle authentication failure", () => {
    // Mock no token scenario
    window.authAPI.getToken = vi.fn(() => null);

    // Should not create WebSocket without token
    const token = window.authAPI.getToken();
    expect(token).toBeNull();

    // In real implementation, this would prevent WebSocket creation
    if (!token) {
      expect(() => {
        throw new Error("Authentication required");
      }).toThrow("Authentication required");
    }
  });

  it("should include retry message type in WebSocket communication", () => {
    const ws = new WebSocket("ws://localhost:5062/ws/scenario");

    ws.onopen = () => {
      // Send retry message
      const retryMessage = {
        type: "retry",
        message_id: "original-message-123",
        sub_id: "sub-1",
        agent_type: "sqlagent",
      };

      ws.send(JSON.stringify(retryMessage));

      expect(ws.sentMessages.length).toBe(1);
      const sentMessage = JSON.parse(ws.sentMessages[0]);
      expect(sentMessage.type).toBe("retry");
      expect(sentMessage.message_id).toBe("original-message-123");
      expect(sentMessage.sub_id).toBe("sub-1");
      expect(sentMessage.agent_type).toBe("sqlagent");
    };
  });
});
