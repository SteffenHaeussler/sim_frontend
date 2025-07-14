export class MessageRenderer {
  constructor(messagesElement, questionInput, sanitizer) {
    this.messagesElement = messagesElement;
    this.questionInput = questionInput;
    this.sanitizer = sanitizer;
    this.originalPlaceholder = questionInput ? questionInput.placeholder : "";
  }

  addMessage(content, isQuestion = false) {
    if (!this.messagesElement) return;

    const messageDiv = document.createElement("div");
    messageDiv.className = isQuestion ? "message question" : "message";

    if (isQuestion) {
      const p = document.createElement("p");
      p.textContent = content;
      messageDiv.appendChild(p);
    } else {
      marked.setOptions({
        breaks: true,
        gfm: true,
      });
      const parsedContent = marked.parse(content);
      messageDiv.innerHTML = this.sanitizer.sanitize(parsedContent);
    }

    this.messagesElement.appendChild(messageDiv);
    this.messagesElement.scrollTop = this.messagesElement.scrollHeight;

    return messageDiv;
  }

  updateStatus(message) {
    if (!this.questionInput) return;

    if (message !== "Ready") {
      this.questionInput.style.backgroundImage =
        'url("data:image/svg+xml;charset=UTF-8,' +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4" fill="none" stroke="#666" stroke-width="1" stroke-dasharray="6.28" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" values="0 6 6;360 6 6" dur="1s" repeatCount="indefinite"/></circle></svg>',
        ) +
        '")';
      this.questionInput.style.backgroundRepeat = "no-repeat";
      this.questionInput.style.backgroundPosition = "10px center";
      this.questionInput.style.paddingLeft = "30px";
      this.questionInput.placeholder = message;
    } else {
      this.questionInput.style.backgroundImage = "none";
      this.questionInput.style.paddingLeft = "10px";
      this.questionInput.placeholder = this.originalPlaceholder;
    }
  }

  clearMessages() {
    if (this.messagesElement) {
      this.messagesElement.innerHTML = "";
    }
  }

  scrollToBottom() {
    if (this.messagesElement) {
      this.messagesElement.scrollTop = this.messagesElement.scrollHeight;
    }
  }
}
