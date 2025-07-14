import { htmlSanitizer } from './html-sanitizer.js';
import { WebSocketHandler } from './websocket-handler.js';

class ScenarioAgent {
    constructor() {
        this.wsHandler = null;
        this.currentSQLContainer = null;
        this.currentEvaluationDiv = null;
        this.inEvaluationMode = false;
        this.sanitizer = htmlSanitizer;
        this.eventListeners = [];
        this.sqlWebSocketHandlers = new Map(); // Track SQL WebSocket handlers
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
            const parsedContent = marked.parse(content);
            messageDiv.innerHTML = this.sanitizer.sanitize(parsedContent);
        }

        this.messagesElement.appendChild(messageDiv);
        this.messagesElement.scrollTop = this.messagesElement.scrollHeight;
    }

    addJsonMessage(jsonData) {
        if (!this.messagesElement) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = 'message json-response';

        // Create a container for the JSON content
        const jsonContainer = document.createElement('div');
        jsonContainer.className = 'json-container';

        // Function to recursively render JSON data
        const renderJson = (data, level = 0) => {
            const indent = '  '.repeat(level);
            
            if (Array.isArray(data)) {
                const arrayDiv = document.createElement('div');
                arrayDiv.className = 'json-array';
                arrayDiv.style.marginLeft = `${level * 20}px`;
                
                data.forEach((item, index) => {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'json-array-item';
                    
                    const indexSpan = document.createElement('span');
                    indexSpan.className = 'json-index';
                    indexSpan.textContent = `[${index}]: `;
                    itemDiv.appendChild(indexSpan);
                    
                    if (typeof item === 'object' && item !== null) {
                        itemDiv.appendChild(renderJson(item, level + 1));
                    } else {
                        const valueSpan = document.createElement('span');
                        valueSpan.className = 'json-value';
                        valueSpan.textContent = JSON.stringify(item);
                        itemDiv.appendChild(valueSpan);
                    }
                    
                    arrayDiv.appendChild(itemDiv);
                });
                
                return arrayDiv;
            } else if (typeof data === 'object' && data !== null) {
                const objectDiv = document.createElement('div');
                objectDiv.className = 'json-object';
                objectDiv.style.marginLeft = `${level * 20}px`;
                
                Object.entries(data).forEach(([key, value]) => {
                    const propertyDiv = document.createElement('div');
                    propertyDiv.className = 'json-property';
                    
                    const keySpan = document.createElement('span');
                    keySpan.className = 'json-key';
                    keySpan.textContent = `${key}: `;
                    propertyDiv.appendChild(keySpan);
                    
                    if (typeof value === 'object' && value !== null) {
                        propertyDiv.appendChild(renderJson(value, level + 1));
                    } else {
                        const valueSpan = document.createElement('span');
                        valueSpan.className = 'json-value';
                        valueSpan.textContent = JSON.stringify(value);
                        propertyDiv.appendChild(valueSpan);
                    }
                    
                    objectDiv.appendChild(propertyDiv);
                });
                
                return objectDiv;
            } else {
                const valueSpan = document.createElement('span');
                valueSpan.className = 'json-value';
                valueSpan.textContent = JSON.stringify(data);
                return valueSpan;
            }
        };

        // Add a header indicating this is JSON data
        const header = document.createElement('div');
        header.className = 'json-header';
        header.textContent = 'JSON Response:';
        jsonContainer.appendChild(header);

        // Render the JSON data
        jsonContainer.appendChild(renderJson(jsonData));
        
        messageDiv.appendChild(jsonContainer);
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
                    if (this.inEvaluationMode && this.currentSQLContainer) {
                        // Accumulate evaluation text
                        messageBuffer += data + '\n';
                        
                        // Check for double newline as evaluation boundary
                        const evaluations = messageBuffer.split('\n\n\n');
                        
                        // Process complete evaluations
                        for (let i = 0; i < evaluations.length - 1; i++) {
                            const evalText = evaluations[i].trim();
                            if (evalText) {
                                if (!this.currentEvaluationDiv) {
                                    this.addEvaluationToSQLContainer(evalText);
                                } else {
                                    // If we already have an evaluation, create a new one
                                    this.currentEvaluationDiv = null;
                                    this.addEvaluationToSQLContainer(evalText);
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
                    this.inEvaluationMode = true;
                    // Process any pending regular message before evaluation starts
                    if (messageBuffer.trim() && !this.currentSQLContainer) {
                        this.addMessage(messageBuffer.trim());
                        messageBuffer = '';
                    }
                }
                
                // Check for end status
                if (status === "end") {
                    // Process any remaining message in buffer
                    if (messageBuffer.trim()) {
                        if (this.inEvaluationMode && this.currentSQLContainer) {
                            if (!this.currentEvaluationDiv) {
                                this.addEvaluationToSQLContainer(messageBuffer.trim());
                            } else {
                                this.appendToEvaluation(messageBuffer.trim());
                            }
                        } else {
                            this.addMessage(messageBuffer.trim());
                        }
                        messageBuffer = '';
                    }
                    
                    this.updateStatus('Ready');
                    this.inEvaluationMode = false;
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
                    if (this.inEvaluationMode && this.currentSQLContainer) {
                        if (!this.currentEvaluationDiv) {
                            this.addEvaluationToSQLContainer(messageBuffer.trim());
                        } else {
                            this.appendToEvaluation(messageBuffer.trim());
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
                this.handleSQLAgentRequests(data);
                // Store reference to container for evaluation text
                this.currentSQLContainer = this.messagesElement.lastElementChild;
            } else {
                console.log('Handling as regular JSON');
                // Regular JSON display
                this.addJsonMessage(data);
            }
        } else if (type === 'data' || type === 'raw') {
            // Check if this is evaluation text and we're in evaluation mode
            if (this.inEvaluationMode && this.currentSQLContainer) {
                if (this.currentEvaluationDiv) {
                    this.appendToEvaluation(data);
                } else {
                    this.addEvaluationToSQLContainer(data);
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

    async handleSQLAgentRequests(requests) {
        console.log('handleSQLAgentRequests called with:', requests);
        
        // Create a container for all SQL agent requests
        const containerDiv = document.createElement('div');
        containerDiv.className = 'sql-requests-container';
        
        // Add header
        const header = document.createElement('div');
        header.className = 'sql-requests-header';
        header.innerHTML = `
            <h3>SQL Agent Requests (${requests.length} queries)</h3>
            <div class="sql-progress">
                <span class="sql-completed">0</span> / <span class="sql-total">${requests.length}</span> completed
            </div>
        `;
        containerDiv.appendChild(header);
        
        // Create container for all request cards
        const requestsGrid = document.createElement('div');
        requestsGrid.className = 'sql-requests-grid';
        containerDiv.appendChild(requestsGrid);
        
        // Add container to messages
        this.messagesElement.appendChild(containerDiv);
        
        // Process each request sequentially
        // Create all cards first with queued status
        const allCards = [];
        for (let i = 0; i < requests.length; i++) {
            const request = requests[i];
            const requestCard = this.createSQLRequestCard(request, i);
            requestsGrid.appendChild(requestCard);
            allCards.push({ request, card: requestCard });
            
            // Set queued status for cards that will wait
            if (i > 0) {
                requestCard.classList.remove('pending');
                requestCard.classList.add('queued');
                requestCard.querySelector('.sql-status-icon').textContent = '⏸️';
                requestCard.querySelector('.sql-status-text').textContent = 'Queued';
            }
        }
        
        // Process each request sequentially
        const processRequestsSequentially = async () => {
            for (let i = 0; i < allCards.length; i++) {
                const { request, card: requestCard } = allCards[i];
                
                // Update from queued to processing
                if (requestCard.classList.contains('queued')) {
                    requestCard.classList.remove('queued');
                    requestCard.classList.add('pending');
                    requestCard.querySelector('.sql-status-icon').textContent = '⏳';
                    requestCard.querySelector('.sql-status-text').textContent = 'Pending';
                }
                
                // Execute SQL agent request and wait for completion
                try {
                    await this.executeSQLAgentRequest(request, requestCard, containerDiv);
                    
                    // Update progress
                    const completed = containerDiv.querySelectorAll('.sql-request-card.completed').length;
                    containerDiv.querySelector('.sql-completed').textContent = completed;
                    
                    // Add delay between requests to respect rate limits (1 second)
                    if (i < requests.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                } catch (error) {
                    console.error(`Failed to process request ${i}:`, error);
                    // Continue with next request even if one fails
                }
            }
        };
        
        // Start sequential processing
        processRequestsSequentially();
        
        this.messagesElement.scrollTop = this.messagesElement.scrollHeight;
    }
    
    createSQLRequestCard(request, index) {
        const card = document.createElement('div');
        card.className = 'sql-request-card pending';
        card.dataset.subId = request.sub_id;
        
        card.innerHTML = `
            <div class="sql-card-header">
                <div class="sql-card-title">
                    <span class="sql-sub-id">Query ${request.sub_id}</span>
                    <span class="sql-endpoint">${request.endpoint || request.end_point}</span>
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
        
        // Add event listeners for action buttons
        const copyBtn = card.querySelector('.sql-copy-btn');
        const thumbsUpBtn = card.querySelector('.sql-thumbs-up');
        const thumbsDownBtn = card.querySelector('.sql-thumbs-down');
        
        copyBtn.addEventListener('click', () => {
            const content = card.querySelector('.sql-result-content').innerText;
            this.copyToClipboard(content, copyBtn);
        });
        
        thumbsUpBtn.addEventListener('click', () => {
            this.rateResponse(request, card, 'up', thumbsUpBtn);
        });
        
        thumbsDownBtn.addEventListener('click', () => {
            this.rateResponse(request, card, 'down', thumbsDownBtn);
        });
        
        return card;
    }
    
    generateSessionId() {
        return 'sql-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
    
    async copyToClipboard(content, button) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(content);
            } else {
                // Fallback for older browsers
                const textArea = document.createElement("textarea");
                textArea.value = content;
                textArea.style.position = "fixed";
                textArea.style.left = "-999999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                
                try {
                    document.execCommand('copy');
                } catch (err) {
                    console.error('Failed to copy:', err);
                }
                
                document.body.removeChild(textArea);
            }
            
            // Visual feedback - permanent
            button.querySelector('img').src = '/static/icons/copy-active.svg';
            button.disabled = true;
            button.title = 'Copied!';
            
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
        }
    }
    
    async rateResponse(request, card, rating, button) {
        try {
            const content = card.querySelector('.sql-result-content').innerText;
            const sessionId = card.querySelector('.sql-session-id')?.textContent || window.app?.sessionId;
            
            const ratingType = rating === 'up' ? 'thumbs_up' : 'thumbs_down';
            
            // Use the same endpoint as other services
            const ratingsUrl = new URL('/ratings/submit', window.location.origin);
            if (sessionId) {
                ratingsUrl.searchParams.append('session_id', sessionId);
            }
            
            const response = await window.authAPI.authenticatedFetch(ratingsUrl.toString(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    rating_type: ratingType,
                    session_id: sessionId,
                    event_id: request.sub_id,  // Use sub_id as event_id
                    message_context: content.substring(0, 500), // First 500 chars of the response
                    feedback_text: null
                })
            });
            
            if (response.ok) {
                // Visual feedback - use active icons
                const activeIcon = rating === 'up' ? 
                    '/static/icons/thumbs-up-active.svg' : 
                    '/static/icons/thumbs-down-active.svg';
                button.querySelector('img').src = activeIcon;
                button.disabled = true;
                button.title = `Rated as ${rating === 'up' ? 'good' : 'poor'}`;
                
                // Hide the other rating button
                const otherButton = rating === 'up' 
                    ? card.querySelector('.sql-thumbs-down') 
                    : card.querySelector('.sql-thumbs-up');
                otherButton.style.display = 'none';
            }
        } catch (error) {
            console.error('Failed to submit rating:', error);
        }
    }
    
    async executeSQLAgentRequest(request, card, container) {
        try {
            // Generate unique session ID for this request
            const uniqueSessionId = this.generateSessionId();
            card.dataset.sessionId = uniqueSessionId;
            
            // Display session ID in footer
            const sessionIdElement = card.querySelector('.sql-session-id');
            const footerElement = card.querySelector('.sql-card-footer');
            sessionIdElement.textContent = uniqueSessionId;
            footerElement.style.display = 'block';
            
            // Update status to processing
            card.classList.remove('pending');
            card.classList.add('processing');
            card.querySelector('.sql-status-icon').textContent = '🔄';
            card.querySelector('.sql-status-text').textContent = 'Processing';
            
            // Trigger SQL agent event - hard-coded to sqlagent for now
            const endpoint = '/sqlagent';
            const url = new URL(endpoint, window.location.origin);
            url.searchParams.append('question', request.question);
            url.searchParams.append('session_id', uniqueSessionId);
            
            const headers = {
                'Content-Type': 'application/json',
                'x-session-id': uniqueSessionId
            };
            
            const response = await window.authAPI.authenticatedFetch(url.toString(), {
                headers: headers
            });
            
            const data = await response.json();
            
            // Connect to WebSocket to receive the response with unique session ID
            await this.connectSQLAgentWebSocket(request, card, uniqueSessionId);
            
        } catch (error) {
            console.error(`Error executing SQL agent request ${request.sub_id}:`, error);
            
            // Update status to error
            card.classList.remove('pending', 'processing');
            card.classList.add('error');
            card.querySelector('.sql-status-icon').textContent = '❌';
            card.querySelector('.sql-status-text').textContent = 'Error';
            
            // Show error message
            const resultDiv = card.querySelector('.sql-card-result');
            const contentDiv = resultDiv.querySelector('.sql-result-content');
            contentDiv.innerHTML = `<div class="sql-error-message">Error: ${this.sanitizer.escapeHtml(error.message)}</div>`;
            resultDiv.style.display = 'block';
            
            // Show action buttons even for errors
            const actionsDiv = card.querySelector('.sql-card-actions');
            if (actionsDiv) {
                actionsDiv.style.display = 'flex';
            }
        }
    }
    
    async connectSQLAgentWebSocket(request, card, uniqueSessionId) {
        return new Promise((resolve, reject) => {
            const wsBase = window.app ? window.app.wsBase : 'ws://localhost:5055/ws';
            const wsUrl = `${wsBase}?session_id=${uniqueSessionId}`;
            
            console.log(`Connecting WebSocket for ${request.sub_id} with session: ${uniqueSessionId}`);
            
            let responseContent = '';
            
            const sqlWsHandler = new WebSocketHandler({
                maxRetries: 2,
                baseDelay: 500,
                preserveDataLineBreaks: false, // Normal line-by-line processing for SQL responses
                onMessage: (data, type) => {
                    if (type === 'data' || type === 'raw') {
                        responseContent += data + '\n';
                        console.log(`Added data to responseContent for ${request.sub_id}:`, data);
                    }
                },
                onStatusUpdate: (status) => {
                    // Update status text with the event message
                    if (status && status !== 'end') {
                        card.querySelector('.sql-status-text').textContent = status;
                    }
                    
                    if (status === 'end') {
                        // Request completed
                        card.classList.remove('pending', 'processing');
                        card.classList.add('completed');
                        card.querySelector('.sql-status-icon').textContent = '✅';
                        card.querySelector('.sql-status-text').textContent = 'Completed';
                    
                        // Show result
                        const resultDiv = card.querySelector('.sql-card-result');
                        const contentDiv = resultDiv.querySelector('.sql-result-content');
                        
                        // Render as markdown
                        console.log(`Final responseContent for ${request.sub_id}:`, responseContent);
                        marked.setOptions({
                            breaks: true,
                            gfm: true
                        });
                        const parsedResponse = marked.parse(responseContent);
                        contentDiv.innerHTML = this.sanitizer.sanitize(parsedResponse);
                        resultDiv.style.display = 'block';
                        
                        // Show action buttons
                        const actionsDiv = card.querySelector('.sql-card-actions');
                        if (actionsDiv) {
                            actionsDiv.style.display = 'flex';
                        }
                        
                        // Clean up handler
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
                    if (!card.classList.contains('completed')) {
                        this.sqlWebSocketHandlers.delete(uniqueSessionId);
                        reject(new Error('WebSocket closed unexpectedly'));
                    }
                }
            });
            
            // Store handler for cleanup
            this.sqlWebSocketHandlers.set(uniqueSessionId, sqlWsHandler);
            
            // Connect
            sqlWsHandler.connect(wsUrl).catch(error => {
                this.sqlWebSocketHandlers.delete(uniqueSessionId);
                reject(error);
            });
        });
    }
    
    escapeHtml(text) {
        return this.sanitizer.escapeHtml(text);
    }
    
    addEvaluationToSQLContainer(evaluationText) {
        if (!this.currentSQLContainer) return;
        
        // Create evaluation section
        const evaluationDiv = document.createElement('div');
        evaluationDiv.className = 'sql-evaluation-section';
        evaluationDiv.innerHTML = `
            <div class="sql-evaluation-header">
                <h4>Evaluation</h4>
            </div>
            <div class="sql-evaluation-content">
                ${this.sanitizer.sanitize(marked.parse(evaluationText))}
            </div>
        `;
        
        // Add to SQL container
        this.currentSQLContainer.appendChild(evaluationDiv);
        this.currentEvaluationDiv = evaluationDiv.querySelector('.sql-evaluation-content');
    }
    
    appendToEvaluation(text) {
        if (!this.currentEvaluationDiv) return;
        
        // Append to existing evaluation content
        const currentContent = this.currentEvaluationDiv.textContent;
        const parsedEvaluation = marked.parse(currentContent + '\n' + text);
        this.currentEvaluationDiv.innerHTML = this.sanitizer.sanitize(parsedEvaluation);
    }
    
    cleanupWebSocket() {
        if (this.wsHandler) {
            this.wsHandler.close();
            this.wsHandler = null;
        }
        
        // Clean up any SQL WebSocket handlers
        this.sqlWebSocketHandlers.forEach(handler => {
            handler.close();
        });
        this.sqlWebSocketHandlers.clear();
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
        this.cleanupWebSocket();
        
        // Re-enable send button
        if (this.sendButton) {
            this.sendButton.disabled = false;
        }
        
        // Reset SQL container references
        this.currentSQLContainer = null;
        this.currentEvaluationDiv = null;
        this.inEvaluationMode = false;
    }
}

// Export for testing
export { ScenarioAgent };

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.scenarioAgent = new ScenarioAgent();
});