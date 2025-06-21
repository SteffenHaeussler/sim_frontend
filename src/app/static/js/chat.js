class ChatApp {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.websocket = null;
        this.isConnected = false;
        
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
        this.sessionIdElement = document.getElementById('session-id');
        this.statusElement = document.getElementById('status');
        this.messagesElement = document.getElementById('messages');
        this.questionInput = document.getElementById('question');
        this.sendButton = document.getElementById('send-btn');
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
        this.sessionIdElement.textContent = this.sessionId;
    }

    async loadConfig() {
        try {
            // Load environment variables from backend
            const response = await fetch('/config');
            const config = await response.json();
            console.log('Loaded config:', config);
            
            this.apiUrl = config.agent_api_base + config.agent_api_url;
            this.wsBase = config.agent_ws_base;
            
            console.log('API URL:', this.apiUrl);
            console.log('WebSocket Base:', this.wsBase);
            
            if (!this.apiUrl || this.apiUrl === 'undefined' || this.apiUrl === 'nullnull') {
                throw new Error('Invalid API URL configuration');
            }
        } catch (error) {
            console.error('Failed to load configuration:', error);
            this.updateStatus('Error: Failed to load configuration', 'error');
        }
    }

    updateStatus(message, type = 'info') {
        this.statusElement.textContent = `Status: ${message}`;
        this.statusElement.className = `status ${type}`;
    }

    addMessage(content, isImage = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';

        if (isImage) {
            const img = document.createElement('img');
            img.src = content;
            img.alt = 'Generated Plot';
            messageDiv.appendChild(img);
        } else {
            // Split content by lines and create paragraphs
            const lines = content.split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    const p = document.createElement('p');
                    p.textContent = line;
                    messageDiv.appendChild(p);
                }
            });
        }

        this.messagesElement.appendChild(messageDiv);
        this.messagesElement.scrollTop = this.messagesElement.scrollHeight;
    }

    async triggerEvent(question) {
        try {
            // Make request to local FastAPI backend /answer endpoint
            const url = new URL('/answer', window.location.origin);
            url.searchParams.append('question', question);

            console.log('Triggering request to:', url.toString());

            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                signal: AbortSignal.timeout(2000)
            });

            console.log('Trigger response status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('Trigger response data:', data);
                
                // Update session ID to match the one used by the backend
                this.sessionId = data.session_id;
                this.updateSessionId();
                
                return data;
            } else {
                throw new Error(`HTTP ${response.status}`);
            }

        } catch (error) {
            console.error('Trigger request failed:', error);
            this.updateStatus('Failed to trigger request', 'error');
            throw error;
        }
    }

    async connectWebSocket() {
        if (this.websocket) {
            this.websocket.close();
        }

        const wsUrl = `${this.wsBase}?session_id=${this.sessionId}`;
        
        try {
            this.websocket = new WebSocket(wsUrl);
            
            this.websocket.onopen = () => {
                this.isConnected = true;
                this.updateStatus('Connected to WebSocket', 'info');
            };

            this.websocket.onmessage = (event) => {
                this.handleWebSocketMessage(event.data);
            };

            this.websocket.onclose = () => {
                this.isConnected = false;
                this.updateStatus('WebSocket disconnected', 'ready');
                this.sendButton.disabled = false;
            };

            this.websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateStatus('WebSocket error occurred', 'error');
                this.sendButton.disabled = false;
            };

        } catch (error) {
            console.error('Failed to connect WebSocket:', error);
            this.updateStatus('Failed to connect WebSocket', 'error');
            this.sendButton.disabled = false;
        }
    }

    handleWebSocketMessage(message) {
        console.log('Received WebSocket message:', message);
        
        if (message.startsWith("event:")) {
            // Handle status updates - exactly like Streamlit version
            const statusText = message.replace("event: ", "").trim();
            if (statusText) {
                this.updateStatus(statusText, 'info');
                console.log('Status Update:', statusText);
            }

            // Check for end event
            if (message.startsWith("event: end")) {
                this.updateStatus('Processing complete', 'ready');
                if (this.websocket) {
                    this.websocket.close();
                }
            }
        } else if (message.startsWith("data: ")) {
            // Handle data messages
            const data = message.replace("data: ", "");
            const parts = data.split("$%$%Plot:");

            // Display text content
            if (parts[0].trim()) {
                this.addMessage(parts[0].trim());
            }

            // Display image if present
            if (parts.length > 1) {
                const base64Data = parts[1].trim();
                const imageData = `data:image/png;base64,${base64Data}`;
                this.addMessage(imageData, true);
            }
        }
    }

    async handleSendMessage() {
        const question = this.questionInput.value.trim();
        if (!question) return;

        // Disable send button and show loading state
        this.sendButton.disabled = true;
        this.sendButton.innerHTML = '<span class="loading"></span> Sending...';
        
        // Clear input
        this.questionInput.value = '';

        // Add user question to chat
        this.addMessage(`Question: ${question}`);

        // Update status to show processing
        this.updateStatus('Sending question to agent...', 'processing');

        try {
            // Trigger the API call
            await this.triggerEvent(question);
            
            // Update status
            this.updateStatus('Connecting to response stream...', 'info');
            
            // Connect to WebSocket to listen for responses
            await this.connectWebSocket();
            
        } catch (error) {
            console.error('Error sending message:', error);
            this.updateStatus('Error sending message', 'error');
            this.sendButton.disabled = false;
            this.sendButton.textContent = 'Answer question';
        }

        // Reset button text (will be re-enabled when WebSocket closes)
        this.sendButton.textContent = 'Answer question';
    }
}

// Initialize the chat app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});