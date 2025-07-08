import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadScript } from './helpers/load-script.js';

describe('AuthAPI (Original)', () => {
  let window;
  let authAPI;
  
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    
    // Reset fetch mock
    global.fetch = vi.fn();
    
    // Reset all mocks from previous tests
    vi.clearAllMocks();
    vi.restoreAllMocks();
    
    // Load the original script
    window = loadScript('src/app/core/static/js/auth-api.js');
    authAPI = window.authAPI; // Use the global instance
  });
  
  afterEach(() => {
    // Clean up after each test
    vi.restoreAllMocks();
  });

  describe('login error handling', () => {
    it('should throw error with detail message when login fails', async () => {
      const errorMessage = 'Invalid credentials';
      
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ detail: errorMessage })
      });

      await expect(authAPI.login('test@example.com', 'wrongpassword'))
        .rejects
        .toThrow(errorMessage);
    });

    it('should throw generic error when no detail provided', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({})
      });

      await expect(authAPI.login('test@example.com', 'wrongpassword'))
        .rejects
        .toThrow('Login failed');
    });
  });

  describe('token storage', () => {
    it('should calculate correct expiration timestamps', async () => {
      // Use a fixed timestamp to avoid timing issues
      const now = 1700000000000;
      
      // Mock Date.now in both global and window context
      vi.spyOn(Date, 'now').mockReturnValue(now);
      vi.spyOn(window.Date, 'now').mockReturnValue(now);
      
      const mockResponse = {
        access_token: 'test-token',
        expires_in: 3600, // 1 hour
        refresh_token: 'refresh-token',
        refresh_token_expires_in: 86400, // 24 hours
        user_email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User'
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      await authAPI.login('test@example.com', 'password123');

      // Check expiration calculations
      expect(localStorage.getItem('auth_token_expiry'))
        .toBe(String(now + 3600 * 1000));
      expect(localStorage.getItem('refresh_token_expiry'))
        .toBe(String(now + 86400 * 1000));
      
      // Clean up the mock
      vi.restoreAllMocks();
    });
  });

  describe('logout', () => {
    it('should clear tokens and user info on logout', async () => {
      // Set up some data first
      localStorage.setItem('auth_token', 'test-token');
      localStorage.setItem('refresh_token', 'refresh-token');
      localStorage.setItem('user_email', 'test@example.com');
      localStorage.setItem('user_first_name', 'Test');
      localStorage.setItem('user_last_name', 'User');

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Logged out' })
      });

      await authAPI.logout();

      // Verify logout endpoint was called
      expect(global.fetch).toHaveBeenCalledWith('/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-token',
          'Content-Type': 'application/json',
        }
      });

      // Verify all data was cleared
      expect(localStorage.getItem('auth_token')).toBeNull();
      expect(localStorage.getItem('refresh_token')).toBeNull();
      expect(localStorage.getItem('user_email')).toBeNull();
      expect(localStorage.getItem('user_first_name')).toBeNull();
      expect(localStorage.getItem('user_last_name')).toBeNull();
    });

    it('should still clear data even if logout request fails', async () => {
      localStorage.setItem('auth_token', 'test-token');
      localStorage.setItem('user_email', 'test@example.com');

      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      await authAPI.logout();

      // Data should still be cleared
      expect(localStorage.getItem('auth_token')).toBeNull();
      expect(localStorage.getItem('user_email')).toBeNull();
    });
  });

  describe('token refresh', () => {
    it('should refresh access token successfully', async () => {
      localStorage.setItem('refresh_token', 'valid-refresh-token');

      const mockResponse = {
        access_token: 'new-access-token',
        expires_in: 3600
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const newToken = await authAPI.refreshAccessToken();

      expect(global.fetch).toHaveBeenCalledWith('/auth/refresh_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: 'valid-refresh-token' })
      });

      expect(newToken).toBe('new-access-token');
      expect(localStorage.getItem('auth_token')).toBe('new-access-token');
    });

    it('should throw error if no refresh token available', async () => {
      localStorage.removeItem('refresh_token');

      await expect(authAPI.refreshAccessToken())
        .rejects
        .toThrow('No refresh token available');
    });

    it('should clear all tokens if refresh fails', async () => {
      localStorage.setItem('refresh_token', 'expired-token');
      localStorage.setItem('auth_token', 'old-token');
      localStorage.setItem('user_email', 'test@example.com');

      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ detail: 'Refresh token expired' })
      });

      await expect(authAPI.refreshAccessToken())
        .rejects
        .toThrow('Refresh token expired');

      // All auth data should be cleared
      expect(localStorage.getItem('auth_token')).toBeNull();
      expect(localStorage.getItem('refresh_token')).toBeNull();
      expect(localStorage.getItem('user_email')).toBeNull();
    });
  });

  describe('authenticated requests', () => {
    it('should add authorization header to authenticated requests', async () => {
      localStorage.setItem('auth_token', 'valid-token');

      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: 'success' })
      });

      const response = await authAPI.authenticatedFetch('/api/data');

      expect(global.fetch).toHaveBeenCalledWith('/api/data', {
        headers: {
          'Authorization': 'Bearer valid-token',
          'Content-Type': 'application/json'
        }
      });
    });

    it('should retry with refreshed token on 401', async () => {
      localStorage.setItem('auth_token', 'expired-token');
      localStorage.setItem('refresh_token', 'valid-refresh');

      // First call returns 401
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Token expired' })
      });

      // Refresh token call
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-token',
          expires_in: 3600
        })
      });

      // Retry with new token
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: 'success' })
      });

      const response = await authAPI.authenticatedFetch('/api/data');

      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(response.ok).toBe(true);
    });
  });

  describe('password management', () => {
    it('should send forgot password request', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Reset email sent' })
      });

      const result = await authAPI.forgotPassword('test@example.com');

      expect(global.fetch).toHaveBeenCalledWith('/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: 'test@example.com' })
      });

      expect(result.message).toBe('Reset email sent');
    });

    it('should reset password with token', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Password reset successful' })
      });

      const result = await authAPI.resetPassword('reset-token', 'newPassword123');

      expect(global.fetch).toHaveBeenCalledWith('/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: 'reset-token',
          new_password: 'newPassword123'
        })
      });

      expect(result.message).toBe('Password reset successful');
    });
  });

  describe('registration', () => {
    it('should register new user successfully', async () => {
      const mockResponse = {
        access_token: 'new-user-token',
        expires_in: 3600,
        refresh_token: 'new-refresh-token',
        refresh_token_expires_in: 86400,
        user_email: 'newuser@example.com',
        first_name: 'New',
        last_name: 'User'
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await authAPI.register('New', 'User', 'newuser@example.com', 'password123');

      expect(global.fetch).toHaveBeenCalledWith('/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_name: 'New',
          last_name: 'User',
          email: 'newuser@example.com',
          password: 'password123'
        })
      });

      // Verify tokens and user info were stored
      expect(localStorage.getItem('auth_token')).toBe('new-user-token');
      expect(localStorage.getItem('user_email')).toBe('newuser@example.com');
    });
  });

  describe('token expiration', () => {
    it('should return null for expired access token', () => {
      const expiredTime = Date.now() - 1000; // 1 second ago
      localStorage.setItem('auth_token', 'expired-token');
      localStorage.setItem('auth_token_expiry', expiredTime.toString());

      const token = authAPI.getToken();

      expect(token).toBeNull();
      expect(localStorage.getItem('auth_token')).toBeNull();
    });

    it('should return token if not expired', () => {
      const futureTime = Date.now() + 3600000; // 1 hour from now
      localStorage.setItem('auth_token', 'valid-token');
      localStorage.setItem('auth_token_expiry', futureTime.toString());

      const token = authAPI.getToken();

      expect(token).toBe('valid-token');
    });
  });

  describe('isLoggedIn', () => {
    it('should return true when valid token exists', () => {
      const futureTime = Date.now() + 3600000;
      localStorage.setItem('auth_token', 'valid-token');
      localStorage.setItem('auth_token_expiry', futureTime.toString());

      expect(authAPI.isLoggedIn()).toBe(true);
    });

    it('should return false when no token exists', () => {
      localStorage.removeItem('auth_token');
      expect(authAPI.isLoggedIn()).toBe(false);
    });

    it('should return false when token is expired', () => {
      const pastTime = Date.now() - 1000;
      localStorage.setItem('auth_token', 'expired-token');
      localStorage.setItem('auth_token_expiry', pastTime.toString());

      expect(authAPI.isLoggedIn()).toBe(false);
    });
  });
});