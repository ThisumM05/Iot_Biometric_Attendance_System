import express from 'express';
import templateSyncService from '../../services/sync/templateSyncService.js';
import User from '../../models/User.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = express.Router();

/**
 * @route POST /api/sync/enroll
 * @desc Initiate global enrollment (enroll once, sync to all devices)
 * @access Admin only
 */
router.post('/enroll', authenticateToken, async (req, res) => {
    try {
        const { userId, deviceMAC, scannerID } = req.body;

        if (!userId || !deviceMAC || !scannerID) {
            return res.status(400).json({
                success: false,
                error: 'userId, deviceMAC, and scannerID are required'
            });
        }

        const result = await templateSyncService.initiateGlobalEnrollment(userId, deviceMAC, scannerID);

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('[SyncAPI] Global enrollment error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route GET /api/sync/status/:userId
 * @desc Get synchronization status for a user across all devices
 * @access Admin only
 */
router.get('/status/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;

        const status = await templateSyncService.getUserSyncStatus(userId);

        if (!status) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.json({
            success: true,
            data: status
        });

    } catch (error) {
        console.error('[SyncAPI] Get sync status error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route POST /api/sync/retry/:userId
 * @desc Retry failed synchronizations for a user
 * @access Admin only
 */
router.post('/retry/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;

        const result = await templateSyncService.retrySyncForUser(userId);

        res.json({
            success: true,
            data: result,
            message: 'Synchronization retry initiated'
        });

    } catch (error) {
        console.error('[SyncAPI] Retry sync error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route POST /api/sync/sync-device/:deviceMAC
 * @desc Sync all existing user templates to a new device
 * @access Admin only
 */
router.post('/sync-device/:deviceMAC', authenticateToken, async (req, res) => {
    try {
        const { deviceMAC } = req.params;

        const result = await templateSyncService.syncNewDeviceWithAllUsers(deviceMAC);

        res.json({
            success: true,
            data: result,
            message: `Synced ${result.syncedUsers} users to device`
        });

    } catch (error) {
        console.error('[SyncAPI] Sync device error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route DELETE /api/sync/user/:userId
 * @desc Remove user fingerprint from all devices
 * @access Admin only
 */
router.delete('/user/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;

        await templateSyncService.removeUserFromAllDevices(userId);

        res.json({
            success: true,
            message: 'User removed from all devices'
        });

    } catch (error) {
        console.error('[SyncAPI] Remove user error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route POST /api/sync/device/:deviceMAC/clear
 * @desc Clear all fingerprint templates from a specific device
 * @access Admin only
 */
router.post('/device/:deviceMAC/clear', authenticateToken, async (req, res) => {
    try {
        const { deviceMAC } = req.params;

        const result = await templateSyncService.clearDeviceTemplates(deviceMAC);

        res.json({
            success: true,
            ...result
        });

    } catch (error) {
        console.error('[SyncAPI] Clear device templates error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route POST /api/sync/sync-all
 * @desc Sync all existing user templates to all active devices (global sync)
 * @access Admin only
 */
router.post('/sync-all', authenticateToken, async (req, res) => {
    try {
        console.log('[SyncAPI] Starting global template sync to all devices...');

        const result = await templateSyncService.syncAllTemplatesToAllDevices();

        res.json({
            success: true,
            data: result,
            message: `Global sync initiated: ${result.totalUsers} users to ${result.totalDevices} devices`
        });

    } catch (error) {
        console.error('[SyncAPI] Global sync error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route GET /api/sync/overview
 * @desc Get system-wide synchronization overview
 * @access Admin only
 */
router.get('/overview', authenticateToken, async (req, res) => {
    try {
        // Get all enrolled users with sync statistics
        const enrolledUsers = await User.find({
            isEnrolled: true
        }).select('username globalFingerprintId syncedDevices templateMetadata');

        const overview = {
            totalEnrolledUsers: enrolledUsers.length,
            users: enrolledUsers.map(user => {
                const syncStats = {
                    userId: user._id,
                    username: user.username,
                    globalFingerprintId: user.globalFingerprintId,
                    enrollmentDate: user.templateMetadata?.createdAt,
                    totalDevices: user.syncedDevices.length,
                    syncedDevices: user.syncedDevices.filter(d => d.syncStatus === 'synced').length,
                    pendingDevices: user.syncedDevices.filter(d => d.syncStatus === 'pending').length,
                    failedDevices: user.syncedDevices.filter(d => d.syncStatus === 'failed').length,
                    syncHealth: user.syncedDevices.length > 0 ?
                        Math.round((user.syncedDevices.filter(d => d.syncStatus === 'synced').length / user.syncedDevices.length) * 100) : 0
                };
                return syncStats;
            })
        };

        // Calculate system statistics
        const totalSyncedConnections = overview.users.reduce((sum, user) => sum + user.syncedDevices, 0);
        const totalPendingConnections = overview.users.reduce((sum, user) => sum + user.pendingDevices, 0);
        const totalFailedConnections = overview.users.reduce((sum, user) => sum + user.failedDevices, 0);

        // Get device sync status for better health calculation
        const Device = (await import('../../models/Device.js')).default;
        const devices = await Device.find({
            capabilities: 'fingerprint',
            status: 'ACTIVE' // Only count active devices
        }).select('deviceMAC deviceName scannerID status healthMetrics').lean(); // Use .lean() for fresh data

        let devicesInSync = 0;
        let totalDeviceFingerprintCount = 0;
        // Compute per-device sync using either sensor-reported count OR DB synced records (safer and realtime)
        devices.forEach(device => {
            const actualCount = device.healthMetrics?.fingerprintCount ?? 0;
            // Count how many enrolled users have this device marked as 'synced' in the DB
            const dbSyncedCount = enrolledUsers.reduce((cnt, u) => {
                return cnt + (u.syncedDevices && u.syncedDevices.some(d => d.deviceMAC === device.deviceMAC && d.syncStatus === 'synced') ? 1 : 0);
            }, 0);

            totalDeviceFingerprintCount += actualCount;

            // Consider device in-sync if either the sensor reports full count or every enrolled user has a syncedDevices entry for it
            if (actualCount === overview.totalEnrolledUsers || dbSyncedCount === overview.totalEnrolledUsers) {
                devicesInSync++;
            }

            console.log(`[SyncOverview] ${device.scannerID || device.deviceName || device.deviceMAC} (${device.status}): sensor=${actualCount}/${overview.totalEnrolledUsers}, dbSynced=${dbSyncedCount}/${overview.totalEnrolledUsers}`);
        });

        overview.systemStats = {
            totalSyncedConnections,
            totalPendingConnections,
            totalFailedConnections,
            overallSyncHealth: devices.length > 0 ?
                Math.round((devicesInSync / devices.length) * 100) :
                (totalSyncedConnections > 0 ? Math.round((totalSyncedConnections / (totalSyncedConnections + totalPendingConnections + totalFailedConnections)) * 100) : 100)
        };

        console.log(`[SyncOverview] Health Calculation: ${devicesInSync}/${devices.length} devices in sync = ${overview.systemStats.overallSyncHealth}% health`);
        console.log(`[SyncOverview] Fallback: ${totalSyncedConnections} synced / ${totalSyncedConnections + totalPendingConnections + totalFailedConnections} total connections`);

        res.json({
            success: true,
            data: overview
        });

    } catch (error) {
        console.error('[SyncAPI] Get overview error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;