class AskAgent {
    constructor() {
        this.websocket = null;
        this.messageEventIds = new Map();  // Store event IDs for each message
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
                messageDiv.innerHTML = markdownContent;
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
    }

    async copyMessage(content, button) {
        try {
            await navigator.clipboard.writeText(content);
            console.log('Message copied to clipboard');

            // Show visual feedback - permanent
            button.innerHTML = '<img src="/static/icons/copy-active.svg" alt="Copied">';
            button.disabled = true;
            button.title = 'Copied to clipboard';
        } catch (err) {
            console.error('Failed to copy message: ', err);
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
            
            // Prepare headers for rating request
            const headers = {
                'Content-Type': 'application/json'
            };
            
            if (sessionId) {
                headers['X-Session-ID'] = sessionId;
            }
            if (eventId) {
                headers['X-Event-ID'] = eventId;
            }
            
            const response = await window.authAPI.authenticatedFetch(ratingsUrl.toString(), {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    rating_type: ratingType,
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

    generateRequestId() {
        return 'req-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    async triggerEvent(question) {
        const endpoint = '/agent';
        const url = new URL(endpoint, window.location.origin);
        url.searchParams.append('question', question);
        
        // Generate request and event IDs
        const requestId = this.generateRequestId();
        const eventId = this.generateEventId();
        
        // Prepare headers
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // Add session ID to headers
        if (window.app && window.app.sessionId) {
            headers['X-Session-ID'] = window.app.sessionId;
        }
        
        // Add request and event IDs to headers
        headers['X-Request-ID'] = requestId;
        headers['X-Event-ID'] = eventId;

        const response = await window.authAPI.authenticatedFetch(url.toString(), {
            method: 'GET',
            headers: headers
        });
        const data = await response.json();

        return data;
    }

    async connectWebSocket() {
        if (this.websocket) {
            this.websocket.close();
        }

        const sessionId = window.app ? window.app.sessionId : '';
        const wsBase = window.app ? window.app.wsBase : 'ws://localhost:5062/ws';
        const wsUrl = `${wsBase}?session_id=${sessionId}`;
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
            if (this.sendButton) {
                this.sendButton.disabled = false;
            }
        };
    }


    async handleSendMessage() {
        if (!this.questionInput || !this.sendButton) return;

        // Check authentication first
        if (!window.authAPI || !window.authAPI.isLoggedIn()) {
            if (window.authUI && typeof window.authUI.showLoginModal === 'function') {
                window.authUI.showLoginModal('You need to be logged in to use the Ask Agent service.');
            } else {
                alert('Please log in to use the Ask Agent service.');
            }
            return;
        }

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

    handleTemplateClick(templateText) {
        if (this.questionInput) {
            this.questionInput.value = templateText;
            this.questionInput.focus();
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

        // Close any existing WebSocket connection
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }

        // Re-enable send button
        if (this.sendButton) {
            this.sendButton.disabled = false;
        }

        console.log('New ask-agent session started');
    }
}

// Initialize ask-agent when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.askAgent = new AskAgent();
});
