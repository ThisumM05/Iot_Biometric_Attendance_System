import Device from '../models/Device.js';
import cameraStreamService from '../services/camera/cameraStreamService.js';
import mqttBridgeService from '../services/mqtt/mqttBridgeService.js';

/**
 * Get all active cameras with their stream URLs
 */
export const getAllCameras = async (req, res) => {
    try {
        const cameras = await Device.find({
            deviceType: 'ESP32-CAM',
            status: { $in: ['ACTIVE', 'PENDING'] }
        })
            .select('deviceMAC location streamURL snapshotURL ipAddress status healthMetrics.cameraStatus lastHeartbeat')
            .lean();

        // Add full URLs if not already present
        const camerasWithURLs = cameras.map(camera => ({
            ...camera,
            streamURL: camera.streamURL || (camera.ipAddress ? `http://${camera.ipAddress}:81/stream` : null),
            snapshotURL: camera.snapshotURL || (camera.ipAddress ? `http://${camera.ipAddress}:81/snapshot` : null)
        }));

        res.json({
            success: true,
            count: camerasWithURLs.length,
            cameras: camerasWithURLs
        });
    } catch (error) {
        console.error('[Camera Controller] Error getting cameras:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve cameras',
            error: error.message
        });
    }
};

/**
 * Get camera by ID/MAC
 */
export const getCameraById = async (req, res) => {
    try {
        const { id } = req.params;

        const camera = await Device.findOne({
            deviceMAC: id.toUpperCase(),
            deviceType: 'ESP32-CAM'
        }).lean();

        if (!camera) {
            return res.status(404).json({
                success: false,
                message: 'Camera not found'
            });
        }

        // Add full URLs if not already present
        const cameraWithURLs = {
            ...camera,
            streamURL: camera.streamURL || (camera.ipAddress ? `http://${camera.ipAddress}:81/stream` : null),
            snapshotURL: camera.snapshotURL || (camera.ipAddress ? `http://${camera.ipAddress}:81/snapshot` : null)
        };

        res.json({
            success: true,
            camera: cameraWithURLs
        });
    } catch (error) {
        console.error('[Camera Controller] Error getting camera:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve camera',
            error: error.message
        });
    }
};

/**
 * Get cameras by cluster
 */
export const getCamerasByCluster = async (req, res) => {
    try {
        const { clusterId } = req.params;

        const cameras = await Device.find({
            deviceType: 'ESP32-CAM',
            clusterID: clusterId,
            status: { $in: ['ACTIVE', 'PENDING'] }
        })
            .select('deviceMAC location streamURL snapshotURL ipAddress status healthMetrics.cameraStatus lastHeartbeat')
            .lean();

        const camerasWithURLs = cameras.map(camera => ({
            ...camera,
            streamURL: camera.streamURL || (camera.ipAddress ? `http://${camera.ipAddress}:81/stream` : null),
            snapshotURL: camera.snapshotURL || (camera.ipAddress ? `http://${camera.ipAddress}:81/snapshot` : null)
        }));

        res.json({
            success: true,
            clusterId,
            count: camerasWithURLs.length,
            cameras: camerasWithURLs
        });
    } catch (error) {
        console.error('[Camera Controller] Error getting cluster cameras:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve cluster cameras',
            error: error.message
        });
    }
};

/**
 * Update camera settings
 */
export const updateCamera = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const camera = await Device.findOneAndUpdate(
            { deviceMAC: id.toUpperCase(), deviceType: 'ESP32-CAM' },
            { $set: updates },
            { new: true }
        );

        if (!camera) {
            return res.status(404).json({
                success: false,
                message: 'Camera not found'
            });
        }

        res.json({
            success: true,
            message: 'Camera updated successfully',
            camera
        });
    } catch (error) {
        console.error('[Camera Controller] Error updating camera:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update camera',
            error: error.message
        });
    }
};

/**
 * Get currently connected cameras (Debug)
 */
export const getConnectedCameras = async (req, res) => {
    try {
        const connected = cameraStreamService.getConnectedCameras();
        res.json({
            success: true,
            count: connected.length,
            cameras: connected
        });
    } catch (error) {
        console.error('[Camera Controller] Error getting connected cameras:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve connected cameras',
            error: error.message
        });
    }
};

/**
 * Enable or disable object detection on a specific camera device
 * Sends a SET_OBJECT_DETECTION MQTT command to the ESP32
 */
export const setObjectDetection = async (req, res) => {
    try {
        const { deviceMAC } = req.params;
        const { enabled } = req.body;

        if (typeof enabled !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: '"enabled" must be a boolean (true or false)'
            });
        }

        const published = mqttBridgeService.publishCommand({
            action: 'SET_OBJECT_DETECTION',
            targetDeviceMAC: deviceMAC.toUpperCase(),
            enabled,
            timestamp: Date.now()
        });

        if (!published) {
            return res.status(503).json({
                success: false,
                message: 'MQTT not connected — cannot send command to device'
            });
        }

        console.log(`[Camera Controller] Object detection ${enabled ? 'ENABLED' : 'DISABLED'} for ${deviceMAC}`);

        res.json({
            success: true,
            message: `Object detection ${enabled ? 'enabled' : 'disabled'} for device ${deviceMAC}`,
            deviceMAC: deviceMAC.toUpperCase(),
            enabled
        });
    } catch (error) {
        console.error('[Camera Controller] Error setting object detection:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send object detection command',
            error: error.message
        });
    }
};

export default {
    getAllCameras,
    getCameraById,
    getCamerasByCluster,
    updateCamera,
    getConnectedCameras,
    setObjectDetection
};
