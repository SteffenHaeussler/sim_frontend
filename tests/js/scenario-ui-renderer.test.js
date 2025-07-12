import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScenarioUIRenderer } from '../../src/app/core/static/js/scenario-ui-renderer.js';
import { HTMLSanitizer } from '../../src/app/core/static/js/html-sanitizer.js';

describe('ScenarioUIRenderer', () => {
    let renderer;
    let container;

    beforeEach(() => {
        // Create a DOM container for tests
        container = document.createElement('div');
        container.id = 'test-container';
        document.body.appendChild(container);
        
        renderer = new ScenarioUIRenderer(container);
    });

    afterEach(() => {
        // Clean up DOM after each test
        document.body.removeChild(container);
    });

    it('should create scenario container with correct structure', () => {
        const messageId = 'scenario-001';
        const userQuestion = 'What is the tank level?';
        
        const element = renderer.createScenarioContainer(messageId, userQuestion);
        
        expect(element).toBeDefined();
        expect(element.id).toBe(`scenario-${messageId}`);
        expect(element.className).toBe('message scenario-message');
        
        // Check user message
        const userMsg = element.querySelector('.user-message');
        expect(userMsg).toBeDefined();
        expect(userMsg.textContent).toBe(userQuestion);
        
        // Check scenario structure
        expect(element.querySelector('.scenario-header')).toBeDefined();
        expect(element.querySelector('.scenario-status')).toBeDefined();
        expect(element.querySelector('.scenario-recommendations')).toBeDefined();
        expect(element.querySelector('.scenario-results')).toBeDefined();
    });

    it('should update recommendations correctly', () => {
        const messageId = 'scenario-001';
        const recommendations = [
            'Get tank level data from SQL',
            'Analyze tank level trends',
            'Check for anomalies'
        ];
        
        // First create container
        renderer.createScenarioContainer(messageId, 'Test question');
        
        // Update recommendations
        renderer.updateRecommendations(messageId, recommendations);
        
        const recsDiv = container.querySelector('.scenario-recommendations');
        const listItems = recsDiv.querySelectorAll('li');
        
        expect(listItems.length).toBe(3);
        expect(listItems[0].textContent).toBe(recommendations[0]);
        expect(listItems[1].textContent).toBe(recommendations[1]);
        expect(listItems[2].textContent).toBe(recommendations[2]);
    });

    it('should add result sections correctly', () => {
        const messageId = 'scenario-001';
        const subId = 'rec-1';
        const agentType = 'sqlagent';
        const content = 'Tank level is 85%';
        
        // Create container first
        renderer.createScenarioContainer(messageId, 'Test');
        
        // Add result
        renderer.addResult(messageId, subId, agentType, content, true);
        
        const resultSection = container.querySelector(`[data-sub-id="${subId}"]`);
        expect(resultSection).toBeDefined();
        
        const agentSpan = resultSection.querySelector('.agent-type');
        expect(agentSpan.textContent).toBe(agentType);
        
        const contentDiv = resultSection.querySelector('.result-content');
        expect(contentDiv.innerHTML).toBe(content);
        
        const statusSpan = resultSection.querySelector('.result-status');
        expect(statusSpan.textContent).toBe('✓');
    });

    it('should handle partial results correctly', () => {
        const messageId = 'scenario-001';
        const subId = 'rec-1';
        
        renderer.createScenarioContainer(messageId, 'Test');
        
        // Add partial result
        renderer.addResult(messageId, subId, 'toolagent', 'Analyzing...', false);
        
        let statusSpan = container.querySelector(`[data-sub-id="${subId}"] .result-status`);
        expect(statusSpan.textContent).toBe('⏳');
        
        // Update with more content
        renderer.addResult(messageId, subId, 'toolagent', ' Complete analysis done.', true);
        
        statusSpan = container.querySelector(`[data-sub-id="${subId}"] .result-status`);
        expect(statusSpan.textContent).toBe('✓');
    });

    it('should update completion status correctly', () => {
        const messageId = 'scenario-001';
        
        renderer.createScenarioContainer(messageId, 'Test');
        
        // Partial completion
        renderer.updateStatus(messageId, { completed: 2, total: 5, percentage: 40 });
        
        let statusDiv = container.querySelector('.scenario-status');
        expect(statusDiv.textContent).toContain('2/5');
        expect(statusDiv.textContent).toContain('40%');
        
        // Full completion
        renderer.updateStatus(messageId, { completed: 5, total: 5, percentage: 100 });
        
        statusDiv = container.querySelector('.scenario-status');
        expect(statusDiv.textContent).toBe('Analysis complete');
        expect(statusDiv.className).toContain('complete');
    });

    it('should handle missing container gracefully', () => {
        // Try to update non-existent scenario
        expect(() => {
            renderer.updateRecommendations('non-existent', ['test']);
        }).not.toThrow();
        
        expect(() => {
            renderer.addResult('non-existent', 'sub-1', 'agent', 'content');
        }).not.toThrow();
        
        expect(() => {
            renderer.updateStatus('non-existent', { completed: 1, total: 1 });
        }).not.toThrow();
    });

    it('should prevent XSS in recommendations', () => {
        const messageId = 'scenario-001';
        const maliciousRecs = [
            '<script>alert("XSS")</script>Safe text',
            'Normal recommendation',
            '<img src=x onerror="alert(\'XSS\')">'
        ];
        
        renderer.createScenarioContainer(messageId, 'Test');
        renderer.updateRecommendations(messageId, maliciousRecs);
        
        const recsDiv = container.querySelector('.scenario-recommendations');
        const html = recsDiv.innerHTML;
        
        // Should not contain actual script tags
        expect(html).not.toContain('<script>');
        
        // Should contain escaped content
        expect(html).toContain('&lt;script&gt;');
        expect(html).toContain('Normal recommendation');
        
        // Check that dangerous attributes are escaped
        const listItems = container.querySelectorAll('.scenario-recommendations li');
        expect(listItems[2].textContent).toContain('<img src=x onerror="alert');
        
        // Ensure no executable scripts
        expect(() => {
            // If XSS was successful, this would throw
            const scripts = container.querySelectorAll('script');
            expect(scripts.length).toBe(0);
        }).not.toThrow();
    });

    it('should sanitize HTML in result content', () => {
        const messageId = 'scenario-001';
        const maliciousContent = '<p>Safe content</p><script>alert("XSS")</script><b>Bold text</b>';
        
        renderer.createScenarioContainer(messageId, 'Test');
        renderer.addResult(messageId, 'rec-1', 'sqlagent', maliciousContent, true);
        
        const resultContent = container.querySelector('.result-content');
        const html = resultContent.innerHTML;
        
        // Should keep safe tags
        expect(html).toContain('<p>Safe content</p>');
        expect(html).toContain('<b>Bold text</b>');
        
        // Should remove dangerous content
        expect(html).not.toContain('<script>');
        expect(html).not.toContain('alert');
    });

    it('should escape agent type to prevent XSS', () => {
        const messageId = 'scenario-001';
        const maliciousAgent = '<script>alert("XSS")</script>agent';
        
        renderer.createScenarioContainer(messageId, 'Test');
        renderer.addResult(messageId, 'rec-1', maliciousAgent, 'Content', true);
        
        const agentSpan = container.querySelector('.agent-type');
        
        // Should escape the agent type
        expect(agentSpan.innerHTML).toContain('&lt;script&gt;');
        expect(agentSpan.innerHTML).not.toContain('<script>');
    });
});