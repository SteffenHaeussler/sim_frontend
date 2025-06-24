class ChatApp {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.websocket = null;

        // Template sets for different services
        this.templates = {
            'ask-agent': [
                "What is the daily maximum value of PI-P0017 for the last two weeks?",
                "How much was produced in the first two weeks of 2025?",
                "Can you plot me data for 18b04353-839d-40a1-84c1-9b547d09dd80 in Febuary?",
                "What is the current pressure in the distillation?",
                "Can you plot me the temperature of the distillation cooler A for the last two weeks?",
                "What is the level in Tank B?",
                "What is the id of TI-T0022?",
                "What assets are next to Asset BA100?"
            ],
            'lookup-service': [
                "Get Asset Info",
                "Get Neighbors", 
                "Get Asset Name",
                "Get Asset ID"
            ]
        };

        // Endpoint mapping for lookup service templates
        this.lookupEndpoints = {
            "Get Asset Info": "/api/asset/Tank A",
            "Get Neighbors": "/api/neighbor/12345678-1234-4567-8901-123456789abc",
            "Get Asset Name": "/api/name/12345678-1234-4567-8901-123456789abc", 
            "Get Asset ID": "/api/id/Tank A"
        };

        this.initializeElements();
        this.setupEventListeners();
        this.updateSessionId();
        this.setEnvVariables();
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
        this.newSessionButton = document.getElementById('new-session-btn');
        this.logoButton = document.querySelector('.icon-item.logo');
        this.iconBar = document.querySelector('.icon-bar');
        this.themeToggleButton = document.getElementById('theme-toggle-btn');
        this.askAgentButton = document.getElementById('ask-agent-btn');
        this.lookupServiceButton = document.getElementById('lookup-service-btn');
        this.currentActiveService = 'ask-agent'; // Default to ask-agent
        this.originalPlaceholder = this.questionInput.placeholder;
        this.initializeTheme();
        this.setActiveService(this.currentActiveService);
    }

    setupEventListeners() {
        this.sendButton.addEventListener('click', () => this.handleSendMessage());
        this.newSessionButton.addEventListener('click', () => this.handleNewSession());
        this.logoButton.addEventListener('click', () => this.toggleIconBar());
        this.themeToggleButton.addEventListener('click', () => this.toggleTheme());
        this.askAgentButton.addEventListener('click', () => this.setActiveService('ask-agent'));
        this.lookupServiceButton.addEventListener('click', () => this.setActiveService('lookup-service'));
        this.questionInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleSendMessage();
            }
        });

        // Add click listeners to template items
        document.querySelectorAll('.template-text').forEach(template => {
            template.addEventListener('click', () => this.handleTemplateClick(template));
        });

        // Add click listeners to icon labels
        document.querySelector('#new-session-btn .icon-label').addEventListener('click', () => this.handleNewSession());
        document.querySelector('#theme-toggle-btn .icon-label').addEventListener('click', () => this.toggleTheme());
    }

    updateSessionId() {
        this.sessionIdBottomElement.textContent = this.sessionId;
    }

    setEnvVariables() {
        // Get environment variables from window.ENV injected by template
        this.wsBase = window.ENV?.AGENT_WS_BASE || 'ws://localhost:5062/ws';
        this.agentApiUrl = window.ENV?.AGENT_URL || '/agent';
        this.agentApiBase = window.ENV?.AGENT_BASE || '';
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

    rateMessage(content, rating, button, otherButton, actionsDiv) {
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

        // Add thank you message below the button row
        const thankYouMsg = document.createElement('div');
        thankYouMsg.className = 'thank-you-message';
        thankYouMsg.textContent = 'Thank you!';
        actionsDiv.appendChild(thankYouMsg);

        // You can implement actual rating logic here (API call, etc.)
    }

    async triggerEvent(question) {
        let endpoint;

        if (this.currentActiveService === 'lookup-service') {
            // Map question to specific lookup endpoint
            endpoint = this.lookupEndpoints[question] || '/api/asset/Tank A';
        } else {
            // Default to core agent endpoint
            endpoint = '/agent';
        }

        const url = new URL(endpoint, window.location.origin);

        if (this.currentActiveService === 'lookup-service') {
            // For lookup endpoints, make a simple GET request
            const response = await fetch(url.toString());
            const data = await response.json();

            // Create a mock session for lookup service
            this.sessionId = this.generateSessionId();
            this.updateSessionId();

            // Add lookup response as a message
            this.addMessage(`Lookup Result: ${JSON.stringify(data, null, 2)}`, false, false);
            this.updateStatus('Ready');
            this.sendButton.disabled = false;

            return data;
        } else {
            // Original ask-agent logic
            url.searchParams.append('question', question);
            const response = await fetch(url.toString());
            const data = await response.json();
            this.sessionId = data.session_id;
            this.updateSessionId();
            return data;
        }
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

            // Only connect WebSocket for ask-agent service
            if (this.currentActiveService === 'ask-agent') {
                await this.connectWebSocket();
            }
        } catch (error) {
            console.error('Error:', error);
            this.updateStatus('Error');
            this.sendButton.disabled = false;
        }
    }

    handleNewChat() {
        // Generate new session ID
        this.sessionId = this.generateSessionId();
        this.updateSessionId();

        // Clear all messages
        this.messagesElement.innerHTML = '';

        // Clear input field
        this.questionInput.value = '';

        // Reset status
        this.updateStatus('Ready');

        // Close any existing WebSocket connection
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }

        // Re-enable send button
        this.sendButton.disabled = false;

        console.log('New chat started with session ID:', this.sessionId);
    }

    handleNewLookupSession() {
        // Generate new session ID
        this.sessionId = this.generateSessionId();
        this.updateSessionId();

        // Clear asset search
        if (this.assetNameSearch) {
            this.assetNameSearch.value = '';
        }
        if (this.assetTypeFilter) {
            this.assetTypeFilter.value = '';
        }
        if (this.typeFilter) {
            this.typeFilter.value = '';
        }
        this.currentPage = 1;

        // Clear asset information
        if (this.assetInfoName) {
            this.assetInfoName.value = '';
        }
        if (this.assetDetails) {
            this.assetDetails.innerHTML = `
                <div class="details-placeholder">
                    Enter an asset name to view details
                </div>
            `;
        }

        // Clear neighbor search
        if (this.neighborAssetId) {
            this.neighborAssetId.value = '';
        }
        if (this.neighborResults) {
            this.neighborResults.innerHTML = `
                <div class="neighbor-placeholder">
                    Enter an asset ID to find neighboring assets
                </div>
            `;
        }

        // Reload all assets
        this.loadAllAssets();

        console.log('New lookup session started with session ID:', this.sessionId);
    }

    handleNewSession() {
        if (this.currentActiveService === 'lookup-service') {
            this.handleNewLookupSession();
        } else {
            this.handleNewChat();
        }
    }

    toggleIconBar() {
        this.iconBar.classList.toggle('expanded');
    }

    handleTemplateClick(template) {
        const templateText = template.textContent.trim();
        
        if (this.currentActiveService === 'lookup-service') {
            // For lookup service, directly trigger the API call
            this.handleLookupRequest(templateText);
        } else {
            // For ask-agent, fill the input field as before
            this.questionInput.value = templateText;
            this.questionInput.focus();
        }
    }

    async handleLookupRequest(templateText) {
        // Add the template text as a question message
        this.addMessage(`Lookup: ${templateText}`, false, true);
        this.updateStatus('Processing...');

        try {
            await this.triggerEvent(templateText);
        } catch (error) {
            console.error('Error:', error);
            this.updateStatus('Error');
        }
    }

    initializeTheme() {
        // Check for saved theme preference or default to 'light'
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.currentTheme = savedTheme;
        this.applyTheme(savedTheme);
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);

        // Update button icon and label
        const icon = this.themeToggleButton.querySelector('.icon-svg');
        const label = this.themeToggleButton.querySelector('.icon-label');

        if (theme === 'dark') {
            icon.src = '/static/icons/sun.svg';
            icon.alt = 'Light Mode';
            label.textContent = 'Light Mode';
        } else {
            icon.src = '/static/icons/moon.svg';
            icon.alt = 'Dark Mode';
            label.textContent = 'Dark Mode';
        }
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.currentTheme = newTheme;
        this.applyTheme(newTheme);

        // Save theme preference
        localStorage.setItem('theme', newTheme);

        console.log(`Theme switched to: ${newTheme}`);
    }

    setActiveService(service) {
        // Remove active class from all service buttons
        this.askAgentButton.classList.remove('active');
        this.lookupServiceButton.classList.remove('active');

        // Add active class to selected service
        if (service === 'ask-agent') {
            this.askAgentButton.classList.add('active');
        } else if (service === 'lookup-service') {
            this.lookupServiceButton.classList.add('active');
        }

        // Update current active service
        this.currentActiveService = service;

        // Update templates for the selected service
        this.updateTemplates(service);

        // Show/hide input area based on service
        this.toggleInputArea(service);

        // Auto-trigger new session when switching services to clear state
        if (service === 'lookup-service') {
            this.handleNewLookupSession();
        } else {
            this.handleNewChat();
        }

        console.log(`Active service set to: ${service}`);
    }

    updateTemplates(service) {
        const templateContainer = document.querySelector('.template-list');
        const assetSearch = document.querySelector('.asset-search-main');
        const assetInfo = document.querySelector('.asset-info-main');
        const neighborSearch = document.querySelector('.neighbor-search-main');
        const chatContainer = document.querySelector('.chat-container');
        if (!templateContainer) return;

        if (service === 'lookup-service') {
            // Hide the entire template section for lookup service
            templateContainer.style.display = 'none';
            // Hide chat container and show asset sections
            if (chatContainer) chatContainer.style.display = 'none';
            if (assetSearch) {
                assetSearch.style.display = 'block';
                this.initializeAssetSearch();
            }
            if (assetInfo) {
                assetInfo.style.display = 'block';
                this.initializeAssetInfo();
            }
            if (neighborSearch) {
                neighborSearch.style.display = 'block';
                this.initializeNeighborSearch();
            }
        } else {
            // Show template section for ask-agent
            templateContainer.style.display = '';
            // Show chat container and hide asset sections
            if (chatContainer) chatContainer.style.display = 'block';
            if (assetSearch) {
                assetSearch.style.display = 'none';
            }
            if (assetInfo) {
                assetInfo.style.display = 'none';
            }
            if (neighborSearch) {
                neighborSearch.style.display = 'none';
            }

            // Get templates for the selected service
            const serviceTemplates = this.templates[service] || this.templates['ask-agent'];

            // Clear existing templates except the header
            const templateTexts = templateContainer.querySelectorAll('.template-text');
            templateTexts.forEach(template => template.remove());

            // Add new templates
            serviceTemplates.forEach(templateText => {
                const templateDiv = document.createElement('div');
                templateDiv.className = 'template-text';
                templateDiv.textContent = templateText;
                templateDiv.addEventListener('click', () => this.handleTemplateClick(templateDiv));
                templateContainer.appendChild(templateDiv);
            });
        }
    }

    toggleInputArea(service) {
        const inputArea = document.querySelector('.input-area');
        if (!inputArea) return;

        if (service === 'lookup-service') {
            // Hide input area for lookup service
            inputArea.style.display = 'none';
        } else {
            // Show input area for ask-agent service (restore original)
            inputArea.style.display = '';
        }
    }

    initializeAssetSearch() {
        if (this.assetSearchInitialized) return;
        
        this.currentPage = 1;
        this.assetSearchInitialized = true;
        
        // Get DOM elements
        this.assetNameSearch = document.getElementById('asset-name-search');
        this.assetTypeFilter = document.getElementById('asset-type-filter');
        this.typeFilter = document.getElementById('type-filter');
        this.clearFiltersBtn = document.getElementById('clear-filters');
        this.assetList = document.getElementById('asset-list');
        this.resultsCount = document.getElementById('results-count');
        this.prevPageBtn = document.getElementById('prev-page');
        this.nextPageBtn = document.getElementById('next-page');
        this.pageInfo = document.getElementById('page-info');
        
        // Set up event listeners
        this.assetNameSearch.addEventListener('input', () => this.searchAssets());
        this.assetTypeFilter.addEventListener('change', () => this.searchAssets());
        this.typeFilter.addEventListener('change', () => this.searchAssets());
        this.clearFiltersBtn.addEventListener('click', () => this.clearFilters());
        this.prevPageBtn.addEventListener('click', () => this.changePage(-1));
        this.nextPageBtn.addEventListener('click', () => this.changePage(1));
        
        // Load initial data and populate table
        this.loadFilterOptions();
        this.loadAllAssets();
    }

    async loadFilterOptions() {
        try {
            const response = await fetch('/lookup/search');
            const data = await response.json();
            
            // Populate asset type filter
            this.assetTypeFilter.innerHTML = '<option value="">Assets</option>';
            data.asset_types.forEach(type => {
                const option = document.createElement('option');
                option.value = type;
                option.textContent = type;
                this.assetTypeFilter.appendChild(option);
            });
            
            // Populate type filter
            this.typeFilter.innerHTML = '<option value="">Types</option>';
            data.types.forEach(type => {
                const option = document.createElement('option');
                option.value = type;
                option.textContent = type;
                this.typeFilter.appendChild(option);
            });
        } catch (error) {
            console.error('Failed to load filter options:', error);
        }
    }

    async loadAllAssets() {
        // Reset to first page and clear filters for initial load
        this.currentPage = 1;
        this.searchAssets();
    }

    async searchAssets() {
        const name = this.assetNameSearch.value.trim();
        const assetType = this.assetTypeFilter.value;
        const type = this.typeFilter.value;
        
        try {
            const params = new URLSearchParams({
                page: this.currentPage,
                limit: 10
            });
            
            if (name) params.append('name', name);
            if (assetType) params.append('asset_type', assetType);
            if (type) params.append('type', type);
            
            const response = await fetch(`/lookup/search?${params}`);
            const data = await response.json();
            
            this.displayAssets(data);
        } catch (error) {
            console.error('Search failed:', error);
        }
    }

    displayAssets(data) {
        // Update results count
        this.resultsCount.textContent = `${data.total_count} assets`;
        
        // Clear and populate asset list
        this.assetList.innerHTML = '';
        
        data.assets.forEach(asset => {
            const assetItem = document.createElement('div');
            assetItem.className = 'asset-item';
            assetItem.innerHTML = `
                <span class="asset-name">${asset.name}</span>
                <span class="asset-type">${asset.asset_type}</span>
            `;
            assetItem.addEventListener('click', () => this.selectAsset(asset));
            this.assetList.appendChild(assetItem);
        });
        
        // Update pagination
        this.updatePagination(data);
    }

    updatePagination(data) {
        this.pageInfo.textContent = `Page ${data.page} of ${data.total_pages}`;
        this.prevPageBtn.disabled = data.page <= 1;
        this.nextPageBtn.disabled = data.page >= data.total_pages;
    }

    changePage(direction) {
        this.currentPage += direction;
        this.searchAssets();
    }

    clearFilters() {
        this.assetNameSearch.value = '';
        this.assetTypeFilter.value = '';
        this.typeFilter.value = '';
        this.currentPage = 1;
        this.searchAssets();
    }

    selectAsset(asset) {
        // Add selected asset to chat
        this.addMessage(`Selected Asset: ${asset.name} (${asset.asset_type})`, false, true);
        console.log('Selected asset:', asset);
        
        // Populate only the asset name in the input field
        if (this.assetInfoName) {
            this.assetInfoName.value = asset.name;
        }
    }

    initializeAssetInfo() {
        if (this.assetInfoInitialized) return;
        
        this.assetInfoInitialized = true;
        
        // Get DOM elements
        this.assetInfoName = document.getElementById('asset-info-name');
        this.getAssetInfoBtn = document.getElementById('get-asset-info');
        this.assetDetails = document.getElementById('asset-details');
        
        // Set up event listeners
        this.getAssetInfoBtn.addEventListener('click', () => this.handleGetAssetInfo());
        this.assetInfoName.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleGetAssetInfo();
            }
        });
    }

    async handleGetAssetInfo() {
        const assetInput = this.assetInfoName.value.trim();
        if (!assetInput) {
            this.showAssetDetails(null, 'Please enter an asset name or ID');
            return;
        }

        try {
            let assetId;
            let inputType;

            // Check if input looks like a UUID (asset ID)
            const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            const isUuid = uuidPattern.test(assetInput);
            inputType = isUuid ? 'ID' : 'name';

            if (isUuid) {
                // Input is already an asset ID, skip the first API call
                assetId = assetInput;
                console.log('Input detected as UUID, using directly:', assetId);
            } else {
                // Input is an asset name, get ID from name first
                console.log('Input detected as name, fetching ID for:', assetInput);
                const idResponse = await fetch(`/api/id/${encodeURIComponent(assetInput)}`);
                const idData = await idResponse.json();
                
                if (idData.error) {
                    this.showAssetDetails(null, `Asset name "${assetInput}" was not found. Please check the spelling and try again.`);
                    return;
                }

                // Extract the asset ID from the response
                assetId = idData.id || idData.asset_id || idData;
                if (!assetId) {
                    this.showAssetDetails(null, `No ID found for asset name "${assetInput}". Please verify the name is correct.`);
                    return;
                }
            }

            // Get asset details using the ID
            const assetResponse = await fetch(`/api/asset/${encodeURIComponent(assetId)}`);
            const assetData = await assetResponse.json();
            
            if (assetData.error) {
                this.showAssetDetails(null, `Asset with ${inputType} "${assetInput}" was not found. Please check and try again.`);
            } else {
                this.showAssetDetails(assetData, null);
            }
        } catch (error) {
            console.error('Failed to get asset info:', error);
            this.showAssetDetails(null, 'Failed to fetch asset information');
        }
    }

    showAssetDetails(assetData, errorMessage) {
        if (errorMessage) {
            this.assetDetails.innerHTML = `
                <div class="details-placeholder">
                    ${errorMessage}
                </div>
            `;
            return;
        }

        if (!assetData) {
            this.assetDetails.innerHTML = `
                <div class="details-placeholder">
                    Enter an asset name to view details
                </div>
            `;
            return;
        }

        // Display JSON response as key-value rows with custom ordering
        let detailsHtml = '';
        
        // Collect all key-value pairs first
        const allFields = {};
        
        const processObject = (obj, prefix = '') => {
            for (const [key, value] of Object.entries(obj)) {
                const displayKey = prefix ? `${prefix}.${key}` : key;
                
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    // Nested object - recurse
                    processObject(value, displayKey);
                } else {
                    // Simple value - store in collection
                    allFields[displayKey] = Array.isArray(value) ? JSON.stringify(value) : String(value);
                }
            }
        };
        
        processObject(assetData);
        
        // Define priority order for important fields
        const priorityFields = ['name', 'id', 'description'];
        
        // Create rows for priority fields first
        priorityFields.forEach(fieldName => {
            if (allFields[fieldName]) {
                const displayValue = allFields[fieldName];
                const escapedValue = displayValue.replace(/'/g, "\\'").replace(/"/g, '\\"');
                detailsHtml += `
                    <div class="asset-detail-item">
                        <span class="detail-label">${fieldName}:</span>
                        <span class="detail-value">${displayValue}</span>
                        <button class="copy-value-btn" onclick="window.chatApp.copyAssetValue('${escapedValue}', this)" title="Copy value">
                            <img src="/static/icons/copy.svg" alt="Copy">
                        </button>
                    </div>
                `;
                delete allFields[fieldName]; // Remove from remaining fields
            }
        });
        
        // Sort remaining fields alphabetically and create rows
        const remainingFields = Object.keys(allFields).sort();
        remainingFields.forEach(fieldName => {
            const displayValue = allFields[fieldName];
            const escapedValue = displayValue.replace(/'/g, "\\'").replace(/"/g, '\\"');
            detailsHtml += `
                <div class="asset-detail-item">
                    <span class="detail-label">${fieldName}:</span>
                    <span class="detail-value">${displayValue}</span>
                    <button class="copy-value-btn" onclick="window.chatApp.copyAssetValue('${escapedValue}', this)" title="Copy value">
                        <img src="/static/icons/copy.svg" alt="Copy">
                    </button>
                </div>
            `;
        });
        
        this.assetDetails.innerHTML = detailsHtml;
    }

    async copyAssetValue(value, button) {
        try {
            await navigator.clipboard.writeText(value);
            console.log('Asset value copied to clipboard:', value);

            // Show visual feedback
            const originalIcon = button.innerHTML;
            button.innerHTML = '<img src="/static/icons/copy-active.svg" alt="Copied">';
            button.disabled = true;
            button.title = 'Copied!';

            // Reset after 2 seconds
            setTimeout(() => {
                button.innerHTML = originalIcon;
                button.disabled = false;
                button.title = 'Copy value';
            }, 2000);
        } catch (err) {
            console.error('Failed to copy asset value: ', err);
        }
    }

    initializeNeighborSearch() {
        if (this.neighborSearchInitialized) return;
        
        this.neighborSearchInitialized = true;
        
        // Get DOM elements
        this.neighborAssetId = document.getElementById('neighbor-asset-id');
        this.getNeighborsBtn = document.getElementById('get-neighbors');
        this.neighborResults = document.getElementById('neighbor-results');
        
        // Set up event listeners
        this.getNeighborsBtn.addEventListener('click', () => this.handleGetNeighbors());
        this.neighborAssetId.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleGetNeighbors();
            }
        });
    }

    async handleGetNeighbors() {
        const assetId = this.neighborAssetId.value.trim();
        if (!assetId) {
            this.showNeighborResults(null, 'Please enter an asset ID');
            return;
        }

        try {
            // Make API call to neighbor endpoint
            const response = await fetch(`/api/neighbor/${encodeURIComponent(assetId)}`);
            const data = await response.json();
            
            if (data.error) {
                this.showNeighborResults(null, `Asset ID "${assetId}" was not found. Please check and try again.`);
            } else {
                this.showNeighborResults(data, null);
            }
        } catch (error) {
            console.error('Failed to get neighbors:', error);
            this.showNeighborResults(null, 'Failed to fetch neighbor information');
        }
    }

    showNeighborResults(neighborData, errorMessage) {
        if (errorMessage) {
            this.neighborResults.innerHTML = `
                <div class="neighbor-placeholder">
                    ${errorMessage}
                </div>
            `;
            return;
        }

        if (!neighborData) {
            this.neighborResults.innerHTML = `
                <div class="neighbor-placeholder">
                    Enter an asset ID to find neighboring assets
                </div>
            `;
            return;
        }

        // Display neighbor IDs as a list
        let neighborsHtml = '';
        
        // Handle different response formats - could be array or object with array
        let neighborIds = [];
        if (Array.isArray(neighborData)) {
            neighborIds = neighborData;
        } else if (neighborData.neighbors && Array.isArray(neighborData.neighbors)) {
            neighborIds = neighborData.neighbors;
        } else if (neighborData.ids && Array.isArray(neighborData.ids)) {
            neighborIds = neighborData.ids;
        } else {
            // Try to extract any array from the response
            for (const [key, value] of Object.entries(neighborData)) {
                if (Array.isArray(value)) {
                    neighborIds = value;
                    break;
                }
            }
        }

        if (neighborIds.length === 0) {
            this.neighborResults.innerHTML = `
                <div class="neighbor-placeholder">
                    No neighboring assets found for this ID
                </div>
            `;
            return;
        }

        neighborIds.forEach(neighborId => {
            const escapedId = String(neighborId).replace(/'/g, "\\'").replace(/"/g, '\\"');
            neighborsHtml += `
                <div class="neighbor-item">
                    <span class="neighbor-id">${neighborId}</span>
                    <button class="neighbor-copy-btn" onclick="window.chatApp.copyNeighborId('${escapedId}', this)" title="Copy neighbor ID">
                        <img src="/static/icons/copy.svg" alt="Copy">
                    </button>
                </div>
            `;
        });
        
        this.neighborResults.innerHTML = neighborsHtml;
    }

    async copyNeighborId(neighborId, button) {
        try {
            await navigator.clipboard.writeText(neighborId);
            console.log('Neighbor ID copied to clipboard:', neighborId);

            // Show visual feedback
            const originalIcon = button.innerHTML;
            button.innerHTML = '<img src="/static/icons/copy-active.svg" alt="Copied">';
            button.disabled = true;
            button.title = 'Copied!';

            // Reset after 2 seconds
            setTimeout(() => {
                button.innerHTML = originalIcon;
                button.disabled = false;
                button.title = 'Copy neighbor ID';
            }, 2000);
        } catch (err) {
            console.error('Failed to copy neighbor ID: ', err);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.chatApp = new ChatApp();
});
