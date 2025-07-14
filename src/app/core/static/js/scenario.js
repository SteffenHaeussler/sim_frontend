import { htmlSanitizer } from './html-sanitizer.js';
import { WebSocketHandler } from './websocket-handler.js';
import { JsonRenderer } from './json-renderer.js';
import { SqlAgentHandler } from './sql-agent-handler.js';
import { MessageRenderer } from './message-renderer.js';
import { EvaluationHandler } from './evaluation-handler.js';

class ScenarioAgent {
    constructor() {
        this.wsHandler = null;
        this.sanitizer = htmlSanitizer;
        this.eventListeners = [];
        this.initializeElements();
        
        // Initialize handlers
        this.jsonRenderer = new JsonRenderer();
        this.sqlAgentHandler = new SqlAgentHandler(this.messagesElement, this.sanitizer);
        this.messageRenderer = new MessageRenderer(this.messagesElement, this.questionInput, this.sanitizer);
        this.evaluationHandler = new EvaluationHandler(this.sanitizer);
        
        this.setupEventListeners();
    }

    initializeElements() {
        this.messagesElement = document.getElementById('messages');
        this.questionInput = document.getElementById('question');
        this.sendButton = document.getElementById('send-btn');
    }

    setupEventListeners() {
        if (this.sendButton) {
            const clickHandler = () => this.handleSendMessage();
            this.sendButton.addEventListener('click', clickHandler);
            this.eventListeners.push({ element: this.sendButton, event: 'click', handler: clickHandler });
        }

        if (this.questionInput) {
            const keyHandler = (e) => {
                if (e.key === 'Enter') {
                    this.handleSendMessage();
                }
            };
            this.questionInput.addEventListener('keypress', keyHandler);
            this.eventListeners.push({ element: this.questionInput, event: 'keypress', handler: keyHandler });
        }
    }

    updateStatus(message) {
        this.messageRenderer.updateStatus(message);
    }

    addMessage(content, isQuestion = false) {
        this.messageRenderer.addMessage(content, isQuestion);
    }

    addJsonMessage(jsonData) {
        const messageDiv = this.jsonRenderer.render(jsonData);
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
        if (this.wsHandler) {
            this.wsHandler.close();
        }

        // Connect DIRECTLY to the external agent WebSocket (exactly like ask-agent.js)
        const sessionId = window.app ? window.app.sessionId : '';
        const wsBase = window.app ? window.app.wsBase : 'ws://localhost:5055/ws';
        const wsUrl = `${wsBase}?session_id=${sessionId}`;
        
        console.log('Scenario WebSocket URL:', wsUrl);
        
        // Buffer for accumulating regular messages
        let messageBuffer = '';
        
        this.wsHandler = new WebSocketHandler({
            maxRetries: 3,
            baseDelay: 1000,
            onMessage: (data, type) => {
                if (type === 'json') {
                    // Handle JSON immediately
                    this.handleWebSocketMessage(data, type);
                } else if (type === 'data' || type === 'raw') {
                    // For evaluation mode, accumulate and check for boundaries
                    if (this.evaluationHandler.isInEvaluationMode() && this.evaluationHandler.getSQLContainer()) {
                        // Accumulate evaluation text
                        messageBuffer += data + '\n';
                        
                        // Check for double newline as evaluation boundary
                        const evaluations = messageBuffer.split('\n\n\n');
                        
                        // Process complete evaluations
                        for (let i = 0; i < evaluations.length - 1; i++) {
                            const evalText = evaluations[i].trim();
                            if (evalText) {
                                if (!this.evaluationHandler.hasCurrentEvaluationDiv()) {
                                    this.evaluationHandler.addEvaluationToSQLContainer(evalText);
                                } else {
                                    // If we already have an evaluation, create a new one
                                    this.evaluationHandler.currentEvaluationDiv = null;
                                    this.evaluationHandler.addEvaluationToSQLContainer(evalText);
                                }
                            }
                        }
                        
                        // Keep the last part in buffer
                        messageBuffer = evaluations[evaluations.length - 1];
                    } else {
                        // Regular messages - accumulate and check for boundaries
                        messageBuffer += data + '\n';
                        
                        // Check for double newline as message boundary
                        const messages = messageBuffer.split('\n\n\n');
                        
                        // Process all complete messages
                        for (let i = 0; i < messages.length - 1; i++) {
                            const message = messages[i].trim();
                            if (message) {
                                this.addMessage(message);
                            }
                        }
                        
                        // Keep the last part in buffer
                        messageBuffer = messages[messages.length - 1];
                    }
                }
            },
            onStatusUpdate: (status) => {
                this.updateStatus(status);
                
                // Check if we're entering evaluation mode
                if (status === "Evaluating...") {
                    this.evaluationHandler.setEvaluationMode(true);
                    // Process any pending regular message before evaluation starts
                    if (messageBuffer.trim() && !this.evaluationHandler.getSQLContainer()) {
                        this.addMessage(messageBuffer.trim());
                        messageBuffer = '';
                    }
                }
                
                // Check for end status
                if (status === "end") {
                    // Process any remaining message in buffer
                    if (messageBuffer.trim()) {
                        if (this.evaluationHandler.isInEvaluationMode() && this.evaluationHandler.getSQLContainer()) {
                            if (!this.evaluationHandler.hasCurrentEvaluationDiv()) {
                                this.evaluationHandler.addEvaluationToSQLContainer(messageBuffer.trim());
                            } else {
                                this.evaluationHandler.appendToEvaluation(messageBuffer.trim());
                            }
                        } else {
                            this.addMessage(messageBuffer.trim());
                        }
                        messageBuffer = '';
                    }
                    
                    this.updateStatus('Ready');
                    this.evaluationHandler.setEvaluationMode(false);
                }
            },
            onError: (error) => {
                console.error('WebSocket error:', error);
                this.updateStatus('Connection error');
                messageBuffer = '';
            },
            onClose: () => {
                // Process any remaining message
                if (messageBuffer.trim()) {
                    if (this.evaluationHandler.isInEvaluationMode() && this.evaluationHandler.getSQLContainer()) {
                        if (!this.evaluationHandler.hasCurrentEvaluationDiv()) {
                            this.evaluationHandler.addEvaluationToSQLContainer(messageBuffer.trim());
                        } else {
                            this.evaluationHandler.appendToEvaluation(messageBuffer.trim());
                        }
                    } else {
                        this.addMessage(messageBuffer.trim());
                    }
                    messageBuffer = '';
                }
                
                this.updateStatus('Ready');
                if (this.sendButton) {
                    this.sendButton.disabled = false;
                }
            }
        });
        
        try {
            await this.wsHandler.connect(wsUrl);
        } catch (error) {
            console.error('Failed to connect WebSocket:', error);
            this.updateStatus('Connection failed');
            throw error;
        }
    }
    
    handleWebSocketMessage(data, type) {
        console.log('Scenario WebSocket message:', data, 'type:', type);
        
        if (type === 'json') {
            console.log('First item check:', {
                isArray: Array.isArray(data),
                length: data.length,
                firstItem: data[0],
                hasSub_id: data[0]?.sub_id !== undefined,
                hasQuestion: data[0]?.question !== undefined,
                hasEndpoint: data[0]?.endpoint !== undefined || data[0]?.end_point !== undefined
            });
            
            // Check if this is a list of SQL agent requests
            if (Array.isArray(data) && data.length > 0 && 
                data[0].sub_id !== undefined && 
                data[0].question !== undefined && 
                (data[0].end_point !== undefined || data[0].endpoint !== undefined)) {
                console.log('Handling as SQL agent requests');
                // Handle SQL agent requests
                this.sqlAgentHandler.handleRequests(data).then(container => {
                    // Store reference to container for evaluation text
                    this.evaluationHandler.setSQLContainer(container);
                });
            } else {
                console.log('Handling as regular JSON');
                // Regular JSON display
                this.addJsonMessage(data);
            }
        } else if (type === 'data' || type === 'raw') {
            // Check if this is evaluation text and we're in evaluation mode
            if (this.evaluationHandler.isInEvaluationMode() && this.evaluationHandler.getSQLContainer()) {
                if (this.evaluationHandler.hasCurrentEvaluationDiv()) {
                    this.evaluationHandler.appendToEvaluation(data);
                } else {
                    this.evaluationHandler.addEvaluationToSQLContainer(data);
                }
            } else {
                // Regular markdown message
                this.addMessage(data);
            }
        }
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

    
    cleanupWebSocket() {
        if (this.wsHandler) {
            this.wsHandler.close();
            this.wsHandler = null;
        }
        
        // Clean up any SQL WebSocket handlers
        this.sqlAgentHandler.cleanup();
    }
    
    cleanup() {
        // Remove all event listeners
        this.eventListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.eventListeners = [];
        
        // Clean up WebSocket
        this.cleanupWebSocket();
    }
    
    handleNewSession() {
        // Clear all messages
        this.messageRenderer.clearMessages();
        
        // Clear input field
        if (this.questionInput) {
            this.questionInput.value = '';
        }
        
        // Reset status
        this.updateStatus('Ready');
        
        // Close WebSocket
        this.cleanupWebSocket();
        
        // Re-enable send button
        if (this.sendButton) {
            this.sendButton.disabled = false;
        }
        
        // Reset evaluation handler
        this.evaluationHandler.reset();
    }
}

// Export for testing
export { ScenarioAgent };

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.scenarioAgent = new ScenarioAgent();
});