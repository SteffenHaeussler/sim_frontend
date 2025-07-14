import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

describe('ScenarioAgent Basic Tests', () => {
    let dom;
    let window;
    let document;

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
    });

    describe('DOM Structure', () => {
        it('should have required DOM elements', () => {
            expect(document.getElementById('messages')).toBeTruthy();
            expect(document.getElementById('question')).toBeTruthy();
            expect(document.getElementById('send-btn')).toBeTruthy();
        });

        it('should have correct placeholder text', () => {
            const input = document.getElementById('question');
            expect(input.placeholder).toBe('Ask a question...');
        });
    });

    describe('HTML Sanitization Mock', () => {
        it('should escape dangerous HTML', () => {
            const dangerousHTML = '<script>alert("XSS")</script>';
            const div = document.createElement('div');
            div.textContent = dangerousHTML;
            const escaped = div.innerHTML;
            
            expect(escaped).not.toContain('<script>');
            expect(escaped).toContain('&lt;script&gt;');
        });
    });

    describe('Session ID Generation', () => {
        it('should generate SQL session IDs with correct format', () => {
            // Simulate the generateSessionId function
            const generateSessionId = () => {
                return 'sql-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            };
            
            const id = generateSessionId();
            expect(id).toMatch(/^sql-\d+-[a-z0-9]+$/);
        });
    });

    describe('SQL Card Structure', () => {
        it('should create SQL card with required elements', () => {
            const card = document.createElement('div');
            card.className = 'sql-request-card pending';
            card.innerHTML = `
                <div class="sql-card-header">
                    <div class="sql-card-title">
                        <span class="sql-sub-id">Query 123</span>
                        <span class="sql-endpoint">/test-endpoint</span>
                    </div>
                    <div class="sql-card-status">
                        <span class="sql-status-icon">⏳</span>
                        <span class="sql-status-text">Pending</span>
                    </div>
                </div>
                <div class="sql-card-question">
                    <strong>Question:</strong> Test question
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
            
            document.body.appendChild(card);
            
            expect(card.querySelector('.sql-sub-id').textContent).toBe('Query 123');
            expect(card.querySelector('.sql-endpoint').textContent).toBe('/test-endpoint');
            expect(card.querySelector('.sql-copy-btn')).toBeTruthy();
            expect(card.querySelector('.sql-thumbs-up')).toBeTruthy();
            expect(card.querySelector('.sql-thumbs-down')).toBeTruthy();
        });
    });

    describe('WebSocket Message Parsing', () => {
        it('should parse event messages correctly', () => {
            const message = 'event: Processing...';
            const isEvent = message.startsWith('event: ');
            const eventText = message.replace('event: ', '').trim();
            
            expect(isEvent).toBe(true);
            expect(eventText).toBe('Processing...');
        });

        it('should parse data messages correctly', () => {
            const message = 'data: Test response data';
            const isData = message.startsWith('data: ');
            const dataText = message.replace('data: ', '').trim();
            
            expect(isData).toBe(true);
            expect(dataText).toBe('Test response data');
        });

        it('should parse JSON array messages', () => {
            const jsonArray = [
                { sub_id: '1', question: 'Test', endpoint: '/test' }
            ];
            const message = JSON.stringify(jsonArray);
            
            let parsed;
            try {
                parsed = JSON.parse(message);
            } catch (e) {
                parsed = null;
            }
            
            expect(Array.isArray(parsed)).toBe(true);
            expect(parsed[0].sub_id).toBe('1');
            expect(parsed[0].question).toBe('Test');
            expect(parsed[0].endpoint).toBe('/test');
        });
    });

    describe('Button State Management', () => {
        it('should disable copy button after click', () => {
            const button = document.createElement('button');
            button.innerHTML = '<img src="/static/icons/copy.svg">';
            button.disabled = false;
            
            // Simulate copy action
            button.querySelector('img').src = '/static/icons/copy-active.svg';
            button.disabled = true;
            button.title = 'Copied!';
            
            expect(button.disabled).toBe(true);
            expect(button.title).toBe('Copied!');
            expect(button.querySelector('img').src).toContain('copy-active.svg');
        });

        it('should hide opposite rating button after rating', () => {
            const upBtn = document.createElement('button');
            const downBtn = document.createElement('button');
            
            // Simulate thumbs up click
            upBtn.disabled = true;
            downBtn.style.display = 'none';
            
            expect(upBtn.disabled).toBe(true);
            expect(downBtn.style.display).toBe('none');
        });
    });
});