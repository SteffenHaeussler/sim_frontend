class SemanticSearch {
    constructor() {
        this.initialized = false;
        this.currentEventId = null;  // Store current event ID for ratings
    }

    generateEventId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    initialize() {
        if (this.initialized) return;

        this.initialized = true;

        // Get DOM elements
        this.semanticQuery = document.getElementById('semantic-query');
        this.performSemanticSearchBtn = document.getElementById('perform-semantic-search');
        this.semanticResults = document.getElementById('semantic-results');

        // Set up event listeners
        if (this.performSemanticSearchBtn) {
            this.performSemanticSearchBtn.addEventListener('click', () => this.handleSemanticSearch());
        }
        if (this.semanticQuery) {
            this.semanticQuery.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleSemanticSearch();
                }
            });
        }
    }

    async handleSemanticSearch() {
        // Check authentication first
        if (!window.authAPI || !window.authAPI.isLoggedIn()) {
            if (window.authUI && window.authUI.showLoginModal) {
                window.authUI.showLoginModal();
            } else {
                alert('Please log in to use the Lookup service.');
            }
            return;
        }
        const query = this.semanticQuery ? this.semanticQuery.value.trim() : '';
        if (!query) {
            this.showSemanticResults(null, 'Please enter a search query');
            return;
        }

        try {
            // Show loading state
            this.showSemanticResults(null, 'Searching...', true);

            // Generate event ID for this semantic search
            this.currentEventId = this.generateEventId();

            // Add event_id and session_id to URL parameters
            const semanticUrl = new URL('/lookout/semantic', window.location.origin);
            const sessionId = window.app ? window.app.sessionId : '';
            if (sessionId) {
                semanticUrl.searchParams.append('session_id', sessionId);
            }
            if (this.currentEventId) {
                semanticUrl.searchParams.append('event_id', this.currentEventId);
            }

            // Make semantic search API call
            const response = await window.authAPI.authenticatedFetch(semanticUrl.toString(), {
                method: 'POST',
                body: JSON.stringify({
                    query: query
                })
            });

            const data = await response.json();

            if (data.error) {
                this.showSemanticResults(null, `Search query "${query}" could not processed. Please check and try again.`);
            } else {
                this.showSemanticResults(data, null);
            }
        } catch (error) {
            console.error('Failed to perform semantic search:', error);
            this.showSemanticResults(null, 'Failed to perform semantic search');
        }
    }

    showSemanticResults(resultData, errorMessage, isLoading = false) {
        if (!this.semanticResults) return;

        if (isLoading) {
            this.semanticResults.innerHTML = `
                <div class="semantic-placeholder">
                    <div class="loading-spinner"></div>
                    ${errorMessage || 'Processing semantic search...'}
                </div>
            `;
            return;
        }

        if (errorMessage) {
            this.semanticResults.innerHTML = `
                <div class="semantic-placeholder">
                    ${errorMessage}
                </div>
            `;
            return;
        }

        if (!resultData) {
            this.semanticResults.innerHTML = `
                <div class="semantic-placeholder">
                    Enter a search query to find semantically similar content
                </div>
            `;
            return;
        }

        // Display semantic search results as key-value pairs similar to asset information
        let detailsHtml = '';

        // Collect all key-value pairs first
        const allFields = {};

        const processObject = (obj, prefix = '') => {
            for (const [fieldName, value] of Object.entries(obj)) {
                const displayKey = prefix ? `${prefix}.${fieldName}` : fieldName;

                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    // Nested object - recurse
                    processObject(value, displayKey);
                } else {
                    // Simple value - store in collection
                    allFields[displayKey] = Array.isArray(value) ? JSON.stringify(value) : String(value);
                }
            }
        };

        processObject(resultData);

        // Define priority order for important fields
        const priorityFields = ['question', 'text', 'description', 'score'];

        // Create rows for priority fields first
        priorityFields.forEach(fieldName => {
            if (allFields[fieldName]) {
                const displayValue = allFields[fieldName];
                const escapedValue = displayValue.replace(/'/g, "\\'").replace(/"/g, '\\"');
                detailsHtml += `
                    <div class="asset-detail-item">
                        <span class="detail-label">${fieldName}:</span>
                        <span class="detail-value">${displayValue}</span>
                        <button class="copy-value-btn" onclick="window.lookupService.semanticSearch.copySemanticValue('${escapedValue}', this)" title="Copy value">
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
                    <button class="copy-value-btn" onclick="window.lookupService.semanticSearch.copySemanticValue('${escapedValue}', this)" title="Copy value">
                        <img src="/static/icons/copy.svg" alt="Copy">
                    </button>
                </div>
            `;
        });

        // Add disclaimer and rating buttons at the end
        detailsHtml += `
            <div class="semantic-disclaimer">
                <p style="font-size: 12px; color: var(--text-secondary); font-style: italic; margin: 15px 0 10px 0;">
                    Note: These results are not necessarily used by the agent and are for reference only.
                </p>
                <div class="semantic-rating" style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px;">
                    <button class="action-btn thumbs-up-btn" onclick="window.lookupService.semanticSearch.rateSemanticResult('up', this)" title="Good result">
                        <img src="/static/icons/thumbs-up.svg" alt="Good">
                    </button>
                    <button class="action-btn thumbs-down-btn" onclick="window.lookupService.semanticSearch.rateSemanticResult('down', this)" title="Poor result">
                        <img src="/static/icons/thumbs-down.svg" alt="Bad">
                    </button>
                </div>
            </div>
        `;

        this.semanticResults.innerHTML = detailsHtml;
    }

    async copySemanticValue(value, button) {
        try {
            await navigator.clipboard.writeText(value);
            console.log('Semantic value copied to clipboard:', value);

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
            console.error('Failed to copy semantic value: ', err);
        }
    }

    async rateSemanticResult(rating, button) {
        console.log(`Semantic result rated as: ${rating}`);

        // Find the other button (thumbs up/down counterpart)
        const ratingContainer = button.parentElement;
        const otherButton = rating === 'up' ? 
            ratingContainer.querySelector('.thumbs-down-btn') : 
            ratingContainer.querySelector('.thumbs-up-btn');

        // Show visual feedback - permanent
        const activeIcon = rating === 'up' ?
            '/static/icons/thumbs-up-active.svg' :
            '/static/icons/thumbs-down-active.svg';

        button.innerHTML = `<img src="${activeIcon}" alt="${rating}">`;
        button.disabled = true;
        button.title = `Rated as ${rating === 'up' ? 'good' : 'poor'}`;

        // Hide the opposite button
        if (otherButton) {
            otherButton.style.display = 'none';
        }

        // Send rating to API
        try {
            const sessionId = window.app ? window.app.sessionId : '';
            const ratingType = rating === 'up' ? 'thumbs_up' : 'thumbs_down';
            
            // Get the original search query from the input field
            const searchQuery = this.semanticQuery ? this.semanticQuery.value.trim() : '';
            
            // Get the semantic result content for context and include both query and response
            const resultContent = this.semanticResults.textContent.substring(0, 500);
            const fullContext = `Query: "${searchQuery}" | Response: ${resultContent}`;
            
            console.log('About to submit semantic rating:', {
                rating_type: ratingType,
                session_id: sessionId,
                message_context: fullContext.substring(0, 100) + '...'
            });
            
            // Add event_id and session_id to URL parameters
            const ratingsUrl = new URL('/ratings/submit', window.location.origin);
            if (sessionId) {
                ratingsUrl.searchParams.append('session_id', sessionId);
            }
            if (this.currentEventId) {
                ratingsUrl.searchParams.append('event_id', this.currentEventId);
            }

            const response = await window.authAPI.authenticatedFetch(ratingsUrl.toString(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    rating_type: ratingType,
                    session_id: sessionId,
                    event_id: this.currentEventId,  // Include event ID for linking
                    message_context: fullContext,  // Include both query and API response
                    feedback_text: null
                })
            });

            if (response.ok) {
                const result = await response.json();
                console.log('Semantic rating submitted successfully:', result);
            } else {
                console.error('Failed to submit semantic rating:', response.status, response.statusText);
                const errorBody = await response.text();
                console.error('Error response body:', errorBody);
            }
        } catch (error) {
            console.error('Error submitting semantic rating:', error);
        }

        // Add thank you message below the rating buttons
        const thankYouMsg = document.createElement('div');
        thankYouMsg.style.cssText = 'font-size: 9px; color: var(--text-secondary); margin-top: 4px; text-align: right; font-style: italic;';
        thankYouMsg.textContent = 'Thank you!';
        ratingContainer.appendChild(thankYouMsg);
    }

    reset() {
        // Clear input field
        if (this.semanticQuery) {
            this.semanticQuery.value = '';
        }
        
        // Reset results view
        if (this.semanticResults) {
            this.semanticResults.innerHTML = `
                <div class="semantic-placeholder">
                    Enter a search query to find semantically similar content
                </div>
            `;
        }
    }
}

// Export for use in lookup service
window.SemanticSearch = SemanticSearch;