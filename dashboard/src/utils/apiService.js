const API_BASE_URL = 'http://localhost:5000/api';

class ApiService {
    constructor() {
        this.baseURL = API_BASE_URL;
    }

    /**
     * Get auth token from localStorage
     * @returns {string|null}
     */
    getToken() {
        return localStorage.getItem('authToken');
    }

    /**
     * Get request headers with auth token
     * @returns {object}
     */
    getHeaders() {
        const token = this.getToken();
        const headers = {
            'Content-Type': 'application/json',
        };

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        return headers;
    }

    /**
     * Make authenticated API request
     * @param {string} endpoint 
     * @param {object} options 
     * @returns {Promise}
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: this.getHeaders(),
            ...options,
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'API request failed');
            }

            return data;
        } catch (error) {
            console.error('API request error:', error);
            throw error;
        }
    }

    async get(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'GET' });
    }

    async post(endpoint, body, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'POST',
            body: body ? JSON.stringify(body) : undefined
        });
    }

    async put(endpoint, body, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'PUT',
            body: body ? JSON.stringify(body) : undefined
        });
    }

    async delete(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'DELETE' });
    }

    /**
     * Login user
     * @param {string} username 
     * @param {string} password 
     * @returns {Promise}
     */
    async login(username, password) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        });
    }

    /**
     * Logout user
     * @returns {Promise}
     */
    async logout() {
        return this.request('/auth/logout', {
            method: 'POST',
        });
    }

    /**
     * Verify token
     * @returns {Promise}
     */
    async verifyToken() {
        return this.request('/auth/verify');
    }

    /**
     * Clear authentication data
     */
    clearAuth() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        localStorage.removeItem('isAuthenticated');
    }
}

export default new ApiService();