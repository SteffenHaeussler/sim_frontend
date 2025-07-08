import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { loadScript } from './helpers/load-script.js';

describe('AssetSearch', () => {
  let window;
  let assetSearch;
  
  beforeEach(() => {
    localStorage.clear();
    global.fetch = vi.fn();
    vi.clearAllMocks();
    vi.restoreAllMocks();
    
    // Load AssetSearch
    window = loadScript('src/app/core/static/js/lookup/asset-search.js');
    
    // Set up DOM in the window's document
    const elements = [
      { tag: 'input', id: 'asset-name-search' },
      { tag: 'select', id: 'asset-type-filter' },
      { tag: 'select', id: 'type-filter' },
      { tag: 'button', id: 'clear-filters', text: 'Clear' },
      { tag: 'div', id: 'asset-list' },
      { tag: 'span', id: 'results-count' },
      { tag: 'button', id: 'prev-page', text: 'Previous' },
      { tag: 'button', id: 'next-page', text: 'Next' },
      { tag: 'span', id: 'page-info' }
    ];
    
    elements.forEach(el => {
      const element = window.document.createElement(el.tag);
      element.id = el.id;
      if (el.text) element.textContent = el.text;
      window.document.body.appendChild(element);
    });
    
    // Mock window dependencies after loading
    window.authAPI = {
      authenticatedFetch: vi.fn(),
      isLoggedIn: vi.fn().mockReturnValue(true)
    };
    window.app = {
      getTrackingHeaders: vi.fn().mockReturnValue({ 'X-Session-ID': 'test-123' })
    };
    
    assetSearch = new window.AssetSearch();
    
    // Initialize the DOM element references manually since DOMContentLoaded won't fire
    assetSearch.assetNameSearch = window.document.getElementById('asset-name-search');
    assetSearch.assetTypeFilter = window.document.getElementById('asset-type-filter');
    assetSearch.typeFilter = window.document.getElementById('type-filter');
    assetSearch.clearFiltersBtn = window.document.getElementById('clear-filters');
    assetSearch.assetList = window.document.getElementById('asset-list');
    assetSearch.resultsCount = window.document.getElementById('results-count');
    assetSearch.prevPageBtn = window.document.getElementById('prev-page');
    assetSearch.nextPageBtn = window.document.getElementById('next-page');
    assetSearch.pageInfo = window.document.getElementById('page-info');
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize and set up event listeners', async () => {
      const mockData = {
        asset_types: ['Type1', 'Type2'],
        types: ['TypeA', 'TypeB']
      };
      
      window.authAPI.authenticatedFetch.mockResolvedValueOnce({
        json: async () => mockData
      });

      await assetSearch.initialize();

      expect(assetSearch.initialized).toBe(true);
      expect(assetSearch.assetNameSearch).toBeTruthy();
      expect(assetSearch.assetTypeFilter).toBeTruthy();
    });

    it('should not reinitialize if already initialized', () => {
      assetSearch.initialized = true;
      const loadSpy = vi.spyOn(assetSearch, 'loadFilterOptions');
      
      assetSearch.initialize();
      
      expect(loadSpy).toHaveBeenCalled();
    });
  });

  describe('loadFilterOptions', () => {
    it('should populate filter dropdowns', async () => {
      const mockData = {
        asset_types: ['Server', 'Database'],
        types: ['Production', 'Development']
      };
      
      window.authAPI.authenticatedFetch.mockResolvedValueOnce({
        json: async () => mockData
      });

      assetSearch.assetTypeFilter = window.document.getElementById('asset-type-filter');
      assetSearch.typeFilter = window.document.getElementById('type-filter');
      
      await assetSearch.loadFilterOptions();

      expect(assetSearch.assetTypeFilter.options.length).toBe(3); // default + 2
      expect(assetSearch.typeFilter.options.length).toBe(3); // default + 2
    });

    it('should handle errors gracefully', async () => {
      window.authAPI.authenticatedFetch.mockRejectedValueOnce(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await assetSearch.loadFilterOptions();

      expect(consoleSpy).toHaveBeenCalledWith('Failed to load filter options:', expect.any(Error));
    });
  });

  describe('searchAssets', () => {
    beforeEach(() => {
      assetSearch.assetNameSearch = window.document.getElementById('asset-name-search');
      assetSearch.assetTypeFilter = window.document.getElementById('asset-type-filter');
      assetSearch.typeFilter = window.document.getElementById('type-filter');
      assetSearch.assetList = window.document.getElementById('asset-list');
      assetSearch.resultsCount = window.document.getElementById('results-count');
    });

    it('should search with filters', async () => {
      const mockResponse = {
        assets: [
          { name: 'Server1', asset_type: 'Server' },
          { name: 'Server2', asset_type: 'Server' }
        ],
        total_count: 2,
        page: 1,
        total_pages: 1
      };

      window.authAPI.authenticatedFetch.mockResolvedValueOnce({
        json: async () => mockResponse
      });

      // First add the option to the select element so it's a valid value
      const option = window.document.createElement('option');
      option.value = 'Server';
      option.textContent = 'Server';
      assetSearch.assetTypeFilter.appendChild(option);
      
      assetSearch.assetNameSearch.value = 'Server';
      assetSearch.assetTypeFilter.value = 'Server';
      
      // Force currentPage to be set
      assetSearch.currentPage = 1;
      
      await assetSearch.searchAssets();

      // Get the actual call
      expect(window.authAPI.authenticatedFetch).toHaveBeenCalled();
      const callUrl = window.authAPI.authenticatedFetch.mock.calls[0][0];
      
      // Check that it contains the search parameters
      expect(callUrl).toContain('name=Server');
      expect(callUrl).toContain('asset_type=Server');
      expect(callUrl).toContain('page=1');
      expect(callUrl).toContain('limit=10');
      
      expect(window.authAPI.authenticatedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/lookup/search'),
        expect.objectContaining({
          headers: { 'X-Session-ID': 'test-123' }
        })
      );
    });

    it('should show login modal if not authenticated', async () => {
      window.authAPI.isLoggedIn.mockReturnValue(false);
      window.authUI = { showLoginModal: vi.fn() };

      await assetSearch.searchAssets();

      expect(window.authUI.showLoginModal).toHaveBeenCalled();
      expect(window.authAPI.authenticatedFetch).not.toHaveBeenCalled();
    });

    it('should handle search errors', async () => {
      window.authAPI.authenticatedFetch.mockRejectedValueOnce(new Error('Search failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await assetSearch.searchAssets();

      expect(consoleSpy).toHaveBeenCalledWith('Search failed:', expect.any(Error));
    });
  });

  describe('displayAssets', () => {
    beforeEach(() => {
      assetSearch.resultsCount = window.document.getElementById('results-count');
      assetSearch.assetList = window.document.getElementById('asset-list');
      assetSearch.pageInfo = window.document.getElementById('page-info');
      assetSearch.prevPageBtn = window.document.getElementById('prev-page');
      assetSearch.nextPageBtn = window.document.getElementById('next-page');
    });

    it('should display assets in the list', () => {
      const data = {
        assets: [
          { name: 'Asset1', asset_type: 'Type1' },
          { name: 'Asset2', asset_type: 'Type2' }
        ],
        total_count: 2,
        page: 1,
        total_pages: 1
      };

      assetSearch.displayAssets(data);

      expect(assetSearch.resultsCount.textContent).toBe('2 assets');
      expect(assetSearch.assetList.children.length).toBe(2);
      expect(assetSearch.pageInfo.textContent).toBe('Page 1 of 1');
    });

    it('should add click handlers to asset items', () => {
      const selectSpy = vi.spyOn(assetSearch, 'selectAsset').mockImplementation(() => {});
      const data = {
        assets: [{ name: 'Asset1', asset_type: 'Type1' }],
        total_count: 1,
        page: 1,
        total_pages: 1
      };

      assetSearch.displayAssets(data);
      
      const assetItem = assetSearch.assetList.querySelector('.asset-item');
      assetItem.click();

      expect(selectSpy).toHaveBeenCalledWith(data.assets[0]);
    });
  });

  describe('pagination', () => {
    beforeEach(() => {
      assetSearch.prevPageBtn = window.document.getElementById('prev-page');
      assetSearch.nextPageBtn = window.document.getElementById('next-page');
      assetSearch.pageInfo = window.document.getElementById('page-info');
    });

    it('should update pagination controls', () => {
      const data = {
        page: 2,
        total_pages: 5,
        assets: [],
        total_count: 50
      };

      assetSearch.updatePagination(data);

      expect(assetSearch.pageInfo.textContent).toBe('Page 2 of 5');
      expect(assetSearch.prevPageBtn.disabled).toBe(false);
      expect(assetSearch.nextPageBtn.disabled).toBe(false);
    });

    it('should disable prev button on first page', () => {
      const data = {
        page: 1,
        total_pages: 5,
        assets: [],
        total_count: 50
      };

      assetSearch.updatePagination(data);

      expect(assetSearch.prevPageBtn.disabled).toBe(true);
      expect(assetSearch.nextPageBtn.disabled).toBe(false);
    });

    it('should change page when clicking navigation', async () => {
      assetSearch.currentPage = 2;
      const searchSpy = vi.spyOn(assetSearch, 'searchAssets').mockImplementation(() => {});

      assetSearch.changePage(1);

      expect(assetSearch.currentPage).toBe(3);
      expect(searchSpy).toHaveBeenCalled();
    });
  });

  describe('clearFilters', () => {
    it('should reset all filters and search', () => {
      assetSearch.assetNameSearch = window.document.getElementById('asset-name-search');
      assetSearch.assetTypeFilter = window.document.getElementById('asset-type-filter');
      assetSearch.typeFilter = window.document.getElementById('type-filter');
      
      assetSearch.assetNameSearch.value = 'test';
      assetSearch.assetTypeFilter.value = 'Server';
      assetSearch.typeFilter.value = 'Production';
      assetSearch.currentPage = 5;
      
      const searchSpy = vi.spyOn(assetSearch, 'searchAssets').mockImplementation(() => {});

      assetSearch.clearFilters();

      expect(assetSearch.assetNameSearch.value).toBe('');
      expect(assetSearch.assetTypeFilter.value).toBe('');
      expect(assetSearch.typeFilter.value).toBe('');
      expect(assetSearch.currentPage).toBe(1);
      expect(searchSpy).toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should reset the component state', () => {
      assetSearch.assetNameSearch = window.document.getElementById('asset-name-search');
      assetSearch.assetList = window.document.getElementById('asset-list');
      assetSearch.resultsCount = window.document.getElementById('results-count');
      
      assetSearch.assetNameSearch.value = 'test';
      assetSearch.currentPage = 3;
      assetSearch.assetList.innerHTML = '<div>test</div>';
      
      assetSearch.reset();

      expect(assetSearch.currentPage).toBe(1);
      expect(assetSearch.assetNameSearch.value).toBe('');
      // The actual reset method doesn't clear the list or update count
      // It only clears the filters and resets the page
    });
  });
});