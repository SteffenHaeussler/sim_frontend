import { describe, it, expect } from 'vitest';
import { ScenarioMessageGrouper } from '../../src/app/core/static/js/scenario-message-grouper.js';

describe('ScenarioMessageGrouper', () => {
    it('should add recommendation message correctly', () => {
        const grouper = new ScenarioMessageGrouper();
        const recMessage = {
            type: 'scenario_recommendation',
            message_id: 'scenario-001',
            session_id: 'session-123',
            query: 'Test query',
            recommendations: ['Rec 1', 'Rec 2', 'Rec 3']
        };
        
        grouper.addRecommendationMessage(recMessage);
        const grouped = grouper.getGroupedMessage('scenario-001');
        
        expect(grouped).toBeDefined();
        expect(grouped.type).toBe('scenario');
        expect(grouped.query).toBe('Test query');
        expect(grouped.recommendations).toHaveLength(3);
        expect(grouped.results.size).toBe(0);
    });

    it('should add result messages to parent', () => {
        const grouper = new ScenarioMessageGrouper();
        
        // Add parent first
        grouper.addRecommendationMessage({
            type: 'scenario_recommendation',
            message_id: 'scenario-001',
            session_id: 'session-123',
            query: 'Test query',
            recommendations: ['Rec 1', 'Rec 2']
        });
        
        // Add result
        grouper.addResultMessage({
            type: 'scenario_result',
            message_id: 'scenario-001',
            sub_id: 'rec-1',
            agent: 'sqlagent',
            content: 'Result content',
            is_complete: true
        });
        
        const grouped = grouper.getGroupedMessage('scenario-001');
        expect(grouped.results.size).toBe(1);
        expect(grouped.results.get('rec-1')).toMatchObject({
            subId: 'rec-1',
            agent: 'sqlagent',
            content: 'Result content',
            isComplete: true
        });
    });

    it('should track completion status', () => {
        const grouper = new ScenarioMessageGrouper();
        
        // Setup
        grouper.addRecommendationMessage({
            type: 'scenario_recommendation',
            message_id: 'scenario-001',
            session_id: 'session-123',
            query: 'Test',
            recommendations: ['R1', 'R2', 'R3']
        });
        
        // Add partial results
        grouper.addResultMessage({
            type: 'scenario_result',
            message_id: 'scenario-001',
            sub_id: 'rec-1',
            agent: 'sqlagent',
            content: 'Partial',
            is_complete: false
        });
        
        let status = grouper.getCompletionStatus('scenario-001');
        expect(status.completed).toBe(0);
        expect(status.percentage).toBe(0);
        
        // Complete one
        grouper.addResultMessage({
            type: 'scenario_result',
            message_id: 'scenario-001',
            sub_id: 'rec-1',
            agent: 'sqlagent',
            content: 'Complete',
            is_complete: true
        });
        
        status = grouper.getCompletionStatus('scenario-001');
        expect(status.completed).toBe(1);
        expect(status.percentage).toBe(33);
    });

    it('should handle errors in results', () => {
        const grouper = new ScenarioMessageGrouper();
        
        grouper.addRecommendationMessage({
            type: 'scenario_recommendation',
            message_id: 'scenario-001',
            session_id: 'session-123',
            query: 'Test',
            recommendations: ['R1']
        });
        
        grouper.addResultMessage({
            type: 'scenario_result',
            message_id: 'scenario-001',
            sub_id: 'rec-1',
            agent: 'sqlagent',
            content: '',
            is_complete: true,
            error: 'Connection timeout'
        });
        
        const result = grouper.getGroupedMessage('scenario-001').results.get('rec-1');
        expect(result.error).toBe('Connection timeout');
    });

    it('should throw error for invalid message types', () => {
        const grouper = new ScenarioMessageGrouper();
        
        expect(() => {
            grouper.addRecommendationMessage({ type: 'invalid' });
        }).toThrow('Invalid message type');
        
        expect(() => {
            grouper.addResultMessage({ type: 'invalid' });
        }).toThrow('Invalid message type');
    });

    it('should throw error when parent message not found', () => {
        const grouper = new ScenarioMessageGrouper();
        
        expect(() => {
            grouper.addResultMessage({
                type: 'scenario_result',
                message_id: 'non-existent',
                sub_id: 'rec-1'
            });
        }).toThrow('Parent message non-existent not found');
    });
});