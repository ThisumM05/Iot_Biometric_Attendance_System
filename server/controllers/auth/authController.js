const authService = require('../../services/auth/authService');

class AuthController {
    /**
     * Handle login request
     * @param {*} req 
     * @param {*} res 
     */
    async login(req, res) {
        try {
            const { username, password } = req.body;

            // Validate input
            if (!username || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Username and password are required'
                });
            }

            // Authenticate user
            const authResult = authService.authenticate(username, password);

            if (authResult.success) {
                return res.status(200).json({
                    success: true,
                    message: authResult.message,
                    token: authResult.token,
                    user: authResult.user
                });
            } else {
                return res.status(401).json({
                    success: false,
                    message: authResult.message
                });
            }
        } catch (error) {
            console.error('Login error:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    /**
     * Handle logout request
     * @param {*} req 
     * @param {*} res 
     */
    async logout(req, res) {
        try {
            // In a simple JWT implementation, logout is handled client-side
            // by removing the token from storage
            return res.status(200).json({
                success: true,
                message: 'Logout successful'
            });
        } catch (error) {
            console.error('Logout error:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }

    /**
     * Verify token and return user info
     * @param {*} req 
     * @param {*} res 
     */
    async verify(req, res) {
        try {
            const authHeader = req.headers.authorization;

            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({
                    success: false,
                    message: 'No token provided'
                });
            }

            const token = authHeader.substring(7); // Remove 'Bearer ' prefix
            const decoded = authService.verifyToken(token);

            if (decoded) {
                return res.status(200).json({
                    success: true,
                    message: 'Token is valid',
                    user: {
                        username: decoded.username,
                        role: 'admin'
                    }
                });
            } else {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid or expired token'
                });
            }
        } catch (error) {
            console.error('Token verification error:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }
}

module.exports = new AuthController();