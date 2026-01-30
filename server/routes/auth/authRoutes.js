const express = require('express');
const authController = require('../../controllers/auth/authController');
const router = express.Router();

/**
 * @route POST /api/auth/login
 * @desc Login user with username and password
 * @access Public
 */
router.post('/login', authController.login);

/**
 * @route POST /api/auth/logout
 * @desc Logout user
 * @access Public
 */
router.post('/logout', authController.logout);

/**
 * @route GET /api/auth/verify
 * @desc Verify token and get user info
 * @access Private
 */
router.get('/verify', authController.verify);

module.exports = router;