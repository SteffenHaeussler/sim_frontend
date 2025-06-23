class ChatApp {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.websocket = null;
        
        this.initializeElements();
        this.setupEventListeners();
        this.updateSessionId();
        this.loadConfig();
    }

    generateSessionId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    initializeElements() {
        this.sessionIdBottomElement = document.getElementById('session-id-bottom');
        this.messagesElement = document.getElementById('messages');
        this.questionInput = document.getElementById('question');
        this.sendButton = document.getElementById('send-btn');
        this.originalPlaceholder = this.questionInput.placeholder;
    }

    setupEventListeners() {
        this.sendButton.addEventListener('click', () => this.handleSendMessage());
        this.questionInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleSendMessage();
            }
        });
    }

    updateSessionId() {
        this.sessionIdBottomElement.textContent = this.sessionId;
    }

    async loadConfig() {
        try {
            const response = await fetch('/config');
            const config = await response.json();
            this.wsBase = config.agent_ws_base;
        } catch (error) {
            console.error('Failed to load configuration:', error);
        }
    }

    updateStatus(message) {
        // Replace placeholder text with spinner + status when processing
        if (message !== 'Ready') {
            this.questionInput.style.backgroundImage = 'url("data:image/svg+xml;charset=UTF-8,' + 
                encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4" fill="none" stroke="#666" stroke-width="1" stroke-dasharray="6.28" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" values="0 6 6;360 6 6" dur="1s" repeatCount="indefinite"/></circle></svg>') + '")';
            this.questionInput.style.backgroundRepeat = 'no-repeat';
            this.questionInput.style.backgroundPosition = '10px center';
            this.questionInput.style.paddingLeft = '30px';
            this.questionInput.placeholder = message;
        } else {
            this.questionInput.style.backgroundImage = 'none';
            this.questionInput.style.paddingLeft = '10px';
            this.questionInput.placeholder = this.originalPlaceholder;
        }
    }

    addMessage(content, isImage = false, isQuestion = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = isQuestion ? 'message question' : 'message';

        if (isImage) {
            const img = document.createElement('img');
            img.src = content;
            messageDiv.appendChild(img);
        } else {
            const p = document.createElement('p');
            p.textContent = content;
            messageDiv.appendChild(p);
        }

        this.messagesElement.appendChild(messageDiv);
        this.messagesElement.scrollTop = this.messagesElement.scrollHeight;
    }

    async triggerEvent(question) {
        const url = new URL('/answer', window.location.origin);
        url.searchParams.append('question', question);

        const response = await fetch(url.toString());
        const data = await response.json();
        this.sessionId = data.session_id;
        this.updateSessionId();
        return data;
    }

    async connectWebSocket() {
        if (this.websocket) {
            this.websocket.close();
        }

        const wsUrl = `${this.wsBase}?session_id=${this.sessionId}`;
        this.websocket = new WebSocket(wsUrl);
        
        this.websocket.onmessage = (event) => {
            const message = event.data;
            
            if (message.startsWith("event: ")) {
                // Handle status updates
                const statusText = message.replace("event: ", "").trim();
                if (statusText) {
                    this.updateStatus(statusText);
                }
                
                // Check for end event
                if (message.startsWith("event: end")) {
                    this.updateStatus('Ready');
                    if (this.websocket) {
                        this.websocket.close();
                    }
                }
            } else if (message.startsWith("data: ")) {
                const data = message.replace("data: ", "");
                const parts = data.split("$%$%Plot:");

                if (parts[0].trim()) {
                    this.addMessage(parts[0].trim());
                }

                if (parts.length > 1) {
                    const imageData = `data:image/png;base64,${parts[1].trim()}`;
                    this.addMessage(imageData, true);
                }
            }
        };

        this.websocket.onclose = () => {
            this.updateStatus('Ready');
            this.sendButton.disabled = false;
        };
    }

    async handleSendMessage() {
        const question = this.questionInput.value.trim();
        if (!question) return;

        this.sendButton.disabled = true;
        this.questionInput.value = '';
        this.addMessage(`Question: ${question}`, false, true);
        this.updateStatus('Processing...');

        try {
            await this.triggerEvent(question);
            await this.connectWebSocket();
        } catch (error) {
            console.error('Error:', error);
            this.updateStatus('Error');
            this.sendButton.disabled = false;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});