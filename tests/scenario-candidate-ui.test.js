import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScenarioUIRenderer } from '../src/app/core/static/js/scenario-ui-renderer.js';

// Mock the html sanitizer
vi.mock('../src/app/core/static/js/html-sanitizer.js', () => ({
    htmlSanitizer: {
        escapeHtml: (text) => text.replace(/</g, '&lt;').replace(/>/g, '&gt;'),
        sanitize: (html) => html
    }
}));

describe('Scenario Candidate UI Rendering', () => {
    let container;
    let renderer;

    beforeEach(() => {
        container = document.createElement('div');
        container.id = 'messages';
        document.body.appendChild(container);
        renderer = new ScenarioUIRenderer(container);
    });

    afterEach(() => {
        document.body.removeChild(container);
    });

    it('should render recommendations with endpoint badges', () => {
        const messageId = 'test-123';
        
        // Create scenario container
        renderer.createScenarioContainer(messageId, 'What are the critical parameters?');
        
        // New format with endpoint info
        const recommendations = [
            {
                sub_id: 'sub-1',
                question: 'SELECT temperature FROM sensors',
                endpoint: 'sqlagent'
            },
            {
                sub_id: 'sub-2', 
                question: 'Get real-time data',
                endpoint: 'toolagent'
            }
        ];
        
        renderer.updateRecommendations(messageId, recommendations);
        
        const recsDiv = container.querySelector('.scenario-recommendations');
        expect(recsDiv).toBeTruthy();
        
        // Check that endpoint badges are rendered
        const badges = recsDiv.querySelectorAll('.endpoint-badge');
        expect(badges.length).toBe(2);
        
        expect(badges[0].textContent).toBe('[SQLAGENT]');
        expect(badges[0].className).toContain('sqlagent');
        
        expect(badges[1].textContent).toBe('[TOOLAGENT]');
        expect(badges[1].className).toContain('toolagent');
        
        // Check questions are rendered
        const listItems = recsDiv.querySelectorAll('li');
        expect(listItems[0].textContent).toContain('SELECT temperature FROM sensors');
        expect(listItems[1].textContent).toContain('Get real-time data');
    });


    it('should escape HTML in questions and endpoints', () => {
        const messageId = 'test-789';
        
        renderer.createScenarioContainer(messageId, 'Test');
        
        const recommendations = [
            {
                sub_id: 'sub-1',
                question: '<script>alert("XSS")</script>',
                endpoint: '<img src=x onerror=alert(1)>'
            }
        ];
        
        renderer.updateRecommendations(messageId, recommendations);
        
        const recsDiv = container.querySelector('.scenario-recommendations');
        const html = recsDiv.innerHTML;
        
        // Check that dangerous content is escaped
        expect(html).toContain('&lt;script&gt;alert("XSS")&lt;/script&gt;');
        expect(html).toContain('[&lt;IMG SRC=X ONERROR=ALERT(1)&gt;]');
        expect(html).not.toContain('<script>');
        expect(html).not.toContain('onerror=alert');
    });
});