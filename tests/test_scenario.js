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
            expect(scenarioAgent.websocket).toBeNull();
            expect(scenarioAgent.inEvaluationMode).toBe(false);
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
        it('should handle SQL agent request JSON data', () => {
            const sqlRequests = [
                {
                    sub_id: '1',
                    question: 'Test question',
                    endpoint: '/test-endpoint'
                }
            ];

            const handleSQLSpy = vi.spyOn(scenarioAgent, 'handleSQLAgentRequests');
            
            // Simulate WebSocket message
            scenarioAgent.connectWebSocket();
            mockWebSocket.onmessage({ 
                data: `data: ${JSON.stringify(sqlRequests)}` 
            });

            expect(handleSQLSpy).toHaveBeenCalledWith(sqlRequests);
        });

        it('should handle evaluation mode messages', () => {
            scenarioAgent.inEvaluationMode = true;
            scenarioAgent.currentSQLContainer = document.createElement('div');
            
            const addEvalSpy = vi.spyOn(scenarioAgent, 'addEvaluationToSQLContainer');
            
            scenarioAgent.connectWebSocket();
            mockWebSocket.onmessage({ 
                data: 'data: Evaluation text here' 
            });

            expect(addEvalSpy).toHaveBeenCalledWith('Evaluation text here');
        });

        it('should handle status events', () => {
            const updateStatusSpy = vi.spyOn(scenarioAgent, 'updateStatus');
            
            scenarioAgent.connectWebSocket();
            mockWebSocket.onmessage({ 
                data: 'event: Processing...' 
            });

            expect(updateStatusSpy).toHaveBeenCalledWith('Processing...');
        });

        it('should handle end event', () => {
            scenarioAgent.connectWebSocket();
            const closeSpy = vi.spyOn(mockWebSocket, 'close');
            
            mockWebSocket.onmessage({ 
                data: 'event: end' 
            });

            expect(closeSpy).toHaveBeenCalled();
            expect(scenarioAgent.inEvaluationMode).toBe(false);
        });
    });

    describe('SQL Request Card Creation', () => {
        it('should create SQL request card with correct structure', () => {
            const request = {
                sub_id: '123',
                question: 'Test SQL question',
                endpoint: '/sql-endpoint'
            };

            const card = scenarioAgent.createSQLRequestCard(request, 0);

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

            const card = scenarioAgent.createSQLRequestCard(request, 0);
            
            expect(card.querySelector('.sql-copy-btn')).toBeTruthy();
            expect(card.querySelector('.sql-thumbs-up')).toBeTruthy();
            expect(card.querySelector('.sql-thumbs-down')).toBeTruthy();
        });
    });

    describe('Action Buttons', () => {
        it('should copy content to clipboard', async () => {
            const copyBtn = document.createElement('button');
            copyBtn.innerHTML = '<img src="/static/icons/copy.svg">';
            
            await scenarioAgent.copyToClipboard('Test content', copyBtn);
            
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Test content');
            expect(copyBtn.querySelector('img').src).toContain('copy-active.svg');
            expect(copyBtn.disabled).toBe(true);
        });

        it('should handle rating submission', async () => {
            const request = { sub_id: '123' };
            const card = document.createElement('div');
            card.innerHTML = `
                <div class="sql-result-content">Test result</div>
                <div class="sql-session-id">sql-123</div>
            `;
            
            const upBtn = document.createElement('button');
            upBtn.innerHTML = '<img src="/static/icons/thumbs-up.svg">';
            
            await scenarioAgent.rateResponse(request, card, 'up', upBtn);
            
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
            const id1 = scenarioAgent.generateSessionId();
            const id2 = scenarioAgent.generateSessionId();
            
            expect(id1).toMatch(/^sql-\d+-[a-z0-9]+$/);
            expect(id2).toMatch(/^sql-\d+-[a-z0-9]+$/);
            expect(id1).not.toBe(id2);
        });

        it('should handle new session', () => {
            // Add some messages
            scenarioAgent.addMessage('Test message');
            scenarioAgent.websocket = mockWebSocket;
            
            scenarioAgent.handleNewSession();
            
            expect(scenarioAgent.messagesElement.innerHTML).toBe('');
            expect(scenarioAgent.questionInput.value).toBe('');
            expect(mockWebSocket.close).toHaveBeenCalled();
            expect(scenarioAgent.websocket).toBeNull();
            expect(scenarioAgent.inEvaluationMode).toBe(false);
        });
    });

    describe('HTML Sanitization', () => {
        it('should sanitize message content', () => {
            const { htmlSanitizer } = require('../src/app/core/static/js/html-sanitizer.js');
            
            scenarioAgent.addMessage('<script>alert("XSS")</script>Test message');
            
            expect(htmlSanitizer.sanitize).toHaveBeenCalled();
        });

        it('should escape HTML in createSQLRequestCard', () => {
            const { htmlSanitizer } = require('../src/app/core/static/js/html-sanitizer.js');
            const request = {
                sub_id: '123',
                question: '<script>alert("XSS")</script>',
                endpoint: '/test'
            };

            scenarioAgent.createSQLRequestCard(request, 0);
            
            expect(htmlSanitizer.escapeHtml).toHaveBeenCalledWith('<script>alert("XSS")</script>');
        });
    });

    describe('Error Handling', () => {
        it('should handle WebSocket connection errors', () => {
            const updateStatusSpy = vi.spyOn(scenarioAgent, 'updateStatus');
            
            scenarioAgent.connectWebSocket();
            mockWebSocket.onerror(new Error('Connection failed'));
            
            expect(updateStatusSpy).toHaveBeenCalledWith('Connection error');
        });

        it('should handle SQL execution errors', async () => {
            const request = { sub_id: '123', question: 'Test' };
            const card = document.createElement('div');
            card.innerHTML = `
                <div class="sql-card-result" style="display: none;">
                    <div class="sql-result-content"></div>
                </div>
                <div class="sql-card-actions" style="display: none;"></div>
                <div class="sql-card-status">
                    <span class="sql-status-icon"></span>
                    <span class="sql-status-text"></span>
                </div>
            `;

            // Mock fetch to throw error
            window.authAPI.authenticatedFetch.mockRejectedValueOnce(new Error('Network error'));
            
            await scenarioAgent.executeSQLAgentRequest(request, card, null);
            
            expect(card.classList.contains('error')).toBe(true);
            expect(card.querySelector('.sql-status-icon').textContent).toBe('❌');
            expect(card.querySelector('.sql-status-text').textContent).toBe('Error');
        });
    });
});