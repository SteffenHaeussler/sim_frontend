import { htmlSanitizer } from './html-sanitizer.js';
import { WebSocketHandler } from './websocket-handler.js';

class AskSQLAgent {
    constructor() {
        this.wsHandler = null;
        this.messageEventIds = new Map();  // Store event IDs for each message
        this.sanitizer = htmlSanitizer;
        this.eventListeners = [];
        this.initializeElements();
        this.setupEventListeners();
    }

    initializeElements() {
        this.messagesElement = document.getElementById('sql-messages');
        this.questionInput = document.getElementById('sql-question');
        this.sendButton = document.getElementById('sql-send-btn');
        this.originalPlaceholder = this.questionInput ? this.questionInput.placeholder : '';
        
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

    generateEventId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    updateStatus(message) {
        if (!this.questionInput) return;

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
        if (!this.messagesElement) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = isQuestion ? 'message question' : 'message';

        // Generate unique event ID for AI responses (not for user questions)
        let eventId = null;
        if (!isQuestion) {
            eventId = this.generateEventId();
            messageDiv.setAttribute('data-event-id', eventId);
            this.messageEventIds.set(messageDiv, eventId);
        }

        if (isImage) {
            const img = document.createElement('img');
            img.src = content;
            messageDiv.appendChild(img);
        } else {
            if (isQuestion) {
                // Keep user questions as plain text
                const p = document.createElement('p');
                p.textContent = content;
                messageDiv.appendChild(p);
            } else {
                // Render AI responses as markdown with line breaks
                marked.setOptions({
                    breaks: true,
                    gfm: true
                });
                const markdownContent = marked.parse(content);
                messageDiv.innerHTML = this.sanitizer.sanitize(markdownContent);
            }
        }

        // Add action buttons for AI responses only (not questions or images)
        if (!isImage && !isQuestion) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'message-actions';

            const buttonRow = document.createElement('div');
            buttonRow.className = 'button-row';

            // Copy button
            const copyBtn = document.createElement('button');
            copyBtn.className = 'action-btn copy-btn';
            copyBtn.innerHTML = '<img src="/static/icons/copy.svg" alt="Copy">';
            copyBtn.title = 'Copy to clipboard';
            copyBtn.onclick = () => this.copyMessage(content, copyBtn);

            // Thumbs up button
            const thumbsUpBtn = document.createElement('button');
            thumbsUpBtn.className = 'action-btn thumbs-up-btn';
            thumbsUpBtn.innerHTML = '<img src="/static/icons/thumbs-up.svg" alt="Good">';
            thumbsUpBtn.title = 'Good response';
            thumbsUpBtn.onclick = () => this.rateMessage(content, 'up', thumbsUpBtn, thumbsDownBtn, actionsDiv);

            // Thumbs down button
            const thumbsDownBtn = document.createElement('button');
            thumbsDownBtn.className = 'action-btn thumbs-down-btn';
            thumbsDownBtn.innerHTML = '<img src="/static/icons/thumbs-down.svg" alt="Bad">';
            thumbsDownBtn.title = 'Poor response';
            thumbsDownBtn.onclick = () => this.rateMessage(content, 'down', thumbsDownBtn, thumbsUpBtn, actionsDiv);

            buttonRow.appendChild(copyBtn);
            buttonRow.appendChild(thumbsUpBtn);
            buttonRow.appendChild(thumbsDownBtn);
            actionsDiv.appendChild(buttonRow);
            messageDiv.appendChild(actionsDiv);
        }

        this.messagesElement.appendChild(messageDiv);
        this.messagesElement.scrollTop = this.messagesElement.scrollHeight;
        
        // Debug: Check if message was added
        console.log('Message added to DOM. Total messages:', this.messagesElement.children.length);
        console.log('Messages container innerHTML:', this.messagesElement.innerHTML);
    }

    async copyMessage(content, button) {
        try {
            // Try modern clipboard API first
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(content);
                console.log('Message copied to clipboard using modern API');
            } else {
                // Fallback to legacy method
                this.copyToClipboardFallback(content);
                console.log('Message copied to clipboard using fallback method');
            }

            // Show visual feedback - permanent
            button.innerHTML = '<img src="/static/icons/copy-active.svg" alt="Copied">';
            button.disabled = true;
            button.title = 'Copied to clipboard';
        } catch (err) {
            console.error('Failed to copy message: ', err);
            
            // Try fallback method if modern API fails
            try {
                this.copyToClipboardFallback(content);
                console.log('Message copied to clipboard using fallback after error');
                
                // Show visual feedback - permanent
                button.innerHTML = '<img src="/static/icons/copy-active.svg" alt="Copied">';
                button.disabled = true;
                button.title = 'Copied to clipboard';
            } catch (fallbackErr) {
                console.error('Fallback copy also failed: ', fallbackErr);
                // Show error feedback
                button.innerHTML = '<img src="/static/icons/copy.svg" alt="Copy Failed">';
                button.title = 'Failed to copy - try manual selection';
            }
        }
    }

    copyToClipboardFallback(text) {
        // Create a temporary textarea element
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            // Use execCommand as fallback
            const successful = document.execCommand('copy');
            if (!successful) {
                throw new Error('execCommand copy returned false');
            }
        } finally {
            document.body.removeChild(textArea);
        }
    }

    async rateMessage(content, rating, button, otherButton, actionsDiv) {
        console.log(`Message rated as: ${rating}`);
        console.log('Content:', content);

        // Show visual feedback - permanent
        const activeIcon = rating === 'up' ?
            '/static/icons/thumbs-up-active.svg' :
            '/static/icons/thumbs-down-active.svg';

        button.innerHTML = `<img src="${activeIcon}" alt="${rating}">`;
        button.disabled = true;
        button.title = `Rated as ${rating === 'up' ? 'good' : 'poor'}`;

        // Hide the opposite button
        otherButton.style.display = 'none';

        // Get the event ID for this specific message
        const messageDiv = actionsDiv.closest('.message');
        const eventId = messageDiv ? messageDiv.getAttribute('data-event-id') : null;

        // Send rating to API
        try {
            const sessionId = window.app ? window.app.sessionId : '';
            const ratingType = rating === 'up' ? 'thumbs_up' : 'thumbs_down';

            console.log('About to submit rating:', {
                rating_type: ratingType,
                session_id: sessionId,
                message_context: content.substring(0, 100) + '...'
            });

            const ratingsUrl = new URL('/ratings/submit', window.location.origin);
            if (sessionId) {
                ratingsUrl.searchParams.append('session_id', sessionId);
            }
            if (eventId) {
                ratingsUrl.searchParams.append('event_id', eventId);
            }

            const response = await window.authAPI.authenticatedFetch(ratingsUrl.toString(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    rating_type: ratingType,
                    session_id: sessionId,
                    event_id: eventId,  // Include event ID for this specific message
                    message_context: content.substring(0, 500), // First 500 chars of the response
                    feedback_text: null
                })
            });

            if (response.ok) {
                const result = await response.json();
                console.log('Rating submitted successfully:', result);
            } else {
                console.error('Failed to submit rating:', response.status, response.statusText);
                const errorBody = await response.text();
                console.error('Error response body:', errorBody);
            }
        } catch (error) {
            console.error('Error submitting rating:', error);
        }

        // Add thank you message below the button row
        const thankYouMsg = document.createElement('div');
        thankYouMsg.className = 'thank-you-message';
        thankYouMsg.textContent = 'Thank you!';
        actionsDiv.appendChild(thankYouMsg);
    }

    async triggerEvent(question) {
        const endpoint = '/sqlagent';
        const url = new URL(endpoint, window.location.origin);
        url.searchParams.append('question', question);

        // Generate request ID for correlation
        const requestId = this.generateEventId();

        // Prepare headers with session and request IDs
        const headers = {
            'Content-Type': 'application/json'
        };

        // Add session ID header
        if (window.app && window.app.sessionId) {
            url.searchParams.append('session_id', window.app.sessionId);
            headers['x-session-id'] = window.app.sessionId;
        }

        // Add request ID header for correlation
        headers['x-request-id'] = requestId;

        const response = await window.authAPI.authenticatedFetch(url.toString(), {
            headers: headers
        });
        const data = await response.json();

        return data;
    }

    async connectWebSocket() {
        console.log('SQL Agent: Connecting to WebSocket...');
        if (this.wsHandler) {
            this.wsHandler.close();
        }

        const sessionId = window.app ? window.app.sessionId : '';
        const wsBase = window.app ? window.app.wsBase : 'ws://localhost:5062/ws';
        const wsUrl = `${wsBase}?session_id=${sessionId}`;
        console.log('SQL Agent WebSocket URL:', wsUrl);
        
        // No buffering needed - display messages immediately
        
        this.wsHandler = new WebSocketHandler({
            maxRetries: 3,
            baseDelay: 1000,
            preserveDataLineBreaks: true, // Preserve data messages intact for ##Response/##Evaluation
            onMessage: (data, type) => {
                if (type === 'data' || type === 'raw') {
                    // Check if this starts with ##Response or ##Evaluation
                    if (data.startsWith('##Response')) {
                        // Extract content after ##Response
                        const content = data.substring('##Response'.length).trim();
                        if (content) {
                            const parts = content.split("$%$%Plot:");
                            if (parts[0].trim()) {
                                this.addMessage(parts[0].trim());
                            }
                            if (parts.length > 1) {
                                const imageData = `data:image/png;base64,${parts[1].trim()}`;
                                this.addMessage(imageData, true);
                            }
                        }
                    } else if (data.startsWith('##Evaluation')) {
                        // Extract content after ##Evaluation
                        const content = data.substring('##Evaluation'.length).trim();
                        if (content) {
                            const parts = content.split("$%$%Plot:");
                            if (parts[0].trim()) {
                                this.addMessage(parts[0].trim());
                            }
                            if (parts.length > 1) {
                                const imageData = `data:image/png;base64,${parts[1].trim()}`;
                                this.addMessage(imageData, true);
                            }
                        }
                    } else {
                        // Regular message without markers
                        const parts = data.split("$%$%Plot:");
                        if (parts[0].trim()) {
                            this.addMessage(parts[0].trim());
                        }
                        if (parts.length > 1) {
                            const imageData = `data:image/png;base64,${parts[1].trim()}`;
                            this.addMessage(imageData, true);
                        }
                    }
                }
            },
            onStatusUpdate: (status) => {
                this.updateStatus(status);
                
                if (status === 'end') {
                    this.updateStatus('Ready');
                }
            },
            onError: (error) => {
                console.error('SQL Agent WebSocket error:', error);
                this.updateStatus('Connection error');
            },
            onClose: () => {
                this.updateStatus('Ready');
                if (this.sendButton) {
                    this.sendButton.disabled = false;
                }
            }
        });
        
        try {
            await this.wsHandler.connect(wsUrl);
        } catch (error) {
            console.error('SQL Agent: Failed to connect WebSocket:', error);
            this.updateStatus('Connection failed');
            if (this.sendButton) {
                this.sendButton.disabled = false;
            }
            throw error;
        }
    }


    async handleSendMessage() {
        console.log('SQL Agent: handleSendMessage called');
        console.log('SQL Agent: Current active service:', window.app ? window.app.currentActiveService : 'unknown');
        
        // Capture the question value immediately before any other handler can clear it
        const question = this.questionInput ? this.questionInput.value.trim() : '';
        console.log('SQL Agent: Captured question immediately:', question);
        
        // Only process if SQL Agent is the active service
        if (window.app && window.app.currentActiveService !== 'ask-sql-agent') {
            console.log('SQL Agent: Not active service, ignoring send');
            return;
        }
        
        if (!this.questionInput || !this.sendButton) {
            console.log('SQL Agent: Missing elements:', {questionInput: this.questionInput, sendButton: this.sendButton});
            return;
        }

        // Check authentication first
        try {
            console.log('SQL Agent: Checking authentication...');
            console.log('SQL Agent: window.authAPI:', window.authAPI);
            
            if (!window.authAPI) {
                console.log('SQL Agent: authAPI not available');
                alert('Please log in to use the SQL Agent service.');
                return;
            }
            
            const isLoggedIn = window.authAPI.isLoggedIn();
            console.log('SQL Agent: isLoggedIn:', isLoggedIn);
            
            if (!isLoggedIn) {
                console.log('SQL Agent: Authentication failed, showing login modal');
                if (window.authUI && typeof window.authUI.showLoginModal === 'function') {
                    window.authUI.showLoginModal('You need to be logged in to use the SQL Agent service.');
                } else {
                    alert('Please log in to use the SQL Agent service.');
                }
                return;
            }
            
            console.log('SQL Agent: Authentication passed');
        } catch (authError) {
            console.error('SQL Agent: Authentication check error:', authError);
            alert('Authentication error. Please try logging in again.');
            return;
        }

        console.log('SQL Agent: Using captured question:', question);
        if (!question) {
            console.log('SQL Agent: Captured question is empty, returning');
            return;
        }

        this.sendButton.disabled = true;
        this.questionInput.value = '';
        this.addMessage(`Question: ${question}`, false, true);
        this.updateStatus('Processing...');

        try {
            console.log('SQL Agent: Triggering event...');
            await this.triggerEvent(question);
            console.log('SQL Agent: Connecting WebSocket...');
            await this.connectWebSocket();
        } catch (error) {
            console.error('SQL Agent Error:', error);
            this.updateStatus('Error');
            this.sendButton.disabled = false;
        }
    }

    handleTemplateClick(templateText) {
        if (this.questionInput) {
            this.questionInput.value = templateText;
            this.questionInput.focus();
        }
    }

    cleanupWebSocket() {
        if (this.wsHandler) {
            this.wsHandler.close();
            this.wsHandler = null;
        }
    }
    
    cleanup() {
        // Remove all event listeners
        this.eventListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.eventListeners = [];
        
        // Clean up WebSocket
        this.cleanupWebSocket();
        
        // Clear message event IDs map
        this.messageEventIds.clear();
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

        // Close any existing WebSocket connection
        this.cleanupWebSocket();

        // Re-enable send button
        if (this.sendButton) {
            this.sendButton.disabled = false;
        }

        // Update session ID display (same as main app)
        this.updateSessionId();

        console.log('New sql-agent session started');
    }

    updateSessionId() {
        const sessionIdElement = document.getElementById('sql-session-id-bottom');
        if (sessionIdElement && window.app && window.app.sessionId) {
            sessionIdElement.textContent = window.app.sessionId;
        }
    }
}

// Initialize sql-agent when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.sqlAgent = new AskSQLAgent();
});
