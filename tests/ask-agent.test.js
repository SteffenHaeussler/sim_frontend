import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { loadScript } from "./helpers/load-script.js";

describe("AskAgent", () => {
  let window;
  let askAgent;

  beforeEach(() => {
    localStorage.clear();
    global.fetch = vi.fn();
    vi.clearAllMocks();
    vi.restoreAllMocks();

    // Mock WebSocket
    global.WebSocket = vi.fn().mockImplementation(() => ({
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      readyState: 1,
    }));

    // Mock global dependencies
    global.marked = {
      setOptions: vi.fn(),
      parse: vi.fn((content) => `<p>${content}</p>`),
    };

    // Mock clipboard API
    global.navigator = {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    };

    // Load Ask Agent service (mock version for testing)
    window = loadScript("tests/helpers/mock-ask-agent.js");

    // Set up DOM in the window's document
    const messagesDiv = window.document.createElement("div");
    messagesDiv.id = "messages";
    window.document.body.appendChild(messagesDiv);

    const questionInput = window.document.createElement("input");
    questionInput.id = "question";
    questionInput.placeholder = "Ask a question...";
    window.document.body.appendChild(questionInput);

    const sendBtn = window.document.createElement("button");
    sendBtn.id = "send-btn";
    sendBtn.textContent = "Send";
    window.document.body.appendChild(sendBtn);

    // Add marked to window
    window.marked = global.marked;

    // Mock window.alert
    window.alert = vi.fn();

    // Mock document.execCommand for clipboard fallback
    window.document.execCommand = vi.fn().mockReturnValue(true);

    // Add navigator to window
    window.navigator.clipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    };

    // Set active service to ask-agent
    window.app = {
      currentActiveService: "ask-agent",
      activeService: "ask-agent",
      getTrackingHeaders: vi.fn().mockReturnValue({}),
      sessionId: "test-session-123",
    };

    // Mock authAPI
    window.authAPI = {
      isLoggedIn: vi.fn().mockReturnValue(true),
      authenticatedFetch: vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      }),
    };

    // Trigger DOMContentLoaded to create the instance
    const event = new window.Event("DOMContentLoaded", {
      bubbles: true,
      cancelable: true,
    });
    window.document.dispatchEvent(event);

    // The script creates window.askAgent instance on DOMContentLoaded
    askAgent = window.askAgent;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (askAgent && askAgent.wsHandler) {
      askAgent.wsHandler.close();
    }
  });

  describe("initialization", () => {
    it("should initialize DOM elements", () => {
      expect(askAgent.messagesElement).toBeTruthy();
      expect(askAgent.questionInput).toBeTruthy();
      expect(askAgent.sendButton).toBeTruthy();
      expect(askAgent.originalPlaceholder).toBe("Ask a question...");
    });

    it("should set up event listeners", () => {
      const handleSendSpy = vi
        .spyOn(askAgent, "handleSendMessage")
        .mockImplementation(() => {});

      // Test button click
      askAgent.sendButton.click();
      expect(handleSendSpy).toHaveBeenCalled();

      // Test enter key
      handleSendSpy.mockClear();
      const enterEvent = new KeyboardEvent("keypress", { key: "Enter" });
      askAgent.questionInput.dispatchEvent(enterEvent);
      expect(handleSendSpy).toHaveBeenCalled();
    });
  });

  describe("generateEventId", () => {
    it("should generate valid UUID format", () => {
      const eventId = askAgent.generateEventId();
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
      expect(eventId).toMatch(uuidRegex);
    });

    it("should generate unique IDs", () => {
      const id1 = askAgent.generateEventId();
      const id2 = askAgent.generateEventId();
      expect(id1).not.toBe(id2);
    });
  });

  describe("updateStatus", () => {
    it("should show spinner and status message when processing", () => {
      askAgent.updateStatus("Processing query...");

      expect(askAgent.questionInput.placeholder).toBe("Processing query...");
      expect(askAgent.questionInput.style.backgroundImage).toContain("svg");
      expect(askAgent.questionInput.style.paddingLeft).toBe("30px");
    });

    it("should reset to original state when ready", () => {
      askAgent.updateStatus("Processing...");
      askAgent.updateStatus("Ready");

      expect(askAgent.questionInput.placeholder).toBe("Ask a question...");
      expect(askAgent.questionInput.style.backgroundImage).toBe("none");
      expect(askAgent.questionInput.style.paddingLeft).toBe("10px");
    });
  });

  describe("addMessage", () => {
    it("should add user question message", () => {
      askAgent.addMessage("What is the total revenue?", false, true);

      const messages = askAgent.messagesElement.querySelectorAll(".message");
      expect(messages.length).toBe(1);
      expect(messages[0].classList.contains("question")).toBe(true);
      expect(messages[0].textContent).toBe("What is the total revenue?");
    });

    it("should add AI response with markdown", () => {
      askAgent.addMessage("The **total revenue** is $1M", false, false);

      const messages = askAgent.messagesElement.querySelectorAll(".message");
      expect(messages.length).toBe(1);
      expect(global.marked.parse).toHaveBeenCalledWith(
        "The **total revenue** is $1M",
      );
      expect(messages[0].innerHTML).toContain(
        "<p>The **total revenue** is $1M</p>",
      );
    });

    it("should add action buttons to AI responses", () => {
      askAgent.addMessage("Response text", false, false);

      const message = askAgent.messagesElement.querySelector(".message");
      expect(message.querySelector(".copy-btn")).toBeTruthy();
      expect(message.querySelector(".thumbs-up-btn")).toBeTruthy();
      expect(message.querySelector(".thumbs-down-btn")).toBeTruthy();
    });

    it("should add image message", () => {
      askAgent.addMessage("data:image/png;base64,test", true, false);

      const img = askAgent.messagesElement.querySelector("img");
      expect(img).toBeTruthy();
      expect(img.src).toBe("data:image/png;base64,test");
    });

    it("should generate and store event ID for AI messages", () => {
      askAgent.addMessage("AI response", false, false);

      const message = askAgent.messagesElement.querySelector(".message");
      const eventId = message.getAttribute("data-event-id");
      expect(eventId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(askAgent.messageEventIds.has(message)).toBe(true);
    });
  });

  describe("copyMessage", () => {
    it("should copy message to clipboard using modern API", async () => {
      const button = document.createElement("button");
      button.innerHTML = '<img src="/static/icons/copy.svg" alt="Copy">';

      await askAgent.copyMessage("Test content", button);

      expect(window.navigator.clipboard.writeText).toHaveBeenCalledWith(
        "Test content",
      );
      expect(button.innerHTML).toContain("copy-active.svg");
      expect(button.disabled).toBe(true);
    });

    it("should use fallback method when clipboard API not available", async () => {
      window.navigator.clipboard = undefined;
      const fallbackSpy = vi
        .spyOn(askAgent, "copyToClipboardFallback")
        .mockImplementation(() => {});
      const button = document.createElement("button");

      await askAgent.copyMessage("Test content", button);

      expect(fallbackSpy).toHaveBeenCalledWith("Test content");
    });
  });

  describe("WebSocket connection", () => {
    it("should connect to WebSocket when sending message", async () => {
      askAgent.questionInput.value = "Test question";
      await askAgent.handleSendMessage();

      // Check that the authenticatedFetch was called
      expect(window.authAPI.authenticatedFetch).toHaveBeenCalled();
      const callArgs = window.authAPI.authenticatedFetch.mock.calls[0];

      // Check the URL contains the question parameter
      expect(callArgs[0]).toContain("/agent");
      expect(callArgs[0]).toContain("question=Test");

      // Check headers are present
      expect(callArgs[1].headers).toHaveProperty(
        "Content-Type",
        "application/json",
      );
    });

    it("should handle WebSocket errors", async () => {
      // Mock authenticated fetch to fail
      window.authAPI.authenticatedFetch.mockRejectedValueOnce(
        new Error("Network error"),
      );
      const addMessageSpy = vi.spyOn(askAgent, "addMessage");
      const updateStatusSpy = vi.spyOn(askAgent, "updateStatus");

      askAgent.questionInput.value = "Test question";
      await askAgent.handleSendMessage();

      // First it adds the question
      expect(addMessageSpy).toHaveBeenCalledWith(
        "Question: Test question",
        false,
        true,
      );

      // Then it should update status to Error
      expect(updateStatusSpy).toHaveBeenCalledWith("Error");

      // And the send button should be re-enabled
      expect(askAgent.sendButton.disabled).toBe(false);
    });
  });

  describe("message rating", () => {
    it("should send rating feedback", async () => {
      window.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "success" }),
      });

      const content = "Test message";
      const upBtn = document.createElement("button");
      const downBtn = document.createElement("button");
      const actionsDiv = document.createElement("div");

      await askAgent.rateMessage(content, "up", upBtn, downBtn, actionsDiv);

      expect(window.authAPI.authenticatedFetch).toHaveBeenCalledWith(
        expect.stringContaining("/ratings/submit"),
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: expect.stringContaining("thumbs_up"),
        }),
      );
    });
  });

  describe("reset", () => {
    it("should clear messages and reset state", () => {
      // Add some messages
      askAgent.addMessage("Question", false, true);
      askAgent.addMessage("Answer", false, false);
      askAgent.questionInput.value = "Test";

      askAgent.handleNewSession();

      expect(askAgent.messagesElement.innerHTML).toBe("");
      expect(askAgent.questionInput.value).toBe("");
      expect(askAgent.questionInput.disabled).toBe(false);
      expect(askAgent.sendButton.disabled).toBe(false);
    });

    it("should close WebSocket connection on reset", () => {
      const mockClose = vi.fn();
      askAgent.wsHandler = { close: mockClose };

      askAgent.handleNewSession();

      expect(mockClose).toHaveBeenCalled();
      expect(askAgent.wsHandler).toBeNull();
    });
  });

  describe("input validation", () => {
    it("should not send empty messages", async () => {
      const triggerEventSpy = vi.spyOn(askAgent, "triggerEvent");

      askAgent.questionInput.value = "   ";
      await askAgent.handleSendMessage();

      expect(triggerEventSpy).not.toHaveBeenCalled();
      expect(window.authAPI.authenticatedFetch).not.toHaveBeenCalled();
    });

    it("should trim whitespace from messages", async () => {
      askAgent.questionInput.value = "  Test question  ";
      await askAgent.handleSendMessage();

      // Check that authenticatedFetch was called
      expect(window.authAPI.authenticatedFetch).toHaveBeenCalled();
      const callArgs = window.authAPI.authenticatedFetch.mock.calls[0];

      // Check the URL contains the trimmed question
      expect(callArgs[0]).toContain("/agent");
      expect(callArgs[0]).toContain("question=Test");
      // Should not contain leading/trailing spaces encoded
      expect(callArgs[0]).not.toContain("question=%20%20Test");
    });
  });
});
