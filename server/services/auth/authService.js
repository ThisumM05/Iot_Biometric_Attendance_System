import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

class AuthService {
    constructor() {
        // Fallback admin credentials (will be replaced by database authentication)
        this.fallbackAdminUsername = process.env.ADMIN_USERNAME || 'admin';
        this.fallbackAdminPassword = process.env.ADMIN_PASSWORD || 'admin123';
        this.jwtSecret = process.env.JWT_SECRET || 'default_secret';
    }

    /**
     * Validate login credentials (will be replaced with database query)
     * @param {string} username 
     * @param {string} password 
     * @returns {boolean}
     */
    validateCredentials(username, password) {
        // TODO: Replace with database authentication
        // This is a temporary fallback until database connection is established
        console.log('[TEMP] Using fallback authentication - replace with database query');
        return username === this.fallbackAdminUsername && password === this.fallbackAdminPassword;
    }

    /**
     * Generate JWT token
     * @param {string} username 
     * @returns {string}
     */
    generateToken(username) {
        const payload = {
            username: username,
            timestamp: Date.now()
        };

        return jwt.sign(payload, this.jwtSecret, {
            expiresIn: '24h' // Token expires in 24 hours
        });
    }

    /**
     * Verify JWT token
     * @param {string} token 
     * @returns {object|null}
     */
    verifyToken(token) {
        try {
            return jwt.verify(token, this.jwtSecret);
        } catch (error) {
            return null;
        }
    }

    /**
     * Authenticate user and return token
     * @param {string} username 
     * @param {string} password 
     * @returns {object}
     */
    authenticate(username, password) {
        if (!username || !password) {
            return {
                success: false,
                message: 'Username and password are required'
            };
        }

        if (this.validateCredentials(username, password)) {
            const token = this.generateToken(username);
            return {
                success: true,
                message: 'Authentication successful',
                token: token,
                user: {
                    username: username,
                    role: 'admin'
                }
            };
        } else {
            return {
                success: false,
                message: 'Invalid username or password'
            };
        }
    }
}

export default new AuthService();