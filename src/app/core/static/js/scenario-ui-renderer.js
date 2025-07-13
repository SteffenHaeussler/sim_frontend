import { htmlSanitizer } from './html-sanitizer.js';

export class ScenarioUIRenderer {
    constructor(container) {
        this.container = container;
        this.sanitizer = htmlSanitizer;
    }

    createScenarioContainer(messageId, userQuestion) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message scenario-message';
        messageDiv.id = `scenario-${messageId}`;
        
        // User question (use textContent for user input)
        const userDiv = document.createElement('div');
        userDiv.className = 'user-message';
        userDiv.textContent = userQuestion;
        messageDiv.appendChild(userDiv);
        
        // Scenario analysis container
        const scenarioDiv = document.createElement('div');
        scenarioDiv.className = 'agent-message scenario-container';
        scenarioDiv.innerHTML = `
            <div class="scenario-header">
                <h3>Scenario Analysis</h3>
                <div class="scenario-status">Processing...</div>
            </div>
            <div class="scenario-recommendations"></div>
            <div class="scenario-results"></div>
        `;
        messageDiv.appendChild(scenarioDiv);
        
        this.container.appendChild(messageDiv);
        this.scrollToBottom();
        
        return messageDiv;
    }

    updateRecommendations(messageId, recommendations) {
        const container = this.findScenarioContainer(messageId);
        if (!container) return;
        
        const recsDiv = container.querySelector('.scenario-recommendations');
        
        // Process recommendations with endpoint info
        const sanitizedRecs = recommendations.map(rec => {
            const endpoint = this.sanitizer.escapeHtml(rec.endpoint.toUpperCase());
            const question = this.sanitizer.escapeHtml(rec.question);
            // Sanitize endpoint for class name - only allow alphanumeric
            const safeClass = rec.endpoint.replace(/[^a-zA-Z0-9-_]/g, '').toLowerCase();
            return `<li><span class="endpoint-badge ${safeClass}">[${endpoint}]</span> ${question}</li>`;
        }).join('');
        
        recsDiv.innerHTML = '<h4>Recommendations:</h4><ol>' + sanitizedRecs + '</ol>';
    }

    addResult(messageId, subId, agentType, content, isComplete = false, error = null) {
        const container = this.findScenarioContainer(messageId);
        if (!container) return;
        
        const resultsDiv = container.querySelector('.scenario-results');
        
        let resultSection = resultsDiv.querySelector(`[data-sub-id="${subId}"]`);
        if (!resultSection) {
            resultSection = this.createResultSection(subId, agentType);
            resultsDiv.appendChild(resultSection);
        }
        
        if (error) {
            this.updateResultError(resultSection, error, messageId, subId, agentType);
        } else {
            this.updateResultContent(resultSection, content, isComplete);
        }
    }

    updateStatus(messageId, status) {
        const container = this.findScenarioContainer(messageId);
        if (!container) return;
        
        const statusDiv = container.querySelector('.scenario-status');
        if (!statusDiv) return;
        
        if (status.percentage === 100) {
            statusDiv.textContent = 'Analysis complete';
            statusDiv.classList.add('complete');
        } else {
            statusDiv.textContent = `Processing... ${status.completed}/${status.total} (${status.percentage}%)`;
        }
    }

    // Private helper methods
    findScenarioContainer(messageId) {
        return this.container.querySelector(`#scenario-${messageId}`);
    }

    createResultSection(subId, agentType) {
        const section = document.createElement('div');
        section.className = 'scenario-result-section';
        section.setAttribute('data-sub-id', subId);
        
        // Escape agent type to prevent XSS
        const safeAgentType = this.sanitizer.escapeHtml(agentType);
        
        section.innerHTML = `
            <div class="result-header">
                <span class="agent-type">${safeAgentType}</span>
                <span class="result-status">⏳</span>
                <button class="retry-button" style="display: none;">Retry</button>
            </div>
            <div class="result-content"></div>
        `;
        return section;
    }

    updateResultContent(section, content, isComplete) {
        const contentDiv = section.querySelector('.result-content');
        const statusSpan = section.querySelector('.result-status');
        const retryButton = section.querySelector('.retry-button');
        
        // Hide retry button on successful content
        if (retryButton) {
            retryButton.style.display = 'none';
        }
        
        // Sanitize content before rendering
        const sanitizedContent = this.sanitizer.sanitize(content);
        
        if (isComplete) {
            contentDiv.innerHTML = sanitizedContent;
            statusSpan.textContent = '✓';
            statusSpan.className = 'result-status success';
        } else {
            contentDiv.innerHTML += sanitizedContent;
        }
    }

    updateResultError(section, error, messageId, subId, agentType) {
        const contentDiv = section.querySelector('.result-content');
        const statusSpan = section.querySelector('.result-status');
        const retryButton = section.querySelector('.retry-button');
        
        // Update status to error
        statusSpan.textContent = '❌';
        statusSpan.className = 'result-status error';
        
        // Show error message
        const safeError = this.sanitizer.escapeHtml(error);
        contentDiv.innerHTML = `<div class="error-message">Error: ${safeError}</div>`;
        
        // Show retry button
        if (retryButton) {
            retryButton.style.display = 'inline-block';
            
            // Remove existing event listener to prevent duplicates
            const newRetryButton = retryButton.cloneNode(true);
            retryButton.parentNode.replaceChild(newRetryButton, retryButton);
            
            // Add event listener for retry
            newRetryButton.addEventListener('click', () => {
                this.handleRetry(messageId, subId, agentType, section);
            });
        }
    }

    handleRetry(messageId, subId, agentType, section) {
        // Update UI to show retrying state
        const statusSpan = section.querySelector('.result-status');
        const contentDiv = section.querySelector('.result-content');
        const retryButton = section.querySelector('.retry-button');
        
        statusSpan.textContent = '⏳';
        statusSpan.className = 'result-status';
        contentDiv.innerHTML = '<div class="retry-message">Retrying...</div>';
        retryButton.style.display = 'none';
        
        // Emit custom event for retry
        const retryEvent = new CustomEvent('scenario-retry', {
            detail: { messageId, subId, agentType }
        });
        document.dispatchEvent(retryEvent);
    }

    scrollToBottom() {
        if (this.container.scrollTop !== undefined) {
            this.container.scrollTop = this.container.scrollHeight;
        }
    }
}