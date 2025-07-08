import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { loadScript } from './helpers/load-script.js';

describe('LookupService', () => {
  let window;
  let lookupService;
  
  beforeEach(() => {
    localStorage.clear();
    global.fetch = vi.fn();
    vi.clearAllMocks();
    vi.restoreAllMocks();
    
    // First set up the mocks before loading the script
    global.AssetSearch = vi.fn().mockImplementation(() => ({
      initialize: vi.fn(),
      reset: vi.fn()
    }));
    global.AssetInfo = vi.fn().mockImplementation(() => ({
      initialize: vi.fn(),
      reset: vi.fn()
    }));
    global.NeighborSearch = vi.fn().mockImplementation(() => ({
      initialize: vi.fn(),
      reset: vi.fn()
    }));
    global.SemanticSearch = vi.fn().mockImplementation(() => ({
      initialize: vi.fn(),
      reset: vi.fn()
    }));
    
    // Load the actual lookup service
    window = loadScript('src/app/core/static/js/lookup-service.js');
    
    // Add DOM element to the window's document
    const div = window.document.createElement('div');
    div.id = 'lookup-session-id';
    window.document.body.appendChild(div);
    
    // Also add mocks to window for the script to use
    window.AssetSearch = global.AssetSearch;
    window.AssetInfo = global.AssetInfo;
    window.NeighborSearch = global.NeighborSearch;
    window.SemanticSearch = global.SemanticSearch;
    
    // Trigger DOMContentLoaded to create the instance
    const event = new window.Event('DOMContentLoaded', {
      bubbles: true,
      cancelable: true
    });
    window.document.dispatchEvent(event);
    
    // Now we should have window.lookupService
    lookupService = window.lookupService;
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should create instances of all lookup modules', () => {
      expect(global.AssetSearch).toHaveBeenCalled();
      expect(global.AssetInfo).toHaveBeenCalled();
      expect(global.NeighborSearch).toHaveBeenCalled();
      expect(global.SemanticSearch).toHaveBeenCalled();
    });

    it('should get the lookup session element', () => {
      expect(lookupService.lookupSessionElement).toBeTruthy();
      expect(lookupService.lookupSessionElement.id).toBe('lookup-session-id');
    });
  });

  describe('updateSessionId', () => {
    it('should update session ID when app is available', () => {
      window.app = { sessionId: 'test-session-123' };
      
      lookupService.updateSessionId();
      
      expect(lookupService.lookupSessionElement.textContent).toBe('test-session-123');
    });

    it('should not throw error when app is not available', () => {
      window.app = undefined;
      
      expect(() => lookupService.updateSessionId()).not.toThrow();
    });
  });

  describe('handleNewSession', () => {
    it('should initialize all modules', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      
      lookupService.handleNewSession();
      
      expect(lookupService.assetSearch.initialize).toHaveBeenCalled();
      expect(lookupService.assetInfo.initialize).toHaveBeenCalled();
      expect(lookupService.neighborSearch.initialize).toHaveBeenCalled();
      expect(lookupService.semanticSearch.initialize).toHaveBeenCalled();
    });

    it('should reset all modules', () => {
      lookupService.handleNewSession();
      
      expect(lookupService.assetSearch.reset).toHaveBeenCalled();
      expect(lookupService.assetInfo.reset).toHaveBeenCalled();
      expect(lookupService.neighborSearch.reset).toHaveBeenCalled();
      expect(lookupService.semanticSearch.reset).toHaveBeenCalled();
    });

    it('should update session ID', () => {
      window.app = { sessionId: 'new-session-456' };
      
      lookupService.handleNewSession();
      
      expect(lookupService.lookupSessionElement.textContent).toBe('new-session-456');
    });
  });
});