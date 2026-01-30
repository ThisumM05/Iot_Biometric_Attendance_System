const authService = require('../services/auth/authService');

/**
 * Middleware to verify JWT token
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 */
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            message: 'Access token required'
        });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const decoded = authService.verifyToken(token);

    if (decoded) {
        req.user = {
            username: decoded.username,
            role: 'admin'
        };
        next();
    } else {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }
};

module.exports = {
    authenticateToken
};