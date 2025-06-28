// Simple Authentication API Service
class AuthAPI {
    constructor() {
        this.baseUrl = '/auth';
    }

    async login(email, password, rememberMe = false) {
        try {
            const response = await fetch(`${this.baseUrl}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    email, 
                    password, 
                    remember_me: rememberMe 
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Login failed');
            }

            const data = await response.json();
            this.storeToken(data.access_token, data.expires_in, data.refresh_token, data.refresh_token_expires_in);
            this.storeUserInfo(data.user_email, data.first_name, data.last_name);
            return data;
        } catch (error) {
            throw error;
        }
    }

    async register(firstName, lastName, email, password) {
        try {
            const response = await fetch(`${this.baseUrl}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    first_name: firstName,
                    last_name: lastName,
                    email,
                    password
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Registration failed');
            }

            const data = await response.json();
            this.storeToken(data.access_token, data.expires_in, data.refresh_token, data.refresh_token_expires_in);
            this.storeUserInfo(data.user_email, data.first_name, data.last_name);
            return data;
        } catch (error) {
            throw error;
        }
    }

    async logout() {
        try {
            const token = this.getToken();
            if (token) {
                await fetch(`${this.baseUrl}/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    }
                });
            }
        } catch (error) {
            console.warn('Logout request failed:', error);
        } finally {
            this.clearToken();
            this.clearUserInfo();
        }
    }

    async forgotPassword(email) {
        try {
            const response = await fetch(`${this.baseUrl}/forgot-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Password reset request failed');
            }

            const data = await response.json();
            return data;
        } catch (error) {
            throw error;
        }
    }

    async resetPassword(token, newPassword) {
        try {
            const response = await fetch(`${this.baseUrl}/reset-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    token,
                    new_password: newPassword
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Password reset failed');
            }

            const data = await response.json();
            return data;
        } catch (error) {
            throw error;
        }
    }

    async updateProfile(firstName, lastName) {
        try {
            const response = await this.authenticatedFetch(`${this.baseUrl}/profile`, {
                method: 'PUT',
                body: JSON.stringify({
                    first_name: firstName,
                    last_name: lastName
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Profile update failed');
            }

            const data = await response.json();
            // Update stored user info
            this.storeUserInfo(data.user_email, data.first_name, data.last_name);
            return data;
        } catch (error) {
            throw error;
        }
    }

    async deleteAccount(password) {
        try {
            const response = await this.authenticatedFetch(`${this.baseUrl}/account`, {
                method: 'DELETE',
                body: JSON.stringify({ password })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Account deletion failed');
            }

            const data = await response.json();
            // Clear all stored data since account is deleted
            this.clearToken();
            this.clearUserInfo();
            return data;
        } catch (error) {
            throw error;
        }
    }

    async refreshAccessToken() {
        try {
            const refreshToken = this.getRefreshToken();
            if (!refreshToken) {
                throw new Error('No refresh token available');
            }

            const response = await fetch(`${this.baseUrl}/refresh_token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ refresh_token: refreshToken })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Token refresh failed');
            }

            const data = await response.json();
            // Store the new access token (refresh token stays the same)
            this.storeToken(data.access_token, data.expires_in);
            console.log('Access token refreshed successfully');
            return data.access_token;
        } catch (error) {
            console.error('Failed to refresh token:', error);
            // If refresh fails, clear all tokens and force re-login
            this.clearToken();
            this.clearUserInfo();
            throw error;
        }
    }

    storeToken(token, expiresIn, refreshToken = null, refreshTokenExpiresIn = null) {
        localStorage.setItem('auth_token', token);
        if (expiresIn) {
            // Store expiration timestamp (current time + expires_in seconds)
            const expirationTime = Date.now() + (expiresIn * 1000);
            localStorage.setItem('auth_token_expiry', expirationTime.toString());
        }
        
        // Store refresh token if provided
        if (refreshToken) {
            localStorage.setItem('refresh_token', refreshToken);
            if (refreshTokenExpiresIn) {
                const refreshExpirationTime = Date.now() + (refreshTokenExpiresIn * 1000);
                localStorage.setItem('refresh_token_expiry', refreshExpirationTime.toString());
            }
        }
    }

    getToken() {
        const token = localStorage.getItem('auth_token');
        const expiry = localStorage.getItem('auth_token_expiry');
        
        // Check if token has expired
        if (token && expiry && Date.now() > parseInt(expiry)) {
            console.log('Token expired, clearing...');
            this.clearToken();
            this.clearUserInfo();
            return null;
        }
        
        return token;
    }

    getRefreshToken() {
        const refreshToken = localStorage.getItem('refresh_token');
        const expiry = localStorage.getItem('refresh_token_expiry');
        
        // Check if refresh token has expired
        if (refreshToken && expiry && Date.now() > parseInt(expiry)) {
            console.log('Refresh token expired, clearing...');
            this.clearToken();
            this.clearUserInfo();
            return null;
        }
        
        return refreshToken;
    }

    clearToken() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_token_expiry');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('refresh_token_expiry');
    }

    storeUserInfo(email, firstName, lastName) {
        localStorage.setItem('user_email', email);
        localStorage.setItem('user_first_name', firstName || '');
        localStorage.setItem('user_last_name', lastName || '');
    }

    getUserInfo() {
        return {
            email: localStorage.getItem('user_email'),
            firstName: localStorage.getItem('user_first_name'),
            lastName: localStorage.getItem('user_last_name')
        };
    }

    clearUserInfo() {
        localStorage.removeItem('user_email');
        localStorage.removeItem('user_first_name');
        localStorage.removeItem('user_last_name');
    }

    isLoggedIn() {
        return !!this.getToken();
    }

    // Helper method for authenticated fetch requests with automatic token refresh
    async authenticatedFetch(url, options = {}) {
        let token = this.getToken();
        if (!token) {
            throw new Error('No authentication token available');
        }

        const authHeaders = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers
        };

        const response = await fetch(url, {
            ...options,
            headers: authHeaders
        });

        // If we get 401 (Unauthorized), try to refresh the token and retry once
        if (response.status === 401 && this.getRefreshToken()) {
            console.log('Access token expired, attempting refresh...');
            try {
                // Try to refresh the access token
                const newToken = await this.refreshAccessToken();
                
                // Retry the original request with the new token
                const retryHeaders = {
                    'Authorization': `Bearer ${newToken}`,
                    'Content-Type': 'application/json',
                    ...options.headers
                };

                return fetch(url, {
                    ...options,
                    headers: retryHeaders
                });
            } catch (refreshError) {
                console.error('Token refresh failed, user needs to re-login');
                // Return the original 401 response
                return response;
            }
        }

        return response;
    }
}

// Global instance
window.authAPI = new AuthAPI();