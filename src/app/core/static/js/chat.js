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
                "Asset names",
                "Asset Information",
                "Neighbouring assets",
                "Assed Ids"
            ]
        };

        // Endpoint mapping for lookup service templates
        this.lookupEndpoints = {
            "Asset names": "/lookup/asset-names",
            "Asset Information": "/lookup/asset-info",
            "Neighbouring assets": "/lookup/neighbouring-assets",
            "Assed Ids": "/lookup/asset-ids"
        };

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

    async loadConfig() {
        try {
            const response = await fetch('/config');
            const config = await response.json();
            this.wsBase = config.agent_ws_base;
            this.agentApiUrl = config.agent_api_url;
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
            endpoint = this.lookupEndpoints[question] || '/lookup/default';
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

    handleNewSession() {
        // Same functionality as handleNewChat
        this.handleNewChat();
    }

    toggleIconBar() {
        this.iconBar.classList.toggle('expanded');
    }

    handleTemplateClick(template) {
        const templateText = template.textContent.trim();
        this.questionInput.value = templateText;
        this.questionInput.focus();
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

        console.log(`Active service set to: ${service}`);
    }

    updateTemplates(service) {
        const templateContainer = document.querySelector('.template-list');
        if (!templateContainer) return;

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

document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});
