import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthAPI } from '../src/app/core/static/js/auth-api-testable.js';

describe('AuthAPI', () => {
  let authAPI;
  
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    
    // Reset fetch mock
    global.fetch = vi.fn();
    
    // Reset all mocks
    vi.clearAllMocks();
    vi.restoreAllMocks();
    
    authAPI = new AuthAPI();
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('login', () => {
    it('should store tokens on successful login', async () => {
      const mockResponse = {
        access_token: 'test-access-token',
        expires_in: 3600,
        refresh_token: 'test-refresh-token',
        refresh_token_expires_in: 86400,
        user_email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User'
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      await authAPI.login('test@example.com', 'password123');

      // Verify fetch was called correctly
      expect(global.fetch).toHaveBeenCalledWith('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123',
          remember_me: false
        })
      });

      // Verify tokens were stored
      expect(localStorage.getItem('auth_token')).toBe('test-access-token');
      expect(localStorage.getItem('refresh_token')).toBe('test-refresh-token');
    });
  });
});