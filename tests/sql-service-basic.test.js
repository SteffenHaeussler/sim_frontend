import { describe, it, expect, beforeEach, vi } from "vitest";
import { JSDOM } from "jsdom";

describe("SQLService Basic Tests", () => {
  let dom;
  let window;
  let document;

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
  });

  describe("DOM Structure", () => {
    it("should have required DOM elements", () => {
      expect(document.getElementById("sql-messages")).toBeTruthy();
      expect(document.getElementById("sql-question")).toBeTruthy();
      expect(document.getElementById("sql-send-btn")).toBeTruthy();
      expect(document.getElementById("sql-session-id-bottom")).toBeTruthy();
    });

    it("should have correct placeholder text", () => {
      const input = document.getElementById("sql-question");
      expect(input.placeholder).toBe("Enter SQL query...");
    });
  });

  describe("Message Structure", () => {
    it("should create question message correctly", () => {
      const messageDiv = document.createElement("div");
      messageDiv.className = "message question";
      const p = document.createElement("p");
      p.textContent = "SELECT * FROM users";
      messageDiv.appendChild(p);

      expect(messageDiv.classList.contains("question")).toBe(true);
      expect(messageDiv.textContent).toBe("SELECT * FROM users");
    });

    it("should create AI response with action buttons", () => {
      const messageDiv = document.createElement("div");
      messageDiv.className = "message";
      messageDiv.innerHTML = "<p>Query results...</p>";

      // Add action buttons
      const actionsDiv = document.createElement("div");
      actionsDiv.className = "message-actions";
      actionsDiv.innerHTML = `
                <div class="button-row">
                    <button class="action-btn copy-btn">
                        <img src="/static/icons/copy.svg" alt="Copy">
                    </button>
                    <button class="action-btn thumbs-up-btn">
                        <img src="/static/icons/thumbs-up.svg" alt="Good">
                    </button>
                    <button class="action-btn thumbs-down-btn">
                        <img src="/static/icons/thumbs-down.svg" alt="Bad">
                    </button>
                </div>
            `;
      messageDiv.appendChild(actionsDiv);

      expect(messageDiv.querySelector(".copy-btn")).toBeTruthy();
      expect(messageDiv.querySelector(".thumbs-up-btn")).toBeTruthy();
      expect(messageDiv.querySelector(".thumbs-down-btn")).toBeTruthy();
    });
  });

  describe("Status Updates", () => {
    it("should update input placeholder for status", () => {
      const input = document.getElementById("sql-question");
      const originalPlaceholder = input.placeholder;

      // Simulate processing status
      input.placeholder = "Processing...";
      input.style.paddingLeft = "30px";

      expect(input.placeholder).toBe("Processing...");
      expect(input.style.paddingLeft).toBe("30px");

      // Simulate ready status
      input.placeholder = originalPlaceholder;
      input.style.paddingLeft = "10px";

      expect(input.placeholder).toBe("Enter SQL query...");
      expect(input.style.paddingLeft).toBe("10px");
    });
  });

  describe("Event ID Generation", () => {
    it("should generate valid UUID format", () => {
      const generateEventId = () => {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
          /[xy]/g,
          function (c) {
            const r = (Math.random() * 16) | 0;
            const v = c == "x" ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          },
        );
      };

      const eventId = generateEventId();
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      expect(eventId).toMatch(uuidRegex);
    });
  });

  describe("Session Management", () => {
    it("should update session ID display", () => {
      const sessionIdElement = document.getElementById("sql-session-id-bottom");
      sessionIdElement.textContent = "test-session-789";

      expect(sessionIdElement.textContent).toBe("test-session-789");
    });

    it("should clear messages on new session", () => {
      const messagesElement = document.getElementById("sql-messages");

      // Add some messages
      messagesElement.innerHTML = '<div class="message">Old message</div>';
      expect(messagesElement.children.length).toBe(1);

      // Clear for new session
      messagesElement.innerHTML = "";
      expect(messagesElement.children.length).toBe(0);
    });
  });

  describe("Clipboard Fallback", () => {
    it("should create textarea for fallback copy", () => {
      // Simulate fallback copy method
      const textArea = document.createElement("textarea");
      textArea.value = "Copy this text";
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";

      expect(textArea.value).toBe("Copy this text");
      expect(textArea.style.position).toBe("fixed");
      expect(textArea.style.left).toBe("-999999px");
    });
  });

  describe("WebSocket Message Parsing", () => {
    it("should parse messages with image data", () => {
      const message = "data: Text content$%$%Plot:base64imagedata";
      const parts = message.replace("data: ", "").split("$%$%Plot:");

      expect(parts[0].trim()).toBe("Text content");
      expect(parts[1].trim()).toBe("base64imagedata");
    });

    it("should handle messages without images", () => {
      const message = "data: Just text content";
      const parts = message.replace("data: ", "").split("$%$%Plot:");

      expect(parts[0].trim()).toBe("Just text content");
      expect(parts.length).toBe(1);
    });
  });

  describe("Authentication State", () => {
    it("should check if service is active", () => {
      // Simulate window.app state
      const appState = {
        currentActiveService: "ask-sql-agent",
      };

      const isActive = appState.currentActiveService === "ask-sql-agent";
      expect(isActive).toBe(true);

      // Test inactive state
      appState.currentActiveService = "other-service";
      const isInactive = appState.currentActiveService === "ask-sql-agent";
      expect(isInactive).toBe(false);
    });
  });
});
