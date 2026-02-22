import express from 'express';
import syncVerificationService from '../../services/sync/syncVerificationService.js';

const router = express.Router();

/**
 * GET /api/sync/status
 * Get current sync verification status
 */
router.get('/status', async (req, res) => {
    try {
        const status = syncVerificationService.getSyncStatus();
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('Error getting sync status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get sync status',
            error: error.message
        });
    }
});

/**
 * POST /api/sync/verify
 * Trigger manual sync verification
 */
router.post('/verify', async (req, res) => {
    try {
        console.log('[SyncAPI] Manual sync verification requested');
        const status = await syncVerificationService.triggerManualVerification();

        res.json({
            success: true,
            message: 'Sync verification started',
            data: status
        });
    } catch (error) {
        console.error('Error triggering sync verification:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to start sync verification',
            error: error.message
        });
    }
});

export default router;