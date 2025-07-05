class App {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.currentActiveService = 'ask-agent'; // Default to ask-agent

        this.initializeElements();
        this.setupEventListeners();
        this.updateSessionId();
        this.setEnvVariables();
        this.initializeTheme();
        this.initializeSidebar();
        this.checkInitialAuthState();
    }

    generateSessionId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    generateRequestId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    getTrackingHeaders(eventId = null) {
        const headers = {
            'X-Session-ID': this.sessionId,
            'X-Request-ID': this.generateRequestId()
        };

        if (eventId) {
            headers['X-Event-ID'] = eventId;
        }

        return headers;
    }

    initializeElements() {
        this.sessionIdBottomElement = document.getElementById('session-id-bottom');
        this.logoButton = document.querySelector('.icon-item.logo');
        this.iconBar = document.querySelector('.icon-bar');
        this.themeToggleButton = document.getElementById('theme-toggle-btn');
        this.askAgentButton = document.getElementById('ask-agent-btn');
        this.lookupServiceButton = document.getElementById('lookup-service-btn');
        this.askSqlAgentButton = document.getElementById('ask-sql-agent-btn');
        this.searchButton = document.getElementById('search-btn');
        this.libraryButton = document.getElementById('library-btn');
        this.userGreeting = document.getElementById('user-greeting');
        
    }

    setupEventListeners() {
        this.logoButton.addEventListener('click', () => this.toggleIconBar());
        this.themeToggleButton.addEventListener('click', () => this.toggleTheme());
        this.askAgentButton.addEventListener('click', () => this.handleServiceClickWithNewSession('ask-agent'));
        this.lookupServiceButton.addEventListener('click', () => this.handleServiceClickWithNewSession('lookup-service'));
        
        this.askSqlAgentButton.addEventListener('click', () => this.handleServiceClickWithNewSession('ask-sql-agent'));
        
        this.searchButton.addEventListener('click', () => this.handleServiceClick('search'));
        this.libraryButton.addEventListener('click', () => this.handleServiceClick('library'));

        // User greeting click for new session
        if (this.userGreeting) {
            this.userGreeting.addEventListener('click', () => this.handleProtectedAction('new-session'));
        }

        // Add click listeners to template items
        document.querySelectorAll('.template-text').forEach(template => {
            template.addEventListener('click', () => this.handleTemplateClick(template));
        });

        // Add click listeners to icon labels
        document.querySelector('#theme-toggle-btn .icon-label').addEventListener('click', () => this.toggleTheme());
        document.querySelector('#ask-agent-btn .icon-label').addEventListener('click', () => this.handleServiceClickWithNewSession('ask-agent'));
        document.querySelector('#lookup-service-btn .icon-label').addEventListener('click', () => this.handleServiceClickWithNewSession('lookup-service'));
        
        document.querySelector('#ask-sql-agent-btn .icon-label').addEventListener('click', () => this.handleServiceClickWithNewSession('ask-sql-agent'));
        
        document.querySelector('#search-btn .icon-label').addEventListener('click', () => this.handleServiceClick('search'));
        document.querySelector('#library-btn .icon-label').addEventListener('click', () => this.handleServiceClick('library'));
    }

    updateSessionId() {
        this.sessionIdBottomElement.textContent = this.sessionId;
    }

    setEnvVariables() {
        // Get environment variables from window.ENV injected by template
        this.wsBase = window.ENV?.AGENT_WS_BASE || 'ws://localhost:5062/ws';
        this.agentApiUrl = window.ENV?.AGENT_URL || '/agent';
        this.agentApiBase = window.ENV?.AGENT_BASE || '';
        this.semanticApiBase = window.ENV?.SEMANTIC_BASE || '';
        this.semanticEmbUrl = window.ENV?.SEMANTIC_EMB_URL || '';
        this.semanticRankUrl = window.ENV?.SEMANTIC_RANK_URL || '';
        this.semanticSearchUrl = window.ENV?.SEMANTIC_SEARCH_URL || '';
    }

    initializeTheme() {
        // Check for saved theme preference or default to 'light'
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.currentTheme = savedTheme;
        this.applyTheme(savedTheme);
    }

    initializeSidebar() {
        // Set sidebar to expanded by default
        this.iconBar.classList.add('expanded');
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

    toggleIconBar() {
        this.iconBar.classList.toggle('expanded');
    }

    handleServiceClick(service) {
        // Define protected services
        const protectedServices = ['ask-agent', 'ask-sql-agent', 'lookup-service', 'search', 'library'];

        // Check if user is logged in for protected services
        if (protectedServices.includes(service) && !this.isUserLoggedIn()) {
            this.showLoginRequired();
            return;
        }

        // For now, only ask-agent and lookup-service are implemented
        if (service === 'search' || service === 'library') {
            // Just silently do nothing for unimplemented services
            return;
        }

        // User is logged in and service is implemented, proceed
        this.setActiveService(service);
    }

    handleServiceClickWithNewSession(service) {
        // Define protected services
        const protectedServices = ['ask-agent', 'ask-sql-agent', 'lookup-service', 'search', 'library'];

        // Check if user is logged in for protected services
        if (protectedServices.includes(service) && !this.isUserLoggedIn()) {
            this.showLoginRequired();
            return;
        }

        // For now, only ask-agent and lookup-service are implemented
        if (service === 'search' || service === 'library') {
            // Just silently do nothing for unimplemented services
            return;
        }

        // User is logged in and service is implemented, start new session and set service
        this.handleNewSession();
        this.setActiveService(service);
    }

    handleProtectedAction(action) {
        // Check if user is logged in for protected actions
        if (!this.isUserLoggedIn()) {
            this.showLoginRequired();
            return;
        }

        // User is logged in, proceed with action
        if (action === 'new-session') {
            this.handleNewSession();
        }
    }

    setActiveService(service) {
        // Remove active class from all service buttons
        this.askAgentButton.classList.remove('active');
        this.lookupServiceButton.classList.remove('active');
        this.askSqlAgentButton.classList.remove('active');

        // Add active class to selected service
        if (service === 'ask-agent') {
            this.askAgentButton.classList.add('active');
        } else if (service === 'lookup-service') {
            this.lookupServiceButton.classList.add('active');
        } else if (service === 'ask-sql-agent') {
            this.askSqlAgentButton.classList.add('active');
        }

        // Update current active service
        this.currentActiveService = service;

        // Update templates and input area for the selected service
        this.updateTemplates(service);
        this.toggleInputArea(service);

        // Initialize the appropriate service module
        if (service === 'lookup-service') {
            if (window.lookupService) {
                // Initialize modules first
                window.lookupService.assetSearch.initialize();
                window.lookupService.assetInfo.initialize();
                window.lookupService.neighborSearch.initialize();
                window.lookupService.semanticSearch.initialize();

                // Reset to fresh state with data
                window.lookupService.assetSearch.reset();
                window.lookupService.assetInfo.reset();
                window.lookupService.neighborSearch.reset();
                window.lookupService.semanticSearch.reset();

                window.lookupService.updateSessionId();
            }
        } else if (service === 'ask-sql-agent') {
            if (window.sqlAgent) {
                console.log('Initializing SQL Agent without clearing session');
                // Update session ID when SQL Agent becomes active
                window.sqlAgent.updateSessionId();
            }
        } else {
            if (window.askAgent) {
                window.askAgent.handleNewSession();
            }
        }

        console.log(`Active service set to: ${service}`);
    }

    updateTemplates(service) {
        console.log('updateTemplates called with service:', service);
        const templateContainer = document.querySelector('.template-list');
        const chatContainer = document.querySelector('.chat-container');
        const sqlChatContainer = document.querySelector('.sql-chat-container');
        const lookupContainer = document.querySelector('.lookup-container');

        if (!templateContainer) return;

        if (service === 'lookup-service') {
            // Hide template section and chat, show lookup
            templateContainer.style.display = 'none';
            if (chatContainer) chatContainer.style.display = 'none';
            if (sqlChatContainer) sqlChatContainer.style.display = 'none';
            if (lookupContainer) lookupContainer.style.display = 'block';
        } else if (service === 'ask-sql-agent') {
            // Show template section and SQL chat, hide regular chat and lookup
            console.log('updateTemplates called with ask-sql-agent');
            templateContainer.style.display = '';
            if (chatContainer) chatContainer.style.display = 'none';
            if (sqlChatContainer) {
                console.log('Setting SQL chat container to display: block');
                sqlChatContainer.style.display = 'block';
                console.log('SQL chat container after setting visible:', sqlChatContainer);
                
                // Debug: Check if sql-messages element exists
                const sqlMessagesEl = document.getElementById('sql-messages');
                console.log('sql-messages element:', sqlMessagesEl);
                if (window.sqlAgent) {
                    console.log('SQL Agent messagesElement:', window.sqlAgent.messagesElement);
                }
            } else {
                console.error('SQL chat container not found!');
            }
            if (lookupContainer) lookupContainer.style.display = 'none';
        } else {
            // Show template section and regular chat, hide SQL chat and lookup
            templateContainer.style.display = '';
            if (chatContainer) chatContainer.style.display = 'block';
            if (sqlChatContainer) sqlChatContainer.style.display = 'none';
            if (lookupContainer) lookupContainer.style.display = 'none';

            // Clear existing templates except the header
            const templateTexts = templateContainer.querySelectorAll('.template-text');
            templateTexts.forEach(template => template.remove());

            // Define templates based on service
            let templates = [];
            if (service === 'ask-sql-agent') {
                templates = [
                    "Show me the top 10 assets by production volume",
                    "What is the average temperature for all sensors this week?",
                    "List all assets with pressure above 100 PSI",
                    "Show me daily production trends for the last month",
                    "Which tanks have levels below 20%?",
                    "Get all maintenance records for asset TI-T0022",
                    "Show me assets that haven't reported data in 24 hours",
                    "What are the peak operating hours for production units?"
                ];
            } else {
                // Default ask-agent templates
                templates = [
                    "What is the daily maximum value of PI-P0017 for the last two weeks?",
                    "How much was produced in the first two weeks of 2025?",
                    "Can you plot me data for 18b04353-839d-40a1-84c1-9b547d09dd80 in Febuary?",
                    "What is the current pressure in the distillation?",
                    "Can you plot me the temperature of the distillation cooler A for the last two weeks?",
                    "What is the level in Tank B?",
                    "What is the id of TI-T0022?",
                    "What assets are next to Asset BA100?"
                ];
            }

            templates.forEach(templateText => {
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
        const sqlInputArea = document.querySelector('.sql-input-area');
        
        console.log('toggleInputArea called with service:', service);
        console.log('inputArea:', inputArea, 'sqlInputArea:', sqlInputArea);
        
        if (service === 'lookup-service') {
            // Hide both input areas for lookup service
            if (inputArea) inputArea.style.display = 'none';
            if (sqlInputArea) sqlInputArea.style.display = 'none';
        } else if (service === 'ask-sql-agent') {
            // Show SQL input area, hide regular input area
            if (inputArea) inputArea.style.display = 'none';
            if (sqlInputArea) sqlInputArea.style.display = 'block';
            console.log('SQL input area should now be visible');
        } else {
            // Show regular input area, hide SQL input area
            if (inputArea) inputArea.style.display = '';
            if (sqlInputArea) sqlInputArea.style.display = 'none';
            console.log('Regular input area should now be visible');
        }
    }

    handleTemplateClick(template) {
        // Check authentication for protected services
        if (!this.isUserLoggedIn()) {
            this.showLoginRequired();
            return;
        }

        const templateText = template.textContent.trim();

        if (this.currentActiveService === 'lookup-service') {
            // For lookup service, this shouldn't happen as templates are hidden
            console.warn('Template clicked in lookup service mode');
        } else if (this.currentActiveService === 'ask-sql-agent') {
            // For sql-agent, delegate to sql-agent module
            if (window.sqlAgent) {
                window.sqlAgent.handleTemplateClick(templateText);
            }
        } else {
            // For ask-agent, delegate to ask-agent module
            if (window.askAgent) {
                window.askAgent.handleTemplateClick(templateText);
            }
        }
    }

    handleNewSession() {
        // Generate new session ID
        this.sessionId = this.generateSessionId();
        this.updateSessionId();

        // Delegate to appropriate service
        if (this.currentActiveService === 'lookup-service') {
            if (window.lookupService) {
                window.lookupService.handleNewSession();
            }
        } else if (this.currentActiveService === 'ask-sql-agent') {
            if (window.sqlAgent) {
                console.log('Calling SQL Agent handleNewSession from new session handler');
                window.sqlAgent.handleNewSession();
            }
        } else {
            if (window.askAgent) {
                window.askAgent.handleNewSession();
            }
        }

        console.log('New session started with session ID:', this.sessionId);
    }

    isUserLoggedIn() {
        return window.authAPI && window.authAPI.isLoggedIn();
    }

    showLoginRequired() {
        // Show login modal with message
        if (window.authUI && typeof window.authUI.showLoginModal === 'function') {
            window.authUI.showLoginModal('You need to be logged in to use this service.');
        } else {
            // Fallback alert
            alert('Please log in to access this feature.');
        }
    }

    checkInitialAuthState() {
        // Wait a bit for auth system to initialize
        setTimeout(() => {
            if (this.isUserLoggedIn()) {
                // User is logged in, proceed with normal service
                this.setActiveService(this.currentActiveService);
            } else {
                // User not logged in, don't activate any service
                this.currentActiveService = null;
                console.log('User not logged in - services disabled');
            }
        }, 100);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
