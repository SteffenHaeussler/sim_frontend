import { ScenarioMessageGrouper } from './scenario-message-grouper.js';
import { ScenarioUIRenderer } from './scenario-ui-renderer.js';

// WebSocket connection states
const ConnectionState = {
    DISCONNECTED: 'DISCONNECTED',
    CONNECTING: 'CONNECTING',
    CONNECTED: 'CONNECTED',
    DISCONNECTING: 'DISCONNECTING'
};

class ScenarioAgent {
    constructor() {
        this.websocket = null;
        this.connectionState = ConnectionState.DISCONNECTED;
        this.messageQueue = [];
        this.messageEventIds = new Map();
        this.messageGrouper = new ScenarioMessageGrouper();
        this.maxMessageHistory = 100; // Limit message history
        
        // Reconnection settings
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.baseReconnectDelay = 1000; // 1 second
        this.maxReconnectDelay = 30000; // 30 seconds
        this.reconnectTimer = null;
        this.shouldReconnect = true;
        
        this.initializeElements();
        this.uiRenderer = new ScenarioUIRenderer(this.messagesElement);
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

        // Listen for retry events
        document.addEventListener('scenario-retry', (event) => {
            this.handleRetryRequest(event.detail);
        });
    }

    generateEventId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    generateMessageId() {
        return 'scenario-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
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

    createScenarioContainer(messageId, userQuestion) {
        return this.uiRenderer.createScenarioContainer(messageId, userQuestion);
    }

    updateScenarioRecommendations(messageId, recommendations) {
        this.uiRenderer.updateRecommendations(messageId, recommendations);
    }

    addScenarioResult(messageId, subId, agentType, content, isComplete = false, error = null) {
        this.uiRenderer.addResult(messageId, subId, agentType, content, isComplete, error);
    }
    
    updateCompletionStatus(messageId, status) {
        this.uiRenderer.updateStatus(messageId, status);
    }

    async handleSendMessage() {
        const question = this.questionInput.value.trim();
        if (!question) return;

        this.questionInput.value = '';
        this.questionInput.disabled = true;
        this.sendButton.disabled = true;

        const eventId = this.generateEventId();
        const messageId = this.generateMessageId();

        try {
            // Store event ID mapping with size limit
            this.storeMessageEventId(eventId, messageId);
            
            // Create scenario container
            this.createScenarioContainer(messageId, question);

            this.updateStatus('Connecting to scenario stream...');
            await this.connectWebSocket();
            
            // Send the query through WebSocket
            this.updateStatus('Sending scenario query...');
            await this.sendMessage({
                type: 'query',
                query: question,
                message_id: messageId
            });

        } catch (error) {
            console.error('Error:', error);
            this.updateStatus('Error occurred');
            this.questionInput.disabled = false;
            this.sendButton.disabled = false;
        }
    }

    storeMessageEventId(eventId, messageId) {
        // Add new mapping
        this.messageEventIds.set(eventId, messageId);
        
        // Clean up old entries if we exceed the limit
        if (this.messageEventIds.size > this.maxMessageHistory) {
            // Remove oldest entries
            const entriesToRemove = this.messageEventIds.size - this.maxMessageHistory;
            const iterator = this.messageEventIds.keys();
            
            for (let i = 0; i < entriesToRemove; i++) {
                const oldestKey = iterator.next().value;
                this.messageEventIds.delete(oldestKey);
            }
        }
    }


    async connectWebSocket() {
        // Don't connect if already connecting or connected
        if (this.connectionState === ConnectionState.CONNECTING || 
            this.connectionState === ConnectionState.CONNECTED) {
            return;
        }

        if (this.websocket) {
            this.websocket.close();
        }

        // Get authentication token
        const token = window.authAPI ? window.authAPI.getToken() : null;
        if (!token) {
            this.updateStatus('Not authenticated');
            throw new Error('Authentication required');
        }

        const sessionId = window.app ? window.app.sessionId : '';
        const wsBase = window.app ? window.app.wsBase : 'ws://localhost:5062';
        const wsUrl = `${wsBase}/ws/scenario?session_id=${sessionId}&token=${encodeURIComponent(token)}`;

        this.connectionState = ConnectionState.CONNECTING;

        return new Promise((resolve, reject) => {
            this.websocket = new WebSocket(wsUrl);
            
            // Set a connection timeout
            const connectionTimeout = setTimeout(() => {
                this.connectionState = ConnectionState.DISCONNECTED;
                this.websocket.close();
                reject(new Error('WebSocket connection timeout'));
            }, 5000); // 5 second timeout

            this.websocket.onopen = () => {
                clearTimeout(connectionTimeout);
                this.connectionState = ConnectionState.CONNECTED;
                console.log('Scenario WebSocket connected');
                this.updateStatus('Connected');
                this.questionInput.disabled = false;
                this.sendButton.disabled = false;
                
                // Reset reconnection state on successful connection
                this.reconnectAttempts = 0;
                this.shouldReconnect = true;
                
                // Process any queued messages
                this.processMessageQueue();
                
                resolve();
            };

            this.websocket.onmessage = (event) => {
                this.handleWebSocketMessage(event);
            };

            this.websocket.onerror = (error) => {
                clearTimeout(connectionTimeout);
                this.connectionState = ConnectionState.DISCONNECTED;
                console.error('WebSocket error:', error);
                this.updateStatus('Connection error');
                reject(new Error('WebSocket connection failed'));
            };

            this.websocket.onclose = (event) => {
                this.connectionState = ConnectionState.DISCONNECTED;
                console.log('WebSocket closed', event.code, event.reason);
                
                // Check if we should attempt reconnection
                if (this.shouldReconnect && 
                    event.code !== 1000 && // Normal closure
                    event.code !== 1008 && // Policy violation (auth failed)
                    this.reconnectAttempts < this.maxReconnectAttempts) {
                    
                    this.scheduleReconnect();
                } else {
                    this.updateStatus('Disconnected');
                    this.questionInput.disabled = false;
                    this.sendButton.disabled = false;
                }
            };
        });
    }

    handleWebSocketMessage(event) {
        try {
            // Parse the JSON message
            const message = JSON.parse(event.data);
            
            if (message.type === 'scenario_recommendation') {
                // Initial recommendations
                this.messageGrouper.addRecommendationMessage(message);
                this.updateScenarioRecommendations(message.message_id, message.recommendations);
                this.updateStatus('Executing parallel queries...');
            } else if (message.type === 'scenario_result') {
                // Sub-message result
                this.messageGrouper.addResultMessage(message);
                
                // Check if this is an error result
                const error = message.error || (message.content && message.content.includes('Error:') ? message.content : null);
                
                this.addScenarioResult(
                    message.message_id, 
                    message.sub_id, 
                    message.agent,
                    message.content,
                    message.is_complete,
                    error
                );
                
                // Update completion status
                const status = this.messageGrouper.getCompletionStatus(message.message_id);
                if (status) {
                    this.updateCompletionStatus(message.message_id, status);
                }
            } else if (message.type === 'error') {
                console.error('Scenario error:', message.error);
                this.updateStatus('Error: ' + message.error);
            }
        } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
            console.log('Raw message:', event.data);
        }
    }

    handleNewSession() {
        // Clear UI
        if (this.messagesElement) {
            this.messagesElement.innerHTML = '';
        }
        
        // Clear all data structures
        this.messageGrouper = new ScenarioMessageGrouper();
        this.messageEventIds.clear();
        this.messageQueue = [];
        
        // Reset UI state
        this.updateStatus('Ready');
        this.questionInput.disabled = false;
        this.sendButton.disabled = false;
        
        // Close existing connection
        if (this.websocket) {
            this.connectionState = ConnectionState.DISCONNECTING;
            this.websocket.close();
            this.websocket = null;
        }
        
        // Don't auto-reconnect on new session
        this.connectionState = ConnectionState.DISCONNECTED;
    }

    updateSessionId() {
        if (this.websocket) {
            this.websocket.close();
        }
        this.connectWebSocket();
    }

    async sendMessage(message) {
        if (this.connectionState === ConnectionState.CONNECTED && 
            this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            // Send immediately
            this.websocket.send(JSON.stringify(message));
        } else {
            // Queue the message
            this.messageQueue.push(message);
            
            // Try to connect if not already
            if (this.connectionState === ConnectionState.DISCONNECTED) {
                await this.connectWebSocket();
            }
        }
    }

    processMessageQueue() {
        while (this.messageQueue.length > 0 && 
               this.connectionState === ConnectionState.CONNECTED &&
               this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            const message = this.messageQueue.shift();
            this.websocket.send(JSON.stringify(message));
        }
    }

    scheduleReconnect() {
        // Clear any existing timer
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
            this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
            this.maxReconnectDelay
        );
        
        this.reconnectAttempts++;
        
        this.updateStatus(`Reconnecting in ${Math.round(delay / 1000)}s...`);
        console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
        
        this.reconnectTimer = setTimeout(() => {
            this.reconnect();
        }, delay);
    }
    
    async reconnect() {
        if (this.connectionState !== ConnectionState.DISCONNECTED) {
            return;
        }
        
        console.log(`Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        this.updateStatus('Reconnecting...');
        
        try {
            await this.connectWebSocket();
            // Success - reset attempts
            this.reconnectAttempts = 0;
            console.log('Reconnection successful');
        } catch (error) {
            console.error('Reconnection failed:', error);
            // Will trigger onclose which will schedule another attempt
        }
    }
    
    async handleRetryRequest(detail) {
        const { messageId, subId, agentType } = detail;
        
        console.log(`Retrying failed request: ${subId} (${agentType})`);
        
        try {
            // Ensure we're connected
            await this.connectWebSocket();
            
            // Send retry message
            await this.sendMessage({
                type: 'retry',
                message_id: messageId,
                sub_id: subId,
                agent_type: agentType
            });
        } catch (error) {
            console.error('Failed to retry:', error);
            // Update UI to show retry failed
            this.addScenarioResult(messageId, subId, agentType, '', true, 'Retry failed: ' + error.message);
        }
    }

    cleanup() {
        // Stop reconnection attempts
        this.shouldReconnect = false;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        // Close WebSocket connection
        if (this.websocket) {
            this.connectionState = ConnectionState.DISCONNECTING;
            this.websocket.close();
            this.websocket = null;
        }
        
        // Clear all data structures
        this.messageEventIds.clear();
        this.messageQueue = [];
        this.messageGrouper = new ScenarioMessageGrouper();
        
        // Clear UI
        if (this.messagesElement) {
            this.messagesElement.innerHTML = '';
        }
        
        // Reset state
        this.connectionState = ConnectionState.DISCONNECTED;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.scenarioAgent = new ScenarioAgent();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.scenarioAgent) {
        window.scenarioAgent.cleanup();
    }
});