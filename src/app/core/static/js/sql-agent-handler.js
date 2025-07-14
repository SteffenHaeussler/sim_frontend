import { WebSocketHandler } from "./websocket-handler.js";

export class SqlAgentHandler {
  constructor(messagesElement, sanitizer) {
    this.messagesElement = messagesElement;
    this.sanitizer = sanitizer;
    this.sqlWebSocketHandlers = new Map();
  }

  async handleRequests(requests) {
    console.log("handleSQLAgentRequests called with:", requests);

    const containerDiv = this.createContainer(requests);
    this.messagesElement.appendChild(containerDiv);

    const requestsGrid = containerDiv.querySelector(".sql-requests-grid");
    const allCards = this.createAllCards(requests, requestsGrid);

    await this.processRequestsSequentially(allCards, containerDiv);

    this.messagesElement.scrollTop = this.messagesElement.scrollHeight;

    return containerDiv;
  }

  createContainer(requests) {
    const containerDiv = document.createElement("div");
    containerDiv.className = "sql-requests-container";

    containerDiv.innerHTML = `
            <div class="sql-requests-header">
                <h3>SQL Agent Requests (${requests.length} queries)</h3>
                <div class="sql-progress">
                    <span class="sql-completed">0</span> / <span class="sql-total">${requests.length}</span> completed
                </div>
            </div>
            <div class="sql-requests-grid"></div>
        `;

    return containerDiv;
  }

  createAllCards(requests, requestsGrid) {
    const allCards = [];

    for (let i = 0; i < requests.length; i++) {
      const request = requests[i];
      const requestCard = this.createRequestCard(request, i);
      requestsGrid.appendChild(requestCard);
      allCards.push({ request, card: requestCard });

      if (i > 0) {
        requestCard.classList.remove("pending");
        requestCard.classList.add("queued");
        requestCard.querySelector(".sql-status-icon").textContent = "⏸️";
        requestCard.querySelector(".sql-status-text").textContent = "Queued";
      }
    }

    return allCards;
  }

  async processRequestsSequentially(allCards, containerDiv) {
    for (let i = 0; i < allCards.length; i++) {
      const { request, card: requestCard } = allCards[i];

      if (requestCard.classList.contains("queued")) {
        requestCard.classList.remove("queued");
        requestCard.classList.add("pending");
        requestCard.querySelector(".sql-status-icon").textContent = "⏳";
        requestCard.querySelector(".sql-status-text").textContent = "Pending";
      }

      try {
        await this.executeRequest(request, requestCard, containerDiv);

        const completed = containerDiv.querySelectorAll(
          ".sql-request-card.completed",
        ).length;
        containerDiv.querySelector(".sql-completed").textContent = completed;

        if (i < allCards.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`Failed to process request ${i}:`, error);
      }
    }
  }

  createRequestCard(request, index) {
    const card = document.createElement("div");
    card.className = "sql-request-card pending";
    card.dataset.subId = request.sub_id;

    card.innerHTML = `
            <div class="sql-card-header">
                <div class="sql-card-title">
                    <span class="sql-sub-id">Query ${request.sub_id}</span>
                    <span class="sql-endpoint">${
                      request.endpoint || request.end_point
                    }</span>
                </div>
                <div class="sql-card-status">
                    <span class="sql-status-icon">⏳</span>
                    <span class="sql-status-text">Pending</span>
                </div>
            </div>
            <div class="sql-card-question">
                <strong>Question:</strong> ${this.escapeHtml(request.question)}
            </div>
            <div class="sql-card-result" style="display: none;">
                <div class="sql-result-content"></div>
            </div>
            <div class="sql-card-actions" style="display: none;">
                <button class="sql-action-btn sql-copy-btn" title="Copy to clipboard">
                    <img src="/static/icons/copy.svg" alt="Copy" width="16" height="16">
                </button>
                <button class="sql-action-btn sql-thumbs-up" title="Good response">
                    <img src="/static/icons/thumbs-up.svg" alt="Thumbs up" width="16" height="16">
                </button>
                <button class="sql-action-btn sql-thumbs-down" title="Poor response">
                    <img src="/static/icons/thumbs-down.svg" alt="Thumbs down" width="16" height="16">
                </button>
            </div>
            <div class="sql-card-footer" style="display: none;">
                <span class="sql-session-id"></span>
            </div>
        `;

    this.setupCardEventListeners(card, request);

    return card;
  }

  setupCardEventListeners(card, request) {
    const copyBtn = card.querySelector(".sql-copy-btn");
    const thumbsUpBtn = card.querySelector(".sql-thumbs-up");
    const thumbsDownBtn = card.querySelector(".sql-thumbs-down");

    copyBtn.addEventListener("click", () => {
      const content = card.querySelector(".sql-result-content").innerText;
      this.copyToClipboard(content, copyBtn);
    });

    thumbsUpBtn.addEventListener("click", () => {
      this.rateResponse(request, card, "up", thumbsUpBtn);
    });

    thumbsDownBtn.addEventListener("click", () => {
      this.rateResponse(request, card, "down", thumbsDownBtn);
    });
  }

  async executeRequest(request, card, container) {
    try {
      const uniqueSessionId = this.generateSessionId();
      card.dataset.sessionId = uniqueSessionId;

      const sessionIdElement = card.querySelector(".sql-session-id");
      const footerElement = card.querySelector(".sql-card-footer");
      sessionIdElement.textContent = uniqueSessionId;
      footerElement.style.display = "block";

      card.classList.remove("pending");
      card.classList.add("processing");
      card.querySelector(".sql-status-icon").textContent = "🔄";
      card.querySelector(".sql-status-text").textContent = "Processing";

      const endpoint = "/sqlagent";
      const url = new URL(endpoint, window.location.origin);
      url.searchParams.append("question", request.question);
      url.searchParams.append("session_id", uniqueSessionId);

      const headers = {
        "Content-Type": "application/json",
        "x-session-id": uniqueSessionId,
      };

      const response = await window.authAPI.authenticatedFetch(url.toString(), {
        headers: headers,
      });

      const data = await response.json();

      await this.connectWebSocket(request, card, uniqueSessionId);
    } catch (error) {
      console.error(
        `Error executing SQL agent request ${request.sub_id}:`,
        error,
      );

      card.classList.remove("pending", "processing");
      card.classList.add("error");
      card.querySelector(".sql-status-icon").textContent = "❌";
      card.querySelector(".sql-status-text").textContent = "Error";

      const resultDiv = card.querySelector(".sql-card-result");
      const contentDiv = resultDiv.querySelector(".sql-result-content");
      contentDiv.innerHTML = `<div class="sql-error-message">Error: ${this.sanitizer.escapeHtml(
        error.message,
      )}</div>`;
      resultDiv.style.display = "block";

      const actionsDiv = card.querySelector(".sql-card-actions");
      if (actionsDiv) {
        actionsDiv.style.display = "flex";
      }
    }
  }

  async connectWebSocket(request, card, uniqueSessionId) {
    return new Promise((resolve, reject) => {
      const wsBase = window.app ? window.app.wsBase : "ws://localhost:5055/ws";
      const wsUrl = `${wsBase}?session_id=${uniqueSessionId}`;

      console.log(
        `Connecting WebSocket for ${request.sub_id} with session: ${uniqueSessionId}`,
      );

      let responseContent = "";

      const sqlWsHandler = new WebSocketHandler({
        maxRetries: 2,
        baseDelay: 500,
        preserveDataLineBreaks: false,
        onMessage: (data, type) => {
          if (type === "data" || type === "raw") {
            responseContent += data + "\n";
            console.log(
              `Added data to responseContent for ${request.sub_id}:`,
              data,
            );
          }
        },
        onStatusUpdate: (status) => {
          if (status && status !== "end") {
            card.querySelector(".sql-status-text").textContent = status;
          }

          if (status === "end") {
            card.classList.remove("pending", "processing");
            card.classList.add("completed");
            card.querySelector(".sql-status-icon").textContent = "✅";
            card.querySelector(".sql-status-text").textContent = "Completed";

            const resultDiv = card.querySelector(".sql-card-result");
            const contentDiv = resultDiv.querySelector(".sql-result-content");

            console.log(
              `Final responseContent for ${request.sub_id}:`,
              responseContent,
            );
            marked.setOptions({
              breaks: true,
              gfm: true,
            });
            const parsedResponse = marked.parse(responseContent);
            contentDiv.innerHTML = this.sanitizer.sanitize(parsedResponse);
            resultDiv.style.display = "block";

            const actionsDiv = card.querySelector(".sql-card-actions");
            if (actionsDiv) {
              actionsDiv.style.display = "flex";
            }

            this.sqlWebSocketHandlers.delete(uniqueSessionId);
            resolve();
          }
        },
        onError: (error) => {
          console.error(`WebSocket error for ${request.sub_id}:`, error);
          this.sqlWebSocketHandlers.delete(uniqueSessionId);
          reject(error);
        },
        onClose: (event) => {
          if (!card.classList.contains("completed")) {
            this.sqlWebSocketHandlers.delete(uniqueSessionId);
            reject(new Error("WebSocket closed unexpectedly"));
          }
        },
      });

      this.sqlWebSocketHandlers.set(uniqueSessionId, sqlWsHandler);

      sqlWsHandler.connect(wsUrl).catch((error) => {
        this.sqlWebSocketHandlers.delete(uniqueSessionId);
        reject(error);
      });
    });
  }

  async copyToClipboard(content, button) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = content;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
          document.execCommand("copy");
        } catch (err) {
          console.error("Failed to copy:", err);
        }

        document.body.removeChild(textArea);
      }

      button.querySelector("img").src = "/static/icons/copy-active.svg";
      button.disabled = true;
      button.title = "Copied!";
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  }

  async rateResponse(request, card, rating, button) {
    try {
      const content = card.querySelector(".sql-result-content").innerText;
      const sessionId =
        card.querySelector(".sql-session-id")?.textContent ||
        window.app?.sessionId;

      const ratingType = rating === "up" ? "thumbs_up" : "thumbs_down";

      const ratingsUrl = new URL("/ratings/submit", window.location.origin);
      if (sessionId) {
        ratingsUrl.searchParams.append("session_id", sessionId);
      }

      const response = await window.authAPI.authenticatedFetch(
        ratingsUrl.toString(),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rating_type: ratingType,
            session_id: sessionId,
            event_id: request.sub_id,
            message_context: content.substring(0, 500),
            feedback_text: null,
          }),
        },
      );

      if (response.ok) {
        const activeIcon =
          rating === "up"
            ? "/static/icons/thumbs-up-active.svg"
            : "/static/icons/thumbs-down-active.svg";
        button.querySelector("img").src = activeIcon;
        button.disabled = true;
        button.title = `Rated as ${rating === "up" ? "good" : "poor"}`;

        const otherButton =
          rating === "up"
            ? card.querySelector(".sql-thumbs-down")
            : card.querySelector(".sql-thumbs-up");
        otherButton.style.display = "none";
      }
    } catch (error) {
      console.error("Failed to submit rating:", error);
    }
  }

  generateSessionId() {
    return "sql-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);
  }

  escapeHtml(text) {
    return this.sanitizer.escapeHtml(text);
  }

  cleanup() {
    this.sqlWebSocketHandlers.forEach((handler) => {
      handler.close();
    });
    this.sqlWebSocketHandlers.clear();
  }
}
