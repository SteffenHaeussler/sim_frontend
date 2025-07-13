class ScenarioAgent {
    constructor() {
        this.websocket = null;
        this.currentSQLContainer = null;
        this.currentEvaluationDiv = null;
        this.inEvaluationMode = false;
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
            console.log('Scenario WebSocket raw message:', message);

            // Handle multiple messages in a single WebSocket frame
            const lines = message.split('\n').filter(line => line.trim());
            
            for (const line of lines) {
                console.log('Processing line:', line);
                
                if (line.startsWith("event: ")) {
                    // Handle status updates
                    const statusText = line.replace("event: ", "").trim();
                    if (statusText) {
                        this.updateStatus(statusText);
                    }
                    
                    // Check if we're entering evaluation mode
                    if (statusText === "Evaluating...") {
                        this.inEvaluationMode = true;
                    }
                    
                    // Check for end event
                    if (line.startsWith("event: end")) {
                        this.updateStatus('Ready');
                        this.inEvaluationMode = false;
                        if (this.websocket) {
                            this.websocket.close();
                        }
                    }
                } else if (line.startsWith("data: ")) {
                    const data = line.replace("data: ", "").trim();
                    console.log('Scenario data received:', data);
                    if (data) {
                        // Try to parse as JSON
                        try {
                            const jsonData = JSON.parse(data);
                            console.log('Successfully parsed JSON:', jsonData);
                            console.log('First item check:', {
                                isArray: Array.isArray(jsonData),
                                length: jsonData.length,
                                firstItem: jsonData[0],
                                hasSub_id: jsonData[0]?.sub_id !== undefined,
                                hasQuestion: jsonData[0]?.question !== undefined,
                                hasEndpoint: jsonData[0]?.endpoint !== undefined || jsonData[0]?.end_point !== undefined
                            });
                            
                            // Check if this is a list of SQL agent requests
                            if (Array.isArray(jsonData) && jsonData.length > 0 && 
                                jsonData[0].sub_id !== undefined && 
                                jsonData[0].question !== undefined && 
                                (jsonData[0].end_point !== undefined || jsonData[0].endpoint !== undefined)) {
                                console.log('Handling as SQL agent requests');
                                // Handle SQL agent requests
                                this.handleSQLAgentRequests(jsonData);
                            } else {
                                console.log('Handling as regular JSON');
                                // Regular JSON display
                                this.addJsonMessage(jsonData);
                            }
                        } catch (e) {
                            console.log('Failed to parse as JSON:', e);
                            // Check if this is evaluation text and we're in evaluation mode
                            if (this.inEvaluationMode && this.currentSQLContainer) {
                                this.addEvaluationToSQLContainer(data);
                            } else {
                                // Not JSON, handle as regular markdown
                                this.addMessage(data);
                            }
                        }
                    }
                } else if (line.trim().startsWith('[') && line.trim().endsWith(']')) {
                    // Handle JSON array that comes without "data: " prefix
                    console.log('Detected raw JSON array:', line);
                    try {
                        const jsonData = JSON.parse(line);
                        console.log('Successfully parsed JSON:', jsonData);
                        
                        // Check if this is a list of SQL agent requests
                        if (Array.isArray(jsonData) && jsonData.length > 0 && 
                            jsonData[0].sub_id !== undefined && 
                            jsonData[0].question !== undefined && 
                            (jsonData[0].end_point !== undefined || jsonData[0].endpoint !== undefined)) {
                            console.log('Handling as SQL agent requests');
                            // Handle SQL agent requests
                            this.handleSQLAgentRequests(jsonData);
                            // Store reference to container for evaluation text
                            this.currentSQLContainer = this.messagesElement.lastElementChild;
                        } else {
                            console.log('Handling as regular JSON');
                            // Regular JSON display
                            this.addJsonMessage(jsonData);
                        }
                    } catch (e) {
                        console.log('Failed to parse raw JSON:', e);
                        // If it's not JSON, treat as regular message
                        this.addMessage(line);
                    }
                } else if (line.trim()) {
                    // Other non-empty lines that don't match above patterns
                    console.log('Treating as regular message:', line);
                    // Check if this is continuation of evaluation text
                    if (this.inEvaluationMode && this.currentSQLContainer && this.currentEvaluationDiv) {
                        this.appendToEvaluation(line);
                    } else if (this.inEvaluationMode && this.currentSQLContainer && !this.currentEvaluationDiv) {
                        // First line of evaluation without header
                        this.addEvaluationToSQLContainer(line);
                    } else {
                        this.addMessage(line);
                    }
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
            <div class="sql-card-footer" style="display: none;">
                <span class="sql-session-id"></span>
            </div>
        `;
        
        return card;
    }
    
    generateSessionId() {
        return 'sql-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
    
    async executeSQLAgentRequest(request, card, container) {
        try {
            // Generate unique session ID for this request
            const uniqueSessionId = this.generateSessionId();
            card.dataset.sessionId = uniqueSessionId;
            
            // Display session ID in footer
            const sessionIdElement = card.querySelector('.sql-session-id');
            const footerElement = card.querySelector('.sql-card-footer');
            sessionIdElement.textContent = `Session: ${uniqueSessionId}`;
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
            contentDiv.innerHTML = `<div class="sql-error-message">Error: ${error.message}</div>`;
            resultDiv.style.display = 'block';
        }
    }
    
    async connectSQLAgentWebSocket(request, card, uniqueSessionId) {
        return new Promise((resolve, reject) => {
            const wsBase = window.app ? window.app.wsBase : 'ws://localhost:5055/ws';
            const wsUrl = `${wsBase}?session_id=${uniqueSessionId}`;
            
            console.log(`Connecting WebSocket for ${request.sub_id} with session: ${uniqueSessionId}`);
            const ws = new WebSocket(wsUrl);
            let responseContent = '';
            
            ws.onmessage = (event) => {
                const message = event.data;
                console.log(`WebSocket message for ${request.sub_id}:`, message);
                
                if (message.startsWith("event: ")) {
                    const statusText = message.replace("event: ", "").trim();
                    
                    // Update status text with the event message
                    if (statusText && !message.startsWith("event: end")) {
                        card.querySelector('.sql-status-text').textContent = statusText;
                    }
                    
                    if (message.startsWith("event: end")) {
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
                        contentDiv.innerHTML = marked.parse(responseContent);
                        resultDiv.style.display = 'block';
                        
                        ws.close();
                        resolve();
                    }
                } else if (message.startsWith("data: ")) {
                    const data = message.substring(6); // Keep everything after "data: " including spaces and newlines
                    responseContent += data + '\n';
                    console.log(`Added data to responseContent for ${request.sub_id}:`, data);
                } else {
                    // Handle messages that don't follow event/data format
                    // This could be raw response data
                    if (message.trim()) {
                        responseContent += message + '\n';
                    }
                }
            };
            
            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                reject(error);
            };
            
            ws.onclose = () => {
                if (!card.classList.contains('completed')) {
                    reject(new Error('WebSocket closed unexpectedly'));
                }
            };
        });
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
                ${marked.parse(evaluationText)}
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
        this.currentEvaluationDiv.innerHTML = marked.parse(currentContent + '\n' + text);
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
        
        // Reset SQL container references
        this.currentSQLContainer = null;
        this.currentEvaluationDiv = null;
        this.inEvaluationMode = false;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.scenarioAgent = new ScenarioAgent();
});