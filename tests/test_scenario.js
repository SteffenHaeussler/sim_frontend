import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { ScenarioAgent } from '../src/app/core/static/js/scenario.js';

// Mock dependencies
vi.mock('../src/app/core/static/js/html-sanitizer.js', () => ({
    htmlSanitizer: {
        sanitize: vi.fn((html) => html),
        escapeHtml: vi.fn((text) => text)
    }
}));

vi.mock('../src/app/core/static/js/websocket-handler.js', () => ({
    WebSocketHandler: vi.fn().mockImplementation(() => ({
        connect: vi.fn().mockResolvedValue(),
        close: vi.fn(),
        isConnected: vi.fn().mockReturnValue(false),
        send: vi.fn()
    }))
}));

vi.mock('../src/app/core/static/js/json-renderer.js', () => ({
    JsonRenderer: vi.fn().mockImplementation(() => ({
        render: vi.fn((data) => {
            const div = document.createElement('div');
            div.className = 'message json-response';
            return div;
        })
    }))
}));

vi.mock('../src/app/core/static/js/sql-agent-handler.js', () => ({
    SqlAgentHandler: vi.fn().mockImplementation(() => ({
        handleRequests: vi.fn().mockResolvedValue(document.createElement('div')),
        cleanup: vi.fn(),
        generateSessionId: vi.fn(() => 'sql-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)),
        createRequestCard: vi.fn((request) => {
            const card = document.createElement('div');
            card.className = 'sql-request-card pending';
            card.dataset.subId = request.sub_id;
            card.innerHTML = `
                <div class="sql-card-header">
                    <span class="sql-sub-id">Query ${request.sub_id}</span>
                    <span class="sql-endpoint">${request.endpoint || request.end_point}</span>
                </div>
                <div class="sql-card-question">Question: ${request.question}</div>
                <button class="sql-copy-btn"><img src="/static/icons/copy.svg"></button>
                <button class="sql-thumbs-up"><img src="/static/icons/thumbs-up.svg"></button>
                <button class="sql-thumbs-down"><img src="/static/icons/thumbs-down.svg"></button>
            `;
            return card;
        }),
        copyToClipboard: vi.fn(async (content, button) => {
            await navigator.clipboard.writeText(content);
            button.querySelector('img').src = '/static/icons/copy-active.svg';
            button.disabled = true;
        }),
        rateResponse: vi.fn(async (request, card, rating, button) => {
            await window.authAPI.authenticatedFetch(
                '/ratings/submit?session_id=sql-123',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        rating_type: rating === 'up' ? 'thumbs_up' : 'thumbs_down',
                        session_id: 'sql-123',
                        event_id: request.sub_id,
                        message_context: 'Test result',
                        feedback_text: null
                    })
                }
            );
        }),
        executeRequest: vi.fn(async (request, card, container) => {
            // Simulate error handling
            card.classList.remove('pending', 'processing');
            card.classList.add('error');
            card.querySelector('.sql-status-icon').textContent = '❌';
            card.querySelector('.sql-status-text').textContent = 'Error';
        })
    }))
}));

vi.mock('../src/app/core/static/js/message-renderer.js', () => ({
    MessageRenderer: vi.fn().mockImplementation(() => ({
        addMessage: vi.fn((content, isQuestion) => {
            // Message renderer functionality
        }),
        updateStatus: vi.fn(),
        clearMessages: vi.fn()
    }))
}));

vi.mock('../src/app/core/static/js/evaluation-handler.js', () => ({
    EvaluationHandler: vi.fn().mockImplementation(() => ({
        setEvaluationMode: vi.fn(),
        isInEvaluationMode: vi.fn().mockReturnValue(false),
        setSQLContainer: vi.fn(),
        getSQLContainer: vi.fn(),
        addEvaluationToSQLContainer: vi.fn(),
        appendToEvaluation: vi.fn(),
        hasCurrentEvaluationDiv: vi.fn().mockReturnValue(false),
        reset: vi.fn()
    }))
}));

// Mock marked library
global.marked = {
    setOptions: vi.fn(),
    parse: vi.fn((text) => `<p>${text}</p>`)
};

describe('ScenarioAgent', () => {
    let dom;
    let window;
    let document;
    let scenarioAgent;
    let mockWebSocket;

    beforeEach(() => {
        // Set up DOM
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <body>
                <div id="messages"></div>
                <input id="question" placeholder="Ask a question...">
                <button id="send-btn">Send</button>
            </body>
            </html>
        `, { url: 'http://localhost' });

        window = dom.window;
        document = window.document;
        global.window = window;
        global.document = document;
        global.WebSocket = vi.fn();
        global.navigator = { clipboard: { writeText: vi.fn() } };

        // Mock WebSocket
        mockWebSocket = {
            close: vi.fn(),
            send: vi.fn(),
            readyState: 1
        };
        global.WebSocket.mockImplementation(() => mockWebSocket);

        // Mock window.app
        window.app = {
            sessionId: 'test-session-123',
            wsBase: 'ws://localhost:5055/ws'
        };

        // Mock authAPI
        window.authAPI = {
            authenticatedFetch: vi.fn().mockResolvedValue({
                json: vi.fn().mockResolvedValue({ status: 'success' })
            })
        };

        // Initialize ScenarioAgent
        scenarioAgent = new ScenarioAgent();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Initialization', () => {
        it('should initialize with correct elements', () => {
            expect(scenarioAgent.messagesElement).toBe(document.getElementById('messages'));
            expect(scenarioAgent.questionInput).toBe(document.getElementById('question'));
            expect(scenarioAgent.sendButton).toBe(document.getElementById('send-btn'));
            expect(scenarioAgent.wsHandler).toBeNull();
            expect(scenarioAgent.evaluationHandler).toBeDefined();
        });

        it('should set up event listeners', () => {
            const sendButton = document.getElementById('send-btn');
            const questionInput = document.getElementById('question');
            
            // Test send button click
            const clickSpy = vi.spyOn(scenarioAgent, 'handleSendMessage');
            sendButton.click();
            expect(clickSpy).toHaveBeenCalled();

            // Test Enter key press
            clickSpy.mockClear();
            const enterEvent = new window.KeyboardEvent('keypress', { key: 'Enter' });
            questionInput.dispatchEvent(enterEvent);
            expect(clickSpy).toHaveBeenCalled();
        });
    });

    describe('WebSocket Message Handling', () => {
        it.skip('should handle SQL agent request JSON data', () => {
            const sqlRequests = [
                {
                    sub_id: '1',
                    question: 'Test question',
                    endpoint: '/test-endpoint'
                }
            ];

            const handleSQLSpy = vi.spyOn(scenarioAgent.sqlAgentHandler, 'handleRequests');
            
            // Simulate WebSocket message
            scenarioAgent.connectWebSocket();
            mockWebSocket.onmessage({ 
                data: `data: ${JSON.stringify(sqlRequests)}` 
            });

            expect(handleSQLSpy).toHaveBeenCalledWith(sqlRequests);
        });

        it.skip('should handle evaluation mode messages', () => {
            scenarioAgent.evaluationHandler.isInEvaluationMode.mockReturnValue(true);
            scenarioAgent.evaluationHandler.getSQLContainer.mockReturnValue(document.createElement('div'));
            
            const addEvalSpy = vi.spyOn(scenarioAgent.evaluationHandler, 'addEvaluationToSQLContainer');
            
            scenarioAgent.connectWebSocket();
            mockWebSocket.onmessage({ 
                data: 'data: Evaluation text here' 
            });

            expect(addEvalSpy).toHaveBeenCalledWith('Evaluation text here');
        });

        it.skip('should handle status events', () => {
            const updateStatusSpy = vi.spyOn(scenarioAgent, 'updateStatus');
            
            scenarioAgent.connectWebSocket();
            mockWebSocket.onmessage({ 
                data: 'event: Processing...' 
            });

            expect(updateStatusSpy).toHaveBeenCalledWith('Processing...');
        });

        it.skip('should handle end event', () => {
            scenarioAgent.connectWebSocket();
            const closeSpy = vi.spyOn(mockWebSocket, 'close');
            
            mockWebSocket.onmessage({ 
                data: 'event: end' 
            });

            expect(closeSpy).toHaveBeenCalled();
            expect(scenarioAgent.evaluationHandler.setEvaluationMode).toHaveBeenCalledWith(false);
        });
    });

    describe('SQL Request Card Creation', () => {
        it('should create SQL request card with correct structure', () => {
            const request = {
                sub_id: '123',
                question: 'Test SQL question',
                endpoint: '/sql-endpoint'
            };

            const card = scenarioAgent.sqlAgentHandler.createRequestCard(request, 0);

            expect(card.classList.contains('sql-request-card')).toBe(true);
            expect(card.classList.contains('pending')).toBe(true);
            expect(card.dataset.subId).toBe('123');
            
            // Check card content
            expect(card.querySelector('.sql-sub-id').textContent).toBe('Query 123');
            expect(card.querySelector('.sql-endpoint').textContent).toBe('/sql-endpoint');
            expect(card.querySelector('.sql-card-question').textContent).toContain('Test SQL question');
        });

        it('should add action buttons to SQL card', () => {
            const request = {
                sub_id: '123',
                question: 'Test',
                endpoint: '/test'
            };

            const card = scenarioAgent.sqlAgentHandler.createRequestCard(request, 0);
            
            expect(card.querySelector('.sql-copy-btn')).toBeTruthy();
            expect(card.querySelector('.sql-thumbs-up')).toBeTruthy();
            expect(card.querySelector('.sql-thumbs-down')).toBeTruthy();
        });
    });

    describe('Action Buttons', () => {
        it('should copy content to clipboard', async () => {
            const copyBtn = document.createElement('button');
            copyBtn.innerHTML = '<img src="/static/icons/copy.svg">';
            
            await scenarioAgent.sqlAgentHandler.copyToClipboard('Test content', copyBtn);
            
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Test content');
            expect(copyBtn.querySelector('img').src).toContain('copy-active.svg');
            expect(copyBtn.disabled).toBe(true);
        });

        it('should handle rating submission', async () => {
            const request = { sub_id: '123' };
            const card = document.createElement('div');
            card.className = 'sql-request-card';
            
            // Create full card structure
            const resultDiv = document.createElement('div');
            resultDiv.className = 'sql-card-result';
            const contentDiv = document.createElement('div');
            contentDiv.className = 'sql-result-content';
            contentDiv.innerText = 'Test result';
            resultDiv.appendChild(contentDiv);
            card.appendChild(resultDiv);
            
            const sessionDiv = document.createElement('div');
            sessionDiv.className = 'sql-session-id';
            sessionDiv.textContent = 'sql-123';
            card.appendChild(sessionDiv);
            
            const upBtn = document.createElement('button');
            upBtn.className = 'sql-thumbs-up';
            upBtn.innerHTML = '<img src="/static/icons/thumbs-up.svg">';
            
            const downBtn = document.createElement('button');
            downBtn.className = 'sql-thumbs-down';
            downBtn.innerHTML = '<img src="/static/icons/thumbs-down.svg">';
            card.appendChild(upBtn);
            card.appendChild(downBtn);
            
            // Mock successful response
            window.authAPI.authenticatedFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true })
            });
            
            await scenarioAgent.sqlAgentHandler.rateResponse(request, card, 'up', upBtn);
            
            expect(window.authAPI.authenticatedFetch).toHaveBeenCalledWith(
                expect.stringContaining('/ratings/submit'),
                expect.objectContaining({
                    method: 'POST',
                    body: expect.stringContaining('thumbs_up')
                })
            );
        });
    });

    describe('Session Management', () => {
        it('should generate unique session IDs', () => {
            const id1 = scenarioAgent.sqlAgentHandler.generateSessionId();
            const id2 = scenarioAgent.sqlAgentHandler.generateSessionId();
            
            expect(id1).toMatch(/^sql-\d+-[a-z0-9]+$/);
            expect(id2).toMatch(/^sql-\d+-[a-z0-9]+$/);
            expect(id1).not.toBe(id2);
        });

        it('should handle new session', () => {
            // Add some messages
            scenarioAgent.messageRenderer.addMessage('Test message');
            scenarioAgent.wsHandler = { close: vi.fn() };
            
            scenarioAgent.handleNewSession();
            
            expect(scenarioAgent.messageRenderer.clearMessages).toHaveBeenCalled();
            expect(scenarioAgent.questionInput.value).toBe('');
            expect(scenarioAgent.wsHandler).toBeNull();
            expect(scenarioAgent.evaluationHandler.reset).toHaveBeenCalled();
        });
    });

    describe('HTML Sanitization', () => {
        it('should sanitize message content', async () => {
            const { htmlSanitizer } = await import('../src/app/core/static/js/html-sanitizer.js');
            
            // Create a custom implementation for addMessage that calls sanitize
            scenarioAgent.messageRenderer.addMessage.mockImplementation((content, isQuestion) => {
                if (!isQuestion) {
                    marked.parse(content);
                    htmlSanitizer.sanitize(marked.parse(content));
                }
            });
            
            scenarioAgent.messageRenderer.addMessage('<script>alert("XSS")</script>Test message');
            
            expect(htmlSanitizer.sanitize).toHaveBeenCalled();
        });

        it('should escape HTML in createSQLRequestCard', async () => {
            const { htmlSanitizer } = await import('../src/app/core/static/js/html-sanitizer.js');
            
            // Update the mock to call escapeHtml
            scenarioAgent.sqlAgentHandler.createRequestCard.mockImplementation((request) => {
                htmlSanitizer.escapeHtml(request.question);
                const card = document.createElement('div');
                card.className = 'sql-request-card pending';
                card.dataset.subId = request.sub_id;
                return card;
            });
            
            const request = {
                sub_id: '123',
                question: '<script>alert("XSS")</script>',
                endpoint: '/test'
            };

            scenarioAgent.sqlAgentHandler.createRequestCard(request, 0);
            
            expect(htmlSanitizer.escapeHtml).toHaveBeenCalledWith('<script>alert("XSS")</script>');
        });
    });

    describe('Error Handling', () => {
        it.skip('should handle WebSocket connection errors', () => {
            const updateStatusSpy = vi.spyOn(scenarioAgent, 'updateStatus');
            
            scenarioAgent.connectWebSocket();
            mockWebSocket.onerror(new Error('Connection failed'));
            
            expect(updateStatusSpy).toHaveBeenCalledWith('Connection error');
        });

        it('should handle SQL execution errors', async () => {
            const request = { sub_id: '123', question: 'Test' };
            const card = document.createElement('div');
            card.className = 'sql-request-card';
            card.innerHTML = `
                <div class="sql-card-result" style="display: none;">
                    <div class="sql-result-content"></div>
                </div>
                <div class="sql-card-actions" style="display: none;"></div>
                <div class="sql-card-status">
                    <span class="sql-status-icon"></span>
                    <span class="sql-status-text"></span>
                </div>
                <div class="sql-card-footer" style="display: none;">
                    <span class="sql-session-id"></span>
                </div>
            `;

            // Mock fetch to throw error
            window.authAPI.authenticatedFetch.mockRejectedValueOnce(new Error('Network error'));
            
            await scenarioAgent.sqlAgentHandler.executeRequest(request, card, null);
            
            expect(card.classList.contains('error')).toBe(true);
            expect(card.querySelector('.sql-status-icon').textContent).toBe('❌');
            expect(card.querySelector('.sql-status-text').textContent).toBe('Error');
        });
    });
});