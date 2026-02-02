import authService from '../../services/auth/authService.js';

class AuthController {
    /**
     * Handle login request
     * @param {*} req 
     * @param {*} res 
     */
    async login(req, res) {
        const timestamp = new Date().toISOString();
        const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'Unknown';

        try {
            const { username, password } = req.body;

            console.log('═══════════════════════════════════════');
            console.log('LOGIN ATTEMPT');
            console.log('═══════════════════════════════════════');
            console.log(`Timestamp: ${timestamp}`);
            console.log(`Username: ${username}`);
            console.log(`IP Address: ${clientIP}`);
            console.log(`User Agent: ${req.headers['user-agent']}`);

            // Validate input
            if (!username || !password) {
                console.log('VALIDATION FAILED: Missing credentials');
                console.log('═══════════════════════════════════════\n');
                return res.status(400).json({
                    success: false,
                    message: 'Username and password are required'
                });
            }

            // Authenticate user
            const authResult = authService.authenticate(username, password);

            if (authResult.success) {
                console.log('LOGIN SUCCESSFUL');
                console.log(`JWT Token Generated: ${authResult.token.substring(0, 20)}...`);
                console.log(`User Role: ${authResult.user.role}`);
                console.log('═══════════════════════════════════════\n');

                return res.status(200).json({
                    success: true,
                    message: authResult.message,
                    token: authResult.token,
                    user: authResult.user
                });
            } else {
                console.log('LOGIN FAILED: Invalid credentials');
                console.log(`Reason: ${authResult.message}`);
                console.log('═══════════════════════════════════════\n');

                return res.status(401).json({
                    success: false,
                    message: authResult.message
                });
            }
        } catch (error) {
            console.log('LOGIN ERROR: Server exception occurred');
            console.error('Error Details:', error);
            console.log('═══════════════════════════════════════\n');

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
        const timestamp = new Date().toISOString();
        const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'Unknown';

        try {
            console.log('═══════════════════════════════════════');
            console.log('LOGOUT REQUEST');
            console.log('═══════════════════════════════════════');
            console.log(`Timestamp: ${timestamp}`);
            console.log(`IP Address: ${clientIP}`);
            console.log('LOGOUT SUCCESSFUL');
            console.log('═══════════════════════════════════════\n');

            // In a simple JWT implementation, logout is handled client-side
            // by removing the token from storage
            return res.status(200).json({
                success: true,
                message: 'Logout successful'
            });
        } catch (error) {
            console.log('LOGOUT ERROR: Server exception occurred');
            console.error('Error Details:', error);
            console.log('═══════════════════════════════════════\n');

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
        const timestamp = new Date().toISOString();
        const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'Unknown';

        try {
            console.log('TOKEN VERIFICATION REQUEST');
            console.log(`${timestamp} | ${clientIP}`);

            const authHeader = req.headers.authorization;

            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                console.log('TOKEN MISSING: No authorization header provided\n');
                return res.status(401).json({
                    success: false,
                    message: 'No token provided'
                });
            }

            const token = authHeader.substring(7); // Remove 'Bearer ' prefix
            console.log(`Token: ${token.substring(0, 20)}...`);

            const decoded = authService.verifyToken(token);

            if (decoded) {
                console.log(`TOKEN VALID: User ${decoded.username} authenticated\n`);
                return res.status(200).json({
                    success: true,
                    message: 'Token is valid',
                    user: {
                        username: decoded.username,
                        role: 'admin'
                    }
                });
            } else {
                console.log('TOKEN INVALID: Verification failed\n');
                return res.status(401).json({
                    success: false,
                    message: 'Invalid or expired token'
                });
            }
        } catch (error) {
            console.log('TOKEN VERIFICATION ERROR');
            console.error('Error Details:', error);
            console.log('═══════════════════════════════════════\n');

            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }
}

export default new AuthController();