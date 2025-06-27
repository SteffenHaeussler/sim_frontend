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
            this.storeToken(data.access_token, data.expires_in);
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
            this.storeToken(data.access_token, data.expires_in);
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

    storeToken(token, expiresIn) {
        localStorage.setItem('auth_token', token);
        if (expiresIn) {
            // Store expiration timestamp (current time + expires_in seconds)
            const expirationTime = Date.now() + (expiresIn * 1000);
            localStorage.setItem('auth_token_expiry', expirationTime.toString());
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

    clearToken() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_token_expiry');
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

    // Helper method for authenticated fetch requests
    async authenticatedFetch(url, options = {}) {
        const token = this.getToken();
        if (!token) {
            throw new Error('No authentication token available');
        }

        const authHeaders = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...options.headers
        };

        // Add session ID header if available
        if (window.app && window.app.sessionId) {
            authHeaders['X-Session-ID'] = window.app.sessionId;
        }

        return fetch(url, {
            ...options,
            headers: authHeaders
        });
    }
}

// Global instance
window.authAPI = new AuthAPI();