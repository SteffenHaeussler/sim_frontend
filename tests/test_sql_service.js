import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { JSDOM } from "jsdom";
import { AskSQLAgent } from "../src/app/core/static/js/sql-service.js";

// Mock dependencies
vi.mock("../src/app/core/static/js/html-sanitizer.js", () => ({
  htmlSanitizer: {
    sanitize: vi.fn((html) => html),
    escapeHtml: vi.fn((text) => text),
  },
}));

vi.mock("../src/app/core/static/js/websocket-handler.js", () => ({
  WebSocketHandler: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(),
    close: vi.fn(),
    isConnected: vi.fn().mockReturnValue(false),
    send: vi.fn(),
  })),
}));

// Mock marked library
global.marked = {
  setOptions: vi.fn(),
  parse: vi.fn((text) => `<p>${text}</p>`),
};

describe("AskSQLAgent", () => {
  let dom;
  let window;
  let document;
  let sqlAgent;
  let mockWebSocket;

  beforeEach(() => {
    // Set up DOM
    dom = new JSDOM(
      `
            <!DOCTYPE html>
            <html>
            <body>
                <div id="sql-messages"></div>
                <input id="sql-question" placeholder="Enter SQL query...">
                <button id="sql-send-btn">Send</button>
                <span id="sql-session-id-bottom"></span>
            </body>
            </html>
        `,
      { url: "http://localhost" },
    );

    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;
    global.WebSocket = vi.fn();
    global.navigator = { clipboard: { writeText: vi.fn() } };

    // Mock WebSocket
    mockWebSocket = {
      close: vi.fn(),
      send: vi.fn(),
      readyState: 1,
    };
    global.WebSocket.mockImplementation(() => mockWebSocket);

    // Mock window.app
    window.app = {
      sessionId: "test-session-456",
      wsBase: "ws://localhost:5062/ws",
      currentActiveService: "ask-sql-agent",
    };

    // Mock authAPI
    window.authAPI = {
      isLoggedIn: vi.fn().mockReturnValue(true),
      authenticatedFetch: vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({ status: "success" }),
      }),
    };

    // Initialize AskSQLAgent
    sqlAgent = new AskSQLAgent();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Initialization", () => {
    it("should initialize with correct elements", () => {
      expect(sqlAgent.messagesElement).toBe(
        document.getElementById("sql-messages"),
      );
      expect(sqlAgent.questionInput).toBe(
        document.getElementById("sql-question"),
      );
      expect(sqlAgent.sendButton).toBe(document.getElementById("sql-send-btn"));
      expect(sqlAgent.wsHandler).toBeNull();
    });

    it("should set up event listeners", () => {
      const sendButton = document.getElementById("sql-send-btn");
      const questionInput = document.getElementById("sql-question");

      // Test send button click
      const handleSpy = vi.spyOn(sqlAgent, "handleSendMessage");
      sendButton.click();
      expect(handleSpy).toHaveBeenCalled();

      // Test Enter key press
      handleSpy.mockClear();
      const enterEvent = new window.KeyboardEvent("keypress", { key: "Enter" });
      questionInput.dispatchEvent(enterEvent);
      expect(handleSpy).toHaveBeenCalled();
    });
  });

  describe("Message Handling", () => {
    it("should add question messages correctly", () => {
      sqlAgent.addMessage("Test question", false, true);

      const messages = document.querySelectorAll(".message");
      expect(messages.length).toBe(1);
      expect(messages[0].classList.contains("question")).toBe(true);
      expect(messages[0].textContent).toBe("Test question");
    });

    it("should add AI response messages with markdown", () => {
      sqlAgent.addMessage("**Bold text**");

      const messages = document.querySelectorAll(".message");
      expect(messages.length).toBe(1);
      expect(messages[0].classList.contains("question")).toBe(false);
      expect(marked.parse).toHaveBeenCalledWith("**Bold text**");
    });

    it("should add action buttons to AI responses", () => {
      sqlAgent.addMessage("AI response");

      const message = document.querySelector(".message");
      expect(message.querySelector(".copy-btn")).toBeTruthy();
      expect(message.querySelector(".thumbs-up-btn")).toBeTruthy();
      expect(message.querySelector(".thumbs-down-btn")).toBeTruthy();
    });

    it("should handle image messages", () => {
      const imageData = "data:image/png;base64,abc123";
      sqlAgent.addMessage(imageData, true);

      const img = document.querySelector(".message img");
      expect(img).toBeTruthy();
      expect(img.src).toBe(imageData);
    });
  });

  describe("WebSocket Communication", () => {
    it.skip("should connect to WebSocket with correct URL", async () => {
      await sqlAgent.connectWebSocket();

      expect(global.WebSocket).toHaveBeenCalledWith(
        "ws://localhost:5062/ws?session_id=test-session-456",
      );
      expect(sqlAgent.wsHandler).toBe(mockWebSocket);
    });

    it.skip("should handle WebSocket status events", async () => {
      const updateStatusSpy = vi.spyOn(sqlAgent, "updateStatus");

      await sqlAgent.connectWebSocket();
      mockWebSocket.onmessage({ data: "event: Processing..." });

      expect(updateStatusSpy).toHaveBeenCalledWith("Processing...");
    });

    it.skip("should handle WebSocket data with images", async () => {
      const addMessageSpy = vi.spyOn(sqlAgent, "addMessage");

      await sqlAgent.connectWebSocket();
      mockWebSocket.onmessage({
        data: "data: Text content$%$%Plot:base64imagedata",
      });

      expect(addMessageSpy).toHaveBeenCalledWith("Text content");
      expect(addMessageSpy).toHaveBeenCalledWith(
        "data:image/png;base64,base64imagedata",
        true,
      );
    });

    it.skip("should close WebSocket on end event", async () => {
      await sqlAgent.connectWebSocket();
      const closeSpy = vi.spyOn(mockWebSocket, "close");

      mockWebSocket.onmessage({ data: "event: end" });

      expect(closeSpy).toHaveBeenCalled();
    });
  });

  describe("Authentication", () => {
    it("should check authentication before sending", async () => {
      document.getElementById("sql-question").value = "Test query";

      await sqlAgent.handleSendMessage();

      expect(window.authAPI.isLoggedIn).toHaveBeenCalled();
    });

    it("should show login modal if not authenticated", async () => {
      window.authAPI.isLoggedIn.mockReturnValue(false);
      window.authUI = { showLoginModal: vi.fn() };
      document.getElementById("sql-question").value = "Test query";

      await sqlAgent.handleSendMessage();

      expect(window.authUI.showLoginModal).toHaveBeenCalledWith(
        "You need to be logged in to use the SQL Agent service.",
      );
    });

    it("should alert if authUI is not available", async () => {
      window.authAPI.isLoggedIn.mockReturnValue(false);
      window.authUI = undefined;
      global.alert = vi.fn();
      document.getElementById("sql-question").value = "Test query";

      await sqlAgent.handleSendMessage();

      expect(global.alert).toHaveBeenCalledWith(
        "Please log in to use the SQL Agent service.",
      );
    });
  });

  describe("Service Activation", () => {
    it("should only process messages when service is active", async () => {
      window.app.currentActiveService = "other-service";
      document.getElementById("sql-question").value = "Test query";

      await sqlAgent.handleSendMessage();

      expect(window.authAPI.authenticatedFetch).not.toHaveBeenCalled();
    });

    it("should process messages when service is active", async () => {
      window.app.currentActiveService = "ask-sql-agent";
      document.getElementById("sql-question").value = "Test query";

      await sqlAgent.handleSendMessage();

      expect(window.authAPI.authenticatedFetch).toHaveBeenCalled();
    });
  });

  describe("Action Buttons", () => {
    it("should copy message content", async () => {
      const button = document.createElement("button");
      button.innerHTML = '<img src="/static/icons/copy.svg">';

      await sqlAgent.copyMessage("Test content", button);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "Test content",
      );
      expect(button.querySelector("img").src).toContain("copy-active.svg");
      expect(button.disabled).toBe(true);
    });

    it("should handle clipboard fallback", async () => {
      navigator.clipboard = undefined;
      document.execCommand = vi.fn().mockReturnValue(true);

      const button = document.createElement("button");
      button.innerHTML = '<img src="/static/icons/copy.svg">';

      await sqlAgent.copyMessage("Test content", button);

      expect(document.execCommand).toHaveBeenCalledWith("copy");
    });

    it("should submit rating with correct data", async () => {
      const messageDiv = document.createElement("div");
      messageDiv.className = "message";
      messageDiv.setAttribute("data-event-id", "event-123");

      const actionsDiv = document.createElement("div");
      messageDiv.appendChild(actionsDiv);

      const upBtn = document.createElement("button");
      const downBtn = document.createElement("button");

      await sqlAgent.rateMessage("Content", "up", upBtn, downBtn, actionsDiv);

      expect(window.authAPI.authenticatedFetch).toHaveBeenCalledWith(
        expect.stringContaining("/ratings/submit"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("thumbs_up"),
        }),
      );

      expect(upBtn.disabled).toBe(true);
      expect(downBtn.style.display).toBe("none");
    });
  });

  describe("Session Management", () => {
    it("should handle new session correctly", () => {
      // Add some messages
      sqlAgent.addMessage("Test message");
      sqlAgent.wsHandler = mockWebSocket;

      sqlAgent.handleNewSession();

      expect(sqlAgent.messagesElement.innerHTML).toBe("");
      expect(sqlAgent.questionInput.value).toBe("");
      expect(mockWebSocket.close).toHaveBeenCalled();
      expect(sqlAgent.wsHandler).toBeNull();
    });

    it("should update session ID display", () => {
      sqlAgent.updateSessionId();

      const sessionIdElement = document.getElementById("sql-session-id-bottom");
      expect(sessionIdElement.textContent).toBe("test-session-456");
    });
  });

  describe("Template Handling", () => {
    it("should fill input with template text", () => {
      const templateText = "SELECT * FROM users";

      sqlAgent.handleTemplateClick(templateText);

      expect(sqlAgent.questionInput.value).toBe(templateText);
    });
  });

  describe("Status Updates", () => {
    it("should show loading spinner when processing", () => {
      sqlAgent.updateStatus("Processing...");

      expect(sqlAgent.questionInput.style.backgroundImage).toContain("svg");
      expect(sqlAgent.questionInput.placeholder).toBe("Processing...");
    });

    it("should clear loading spinner when ready", () => {
      sqlAgent.updateStatus("Processing...");
      sqlAgent.updateStatus("Ready");

      expect(sqlAgent.questionInput.style.backgroundImage).toBe("none");
      expect(sqlAgent.questionInput.placeholder).toBe("Enter SQL query...");
    });
  });

  describe("HTML Sanitization", () => {
    it("should sanitize AI response content", async () => {
      const { htmlSanitizer } = await import(
        "../src/app/core/static/js/html-sanitizer.js"
      );

      sqlAgent.addMessage('<script>alert("XSS")</script>Safe content');

      expect(htmlSanitizer.sanitize).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle trigger event errors", async () => {
      window.authAPI.authenticatedFetch.mockRejectedValueOnce(
        new Error("Network error"),
      );
      document.getElementById("sql-question").value = "Test query";

      await sqlAgent.handleSendMessage();

      const statusInput = document.getElementById("sql-question");
      expect(statusInput.placeholder).toBe("Error");
      expect(sqlAgent.sendButton.disabled).toBe(false);
    });

    it.skip("should handle WebSocket connection close", async () => {
      const updateStatusSpy = vi.spyOn(sqlAgent, "updateStatus");

      await sqlAgent.connectWebSocket();
      mockWebSocket.onclose();

      expect(updateStatusSpy).toHaveBeenCalledWith("Ready");
      expect(sqlAgent.sendButton.disabled).toBe(false);
    });
  });
});
