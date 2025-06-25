class App {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.currentActiveService = 'ask-agent'; // Default to ask-agent

        this.initializeElements();
        this.setupEventListeners();
        this.updateSessionId();
        this.setEnvVariables();
        this.initializeTheme();
        this.setActiveService(this.currentActiveService);
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
        this.logoButton = document.querySelector('.icon-item.logo');
        this.iconBar = document.querySelector('.icon-bar');
        this.themeToggleButton = document.getElementById('theme-toggle-btn');
        this.askAgentButton = document.getElementById('ask-agent-btn');
        this.lookupServiceButton = document.getElementById('lookup-service-btn');
        this.newSessionButton = document.getElementById('new-session-btn');
    }

    setupEventListeners() {
        this.newSessionButton.addEventListener('click', () => this.handleNewSession());
        this.logoButton.addEventListener('click', () => this.toggleIconBar());
        this.themeToggleButton.addEventListener('click', () => this.toggleTheme());
        this.askAgentButton.addEventListener('click', () => this.setActiveService('ask-agent'));
        this.lookupServiceButton.addEventListener('click', () => this.setActiveService('lookup-service'));

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

        // Update templates and input area for the selected service
        this.updateTemplates(service);
        this.toggleInputArea(service);

        // Initialize the appropriate service module
        if (service === 'lookup-service') {
            if (window.lookupService) {
                window.lookupService.handleNewSession();
                window.lookupService.updateSessionId();
            }
        } else {
            if (window.askAgent) {
                window.askAgent.handleNewSession();
            }
        }

        console.log(`Active service set to: ${service}`);
    }

    updateTemplates(service) {
        const templateContainer = document.querySelector('.template-list');
        const chatContainer = document.querySelector('.chat-container');
        const lookupContainer = document.querySelector('.lookup-container');

        if (!templateContainer) return;

        if (service === 'lookup-service') {
            // Hide template section and chat, show lookup
            templateContainer.style.display = 'none';
            if (chatContainer) chatContainer.style.display = 'none';
            if (lookupContainer) lookupContainer.style.display = 'block';
        } else {
            // Show template section and chat, hide lookup
            templateContainer.style.display = '';
            if (chatContainer) chatContainer.style.display = 'block';
            if (lookupContainer) lookupContainer.style.display = 'none';

            // Clear existing templates except the header
            const templateTexts = templateContainer.querySelectorAll('.template-text');
            templateTexts.forEach(template => template.remove());

            // Add ask-agent templates
            const askAgentTemplates = [
                "What is the daily maximum value of PI-P0017 for the last two weeks?",
                "How much was produced in the first two weeks of 2025?",
                "Can you plot me data for 18b04353-839d-40a1-84c1-9b547d09dd80 in Febuary?",
                "What is the current pressure in the distillation?",
                "Can you plot me the temperature of the distillation cooler A for the last two weeks?",
                "What is the level in Tank B?",
                "What is the id of TI-T0022?",
                "What assets are next to Asset BA100?"
            ];

            askAgentTemplates.forEach(templateText => {
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
            // Show input area for ask-agent service
            inputArea.style.display = '';
        }
    }

    handleTemplateClick(template) {
        const templateText = template.textContent.trim();

        if (this.currentActiveService === 'lookup-service') {
            // For lookup service, this shouldn't happen as templates are hidden
            console.warn('Template clicked in lookup service mode');
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
        } else {
            if (window.askAgent) {
                window.askAgent.handleNewSession();
            }
        }

        console.log('New session started with session ID:', this.sessionId);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
