import express from 'express';
import Device from '../../models/Device.js';
import Cluster from '../../models/Cluster.js';
import User from '../../models/User.js';
import deviceRegistrationService from '../../services/device/deviceRegistrationService.js';
import deviceHealthService from '../../services/device/deviceHealthService.js';
import mqttBridgeService from '../../services/mqtt/mqttBridgeService.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = express.Router();

// ============================================
// SECURITY NOTES
// ============================================
// Authentication is applied to critical endpoints (approve, reject, enroll, unlock)
// Public endpoints (clusters, devices, health) allow monitoring without auth
// Consider adding authentication to all endpoints for production deployment

// ============================================
// CLUSTER MANAGEMENT ROUTES
// ============================================

/**
 * GET /api/devices/clusters
 * Get all clusters with their devices and health status
 */
router.get('/clusters', async (req, res) => {
    try {
        const clusters = await Cluster.find().sort({ clusterName: 1 });

        const clustersWithDevices = await Promise.all(
            clusters.map(async (cluster) => {
                const deviceMACs = cluster.getDeviceMACs();
                const devices = await Device.find({
                    deviceMAC: { $in: deviceMACs }
                });

                return {
                    ...cluster.toObject(),
                    deviceDetails: devices.map(d => ({
                        ...d.toObject(),
                        isOnline: d.isOnline(),
                        minutesSinceHeartbeat: d.minutesSinceHeartbeat
                    }))
                };
            })
        );

        res.json(clustersWithDevices);
    } catch (error) {
        console.error('[DeviceRoutes] Error fetching clusters:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/devices/clusters
 * Create a new cluster
 * 
 * SECURITY: Protected by authentication - admin only
 */
router.post('/clusters', authenticateToken, async (req, res) => {
    try {
        const { clusterID, clusterName, location, unlockDuration } = req.body;

        if (!clusterID || !clusterName) {
            return res.status(400).json({ error: 'clusterID and clusterName are required' });
        }

        const cluster = new Cluster({
            clusterID,
            clusterName,
            location: location || '',
            unlockDuration: unlockDuration || 5000,
            devices: [],
            status: 'OPERATIONAL'
        });

        await cluster.save();

        res.status(201).json(cluster);
    } catch (error) {
        console.error('[DeviceRoutes] Error creating cluster:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/devices/clusters/:clusterID
 * Get specific cluster details
 */
router.get('/clusters/:clusterID', async (req, res) => {
    try {
        const { clusterID } = req.params;
        const cluster = await Cluster.findOne({ clusterID });

        if (!cluster) {
            return res.status(404).json({ error: 'Cluster not found' });
        }

        const deviceMACs = cluster.getDeviceMACs();
        const devices = await Device.find({
            deviceMAC: { $in: deviceMACs }
        });

        res.json({
            ...cluster.toObject(),
            deviceDetails: devices.map(d => ({
                ...d.toObject(),
                isOnline: d.isOnline(),
                minutesSinceHeartbeat: d.minutesSinceHeartbeat
            }))
        });
    } catch (error) {
        console.error('[DeviceRoutes] Error fetching cluster:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// DEVICE MANAGEMENT ROUTES
// ============================================

/**
 * GET /api/devices
 * Get all devices
 */
router.get('/', async (req, res) => {
    try {
        const { status, clusterID } = req.query;

        const query = {};
        if (status) query.status = status;
        if (clusterID) query.clusterID = clusterID;

        const devices = await Device.find(query).sort({ registeredAt: -1 });

        const devicesWithStatus = devices.map(d => ({
            ...d.toObject(),
            isOnline: d.isOnline(),
            minutesSinceHeartbeat: d.minutesSinceHeartbeat
        }));

        res.json(devicesWithStatus);
    } catch (error) {
        console.error('[DeviceRoutes] Error fetching devices:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/devices/pending
 * Get devices pending approval
 */
router.get('/pending', async (req, res) => {
    try {
        const pendingDevices = await deviceRegistrationService.getPendingDevices();
        res.json(pendingDevices);
    } catch (error) {
        console.error('[DeviceRoutes] Error fetching pending devices:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/devices/scanners
 * Get all active scanners for enrollment selection
 */
router.get('/scanners', async (req, res) => {
    try {
        const devices = await Device.find({
            status: 'ACTIVE',
            capabilities: 'fingerprint',
            scannerID: { $ne: null }
        }).sort({ clusterID: 1, deviceRole: 1 });

        const scanners = devices.map(d => ({
            deviceMAC: d.deviceMAC,
            scannerID: d.scannerID,
            clusterID: d.clusterID,
            deviceRole: d.deviceRole,
            deviceType: d.deviceType,
            location: d.location,
            isOnline: d.isOnline()
        }));

        res.json(scanners);
    } catch (error) {
        console.error('[DeviceRoutes] Error fetching scanners:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/devices/approve/:deviceMAC
 * Approve a pending device and assign to cluster
 * 
 * SECURITY: Protected by authentication - admin only
 */
router.post('/approve/:deviceMAC', authenticateToken, async (req, res) => {
    try {
        const { deviceMAC } = req.params;
        const { clusterID, deviceRole, scannerID, location } = req.body;

        if (!clusterID || !deviceRole || !scannerID) {
            return res.status(400).json({
                error: 'clusterID, deviceRole, and scannerID are required'
            });
        }

        // Get authenticated admin user ID from JWT token
        const adminUserId = req.user?.id || null;

        const device = await deviceRegistrationService.approveDevice(
            deviceMAC,
            { clusterID, deviceRole, scannerID, location },
            adminUserId
        );

        // Send approval confirmation to ESP32 via MQTT
        const approvalCommand = {
            action: 'DEVICE_APPROVED',
            targetDeviceMAC: deviceMAC, // Keep for device identification
            config: {
                deviceMAC: deviceMAC, // Add deviceMAC to config for verification
                clusterID: clusterID,
                deviceRole: deviceRole,
                scannerID: scannerID,
                status: 'ACTIVE',
                location: location || ''
            },
            timestamp: Date.now()
        };

        mqttBridgeService.publishCommand(approvalCommand);

        res.json({
            success: true,
            device: {
                ...device.toObject(),
                isOnline: device.isOnline()
            }
        });
    } catch (error) {
        console.error('[DeviceRoutes] Error approving device:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/devices/reject/:deviceMAC
 * Reject a pending device
 * 
 * SECURITY: Protected by authentication - admin only
 */
router.post('/reject/:deviceMAC', authenticateToken, async (req, res) => {
    try {
        const { deviceMAC } = req.params;
        const success = await deviceRegistrationService.rejectDevice(deviceMAC);

        if (success) {
            res.json({ success: true, message: 'Device rejected' });
        } else {
            res.status(404).json({ error: 'Device not found or not pending' });
        }
    } catch (error) {
        console.error('[DeviceRoutes] Error rejecting device:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/devices/health/summary
 * Get health summary for all devices
 */
router.get('/health/summary', async (req, res) => {
    try {
        const summary = await deviceHealthService.getHealthSummary();
        res.json(summary);
    } catch (error) {
        console.error('[DeviceRoutes] Error fetching health summary:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/devices/health/unhealthy
 * Get devices with health issues
 */
router.get('/health/unhealthy', async (req, res) => {
    try {
        const devices = await deviceHealthService.getUnhealthyDevices();
        res.json(devices);
    } catch (error) {
        console.error('[DeviceRoutes] Error fetching unhealthy devices:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/devices/enroll
 * Initiate enrollment on a specific scanner
 * 
 * SECURITY: Protected by authentication - admin only
 */
router.post('/enroll', authenticateToken, async (req, res) => {
    try {
        const { userId, scannerID, deviceMAC } = req.body;

        if (!userId || !scannerID || !deviceMAC) {
            return res.status(400).json({
                error: 'userId, scannerID, and deviceMAC are required'
            });
        }

        // Get user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get device to find cluster
        const device = await Device.findOne({ deviceMAC });
        if (!device) {
            return res.status(404).json({ error: 'Device not found' });
        }

        if (device.status !== 'ACTIVE' || !device.isOnline()) {
            return res.status(400).json({ error: 'Device is not online' });
        }

        // Find next available fingerprint ID on this scanner
        // TODO: Implement proper ID management per scanner
        const nextFpId = Date.now() % 255 + 1; // Temporary solution

        // Send ENROLL command to specific device
        const command = {
            action: 'ENROLL',
            id: nextFpId,
            userId: userId,
            targetDeviceMAC: deviceMAC,
            scannerID: scannerID,
            clusterID: device.clusterID
        };

        await mqttBridgeService.publishCommand(command);

        res.json({
            success: true,
            message: 'Enrollment initiated',
            fingerprintId: nextFpId,
            scannerID: scannerID,
            deviceMAC: deviceMAC
        });

    } catch (error) {
        console.error('[DeviceRoutes] Error initiating enrollment:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/devices/unlock/:clusterID
 * Manually unlock door for a cluster
 * 
 * SECURITY: Protected by authentication - admin only
 */
router.post('/unlock/:clusterID', authenticateToken, async (req, res) => {
    try {
        const { clusterID } = req.params;
        const { duration } = req.body;

        const cluster = await Cluster.findOne({ clusterID });
        if (!cluster || !cluster.doorControlDevice) {
            return res.status(404).json({ error: 'Cluster or door control device not found' });
        }

        const command = {
            action: 'UNLOCK_DOOR',
            targetDeviceMAC: cluster.doorControlDevice,
            clusterID: clusterID,
            duration: duration || cluster.unlockDuration || 5000,
            reason: 'Manual unlock from dashboard',
            timestamp: Date.now()
        };

        await mqttBridgeService.publishCommand(command);

        res.json({
            success: true,
            message: 'Unlock command sent',
            duration: command.duration
        });

    } catch (error) {
        console.error('[DeviceRoutes] Error unlocking door:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
