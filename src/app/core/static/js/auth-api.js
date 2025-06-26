// Simple Authentication API Service
class AuthAPI {
    constructor() {
        this.baseUrl = '/auth';
    }

    async login(email, password) {
        try {
            const response = await fetch(`${this.baseUrl}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Login failed');
            }

            const data = await response.json();
            this.storeToken(data.access_token);
            this.storeUserInfo(data.user_email, data.first_name);
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
            this.storeToken(data.access_token);
            this.storeUserInfo(data.user_email, data.first_name);
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

    storeToken(token) {
        localStorage.setItem('auth_token', token);
    }

    getToken() {
        return localStorage.getItem('auth_token');
    }

    clearToken() {
        localStorage.removeItem('auth_token');
    }

    storeUserInfo(email, firstName) {
        localStorage.setItem('user_email', email);
        localStorage.setItem('user_first_name', firstName || '');
    }

    getUserInfo() {
        return {
            email: localStorage.getItem('user_email'),
            firstName: localStorage.getItem('user_first_name')
        };
    }

    clearUserInfo() {
        localStorage.removeItem('user_email');
        localStorage.removeItem('user_first_name');
    }

    isLoggedIn() {
        return !!this.getToken();
    }
}

// Global instance
window.authAPI = new AuthAPI();