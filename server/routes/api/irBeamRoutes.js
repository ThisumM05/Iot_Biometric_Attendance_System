/**
 * IR Beam Sensor Routes
 * 
 * Handles IR beam sensor data for people counting
 * This is a placeholder for future IR sensor integration
 */

import express from 'express';
import tailgatingDetection from '../../services/accessControl/tailgatingDetection.js';

const router = express.Router();

/**
 * POST /api/ir-beam/crossing
 * Record IR beam crossing event
 * 
 * Body: {
 *   deviceId: string,
 *   direction: 'IN' | 'OUT',
 *   timestamp: number (optional)
 * }
 */
router.post('/crossing', async (req, res) => {
    try {
        const { deviceId, direction, timestamp } = req.body;

        if (!deviceId) {
            return res.status(400).json({
                success: false,
                message: 'deviceId is required'
            });
        }

        if (!direction || !['IN', 'OUT'].includes(direction)) {
            return res.status(400).json({
                success: false,
                message: 'direction must be IN or OUT'
            });
        }

        const sessionId = tailgatingDetection.recordBeamCrossing(
            deviceId,
            direction,
            timestamp || Date.now()
        );

        res.json({
            success: true,
            sessionId,
            message: `Beam crossing recorded: ${direction}`
        });

    } catch (error) {
        console.error('[IR Beam] Error recording crossing:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * POST /api/ir-beam/test
 * Test endpoint for simulating IR beam crossings
 */
router.post('/test', async (req, res) => {
    try {
        const { deviceId, count = 1, direction = 'IN', delay = 500 } = req.body;

        if (!deviceId) {
            return res.status(400).json({
                success: false,
                message: 'deviceId is required'
            });
        }

        console.log(`[IR Beam Test] Simulating ${count} crossings for device ${deviceId}`);

        // Simulate multiple crossings with delay
        const crossings = [];
        for (let i = 0; i < count; i++) {
            await new Promise(resolve => setTimeout(resolve, delay));

            const sessionId = tailgatingDetection.recordBeamCrossing(
                deviceId,
                direction,
                Date.now()
            );

            crossings.push({
                index: i + 1,
                sessionId,
                timestamp: Date.now()
            });
        }

        res.json({
            success: true,
            message: `Simulated ${count} beam crossings`,
            crossings
        });

    } catch (error) {
        console.error('[IR Beam Test] Error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * GET /api/ir-beam/sessions
 * Get active detection sessions (for debugging)
 */
router.get('/sessions', (req, res) => {
    try {
        const sessions = tailgatingDetection.getActiveSessions();

        res.json({
            success: true,
            count: sessions.length,
            sessions
        });

    } catch (error) {
        console.error('[IR Beam] Error getting sessions:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

export default router;
