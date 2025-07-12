class ScenarioAgent {
    constructor() {
        this.websocket = null;
        this.initializeElements();
        this.setupEventListeners();
    }

    initializeElements() {
        this.messagesElement = document.getElementById('messages');
        this.questionInput = document.getElementById('question');
        this.sendButton = document.getElementById('send-btn');
        this.originalPlaceholder = this.questionInput ? this.questionInput.placeholder : '';
    }

    setupEventListeners() {
        if (this.sendButton) {
            this.sendButton.addEventListener('click', () => this.handleSendMessage());
        }

        if (this.questionInput) {
            this.questionInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleSendMessage();
                }
            });
        }
    }

    updateStatus(message) {
        if (!this.questionInput) return;

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

    addMessage(content, isQuestion = false) {
        if (!this.messagesElement) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = isQuestion ? 'message question' : 'message';

        if (isQuestion) {
            const p = document.createElement('p');
            p.textContent = content;
            messageDiv.appendChild(p);
        } else {
            // Render AI responses as markdown
            marked.setOptions({
                breaks: true,
                gfm: true
            });
            messageDiv.innerHTML = marked.parse(content);
        }

        this.messagesElement.appendChild(messageDiv);
        this.messagesElement.scrollTop = this.messagesElement.scrollHeight;
    }

    async triggerEvent(question) {
        const endpoint = '/scenario';
        const url = new URL(endpoint, window.location.origin);
        url.searchParams.append('question', question);

        const headers = {
            'Content-Type': 'application/json'
        };

        if (window.app && window.app.sessionId) {
            url.searchParams.append('session_id', window.app.sessionId);
            headers['x-session-id'] = window.app.sessionId;
        }

        const response = await window.authAPI.authenticatedFetch(url.toString(), {
            headers: headers
        });

        const data = await response.json();
        return data;
    }

    async connectWebSocket() {
        if (this.websocket) {
            this.websocket.close();
        }

        // Connect DIRECTLY to the external agent WebSocket (exactly like ask-agent.js)
        const sessionId = window.app ? window.app.sessionId : '';
        const wsBase = window.app ? window.app.wsBase : 'ws://localhost:5055/ws';
        const wsUrl = `${wsBase}?session_id=${sessionId}`;
        
        console.log('Scenario WebSocket URL:', wsUrl);
        this.websocket = new WebSocket(wsUrl);

        this.websocket.onmessage = (event) => {
            const message = event.data;
            console.log('Scenario WebSocket received:', message);

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
                const data = message.replace("data: ", "").trim();
                if (data) {
                    this.addMessage(data);
                }
            }
        };

        this.websocket.onclose = () => {
            this.updateStatus('Ready');
            if (this.sendButton) {
                this.sendButton.disabled = false;
            }
        };

        this.websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateStatus('Connection error');
        };
    }

    async handleSendMessage() {
        const question = this.questionInput.value.trim();
        if (!question) return;

        this.sendButton.disabled = true;
        this.questionInput.value = '';

        // Add user question
        this.addMessage(`Question: ${question}`, true);
        this.updateStatus('Processing...');

        try {
            // First trigger the HTTP endpoint
            await this.triggerEvent(question);
            
            // Then connect to external agent WebSocket directly
            await this.connectWebSocket();
            
        } catch (error) {
            console.error('Error:', error);
            this.updateStatus('Error');
            this.sendButton.disabled = false;
        }
    }

    handleNewSession() {
        // Clear all messages
        if (this.messagesElement) {
            this.messagesElement.innerHTML = '';
        }
        
        // Clear input field
        if (this.questionInput) {
            this.questionInput.value = '';
        }
        
        // Reset status
        this.updateStatus('Ready');
        
        // Close WebSocket
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
        
        // Re-enable send button
        if (this.sendButton) {
            this.sendButton.disabled = false;
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.scenarioAgent = new ScenarioAgent();
});