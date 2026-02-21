import Device from '../../models/Device.js';
import Cluster from '../../models/Cluster.js';

class DeviceHealthService {
    constructor() {
        this.io = null; // Socket.io instance
    }

    setSocketIo(io) {
        this.io = io;
    }

    /**
     * Process heartbeat event from device
     * @param {Object} event - Heartbeat event from RabbitMQ
     */
    async processHeartbeat(event) {
        try {
            const { deviceMAC, clusterID, payload } = event;

            if (!deviceMAC) {
                console.warn('[DeviceHealth] Heartbeat missing deviceMAC');
                return;
            }

            // Find existing device to check status
            const existingDevice = await Device.findOne({ deviceMAC });

            if (!existingDevice) {
                console.warn(`[DeviceHealth] Heartbeat from unknown device: ${deviceMAC}`);
                return;
            }

            // SECURITY: Don't auto-approve PENDING devices via heartbeat
            if (existingDevice.status === 'PENDING') {
                // Only update lastHeartbeat to show device is alive
                await Device.updateOne(
                    { deviceMAC },
                    { lastHeartbeat: new Date() }
                );
                // console.log(`[DeviceHealth] ⏳ ${deviceMAC} - PENDING approval (heartbeat received)`);
                return; // Don't process health metrics or emit events until approved
            }

            // For ACTIVE/OFFLINE devices, process full heartbeat with health metrics
            const updateData = {
                status: 'ACTIVE',
                lastHeartbeat: new Date(),
                healthMetrics: {
                    uptime: payload.uptime || 0,
                    wifiSignal: payload.wifiSignal || payload.rssi || 0,
                    freeHeap: payload.freeHeap || 0,
                    fpSensorStatus: payload.fpSensorStatus || 'UNKNOWN',
                    cameraStatus: payload.cameraStatus || 'UNKNOWN',
                    relayStatus: payload.relayStatus || 'UNKNOWN',
                    doorLockState: payload.doorLockState || 'UNKNOWN',
                    lastScanTime: payload.lastScanTime ? new Date(payload.lastScanTime) : null,
                    fingerprintCount: payload.fingerprintCount || 0 // Add fingerprint count for sync verification
                }
            };

            // Update camera-specific fields for ESP32-CAM devices
            if (existingDevice.deviceType === 'ESP32-CAM' || payload.streamURL) {
                if (payload.streamURL) updateData.streamURL = payload.streamURL;
                if (payload.ipAddress) updateData.ipAddress = payload.ipAddress;
                // Generate snapshot URL from stream URL if not provided
                if (payload.streamURL && !payload.snapshotURL) {
                    updateData.snapshotURL = payload.streamURL.replace('/stream', '/snapshot');
                }
            }

            const device = await Device.findOneAndUpdate(
                { deviceMAC },
                updateData,
                { new: true }
            );

            if (device) {
                // Log fingerprint count updates for debugging sync issues
                if (payload.fingerprintCount !== undefined) {
                    console.log(`[DeviceHealth] ${device.scannerID || deviceMAC}: ${payload.fingerprintCount} fingerprints stored (Updated: ${new Date().toISOString()})`);
                }
                // console.log(`[DeviceHealth] ✓ ${deviceMAC} - WiFi: ${payload.wifiSignal}dBm | Heap: ${payload.freeHeap}`);

                // Emit real-time update to dashboard (only for ACTIVE devices)
                if (this.io) {
                    this.io.emit('device-heartbeat', {
                        deviceMAC,
                        clusterID: device.clusterID,
                        status: 'ACTIVE',
                        healthMetrics: device.healthMetrics, // Keep for compatibility
                        payload: payload // Include complete heartbeat payload
                    });
                }

                // Update cluster status if device belongs to a cluster
                if (device.clusterID) {
                    await this.updateClusterStatus(device.clusterID);

                    // Update cluster door lock state if this is the door control device
                    if (payload.doorLockState) {
                        const cluster = await Cluster.findOne({
                            clusterID: device.clusterID,
                            doorControlDevice: deviceMAC
                        });

                        if (cluster && cluster.doorLockState !== payload.doorLockState) {
                            await Cluster.updateOne(
                                { clusterID: device.clusterID, doorControlDevice: deviceMAC },
                                { doorLockState: payload.doorLockState }
                            );

                            // console.log(`[DeviceHealth] Updated cluster ${device.clusterID} door lock state: ${payload.doorLockState}`);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('[DeviceHealth] Error processing heartbeat:', error.message);
        }
    }

    /**
     * Update cluster status based on device health
     * @param {String} clusterID
     */
    async updateClusterStatus(clusterID) {
        try {
            const cluster = await Cluster.findOne({ clusterID });
            if (!cluster) return;

            const deviceMACs = cluster.getDeviceMACs();
            const devices = await Device.find({
                deviceMAC: { $in: deviceMACs }
            });

            // Check how many devices are offline
            const offlineDevices = devices.filter(d => !d.isOnline());

            let status = 'OPERATIONAL';
            if (offlineDevices.length === devices.length) {
                status = 'OFFLINE';
            } else if (offlineDevices.length > 0) {
                status = 'DEGRADED';
            }

            // Update cluster status
            await Cluster.findOneAndUpdate(
                { clusterID },
                { status }
            );

            // Emit cluster status update
            if (this.io) {
                this.io.emit('cluster-status-update', {
                    clusterID,
                    status,
                    onlineDevices: devices.length - offlineDevices.length,
                    totalDevices: devices.length
                });
            }

            // console.log(`[DeviceHealth] Cluster ${clusterID}: ${status}`);
        } catch (error) {
            console.error('[DeviceHealth] Error updating cluster status:', error.message);
        }
    }

    /**
     * Periodic task to mark devices offline if no heartbeat received
     * Run this every minute via cron or setInterval
     */
    async autoOfflineDetection() {
        try {
            const staleThreshold = new Date(Date.now() - 120000); // 2 minutes

            const result = await Device.updateMany(
                {
                    lastHeartbeat: { $lt: staleThreshold },
                    status: 'ACTIVE'
                },
                { status: 'OFFLINE' }
            );

            if (result.modifiedCount > 0) {
                console.log(`[DeviceHealth] Marked ${result.modifiedCount} devices as OFFLINE`);

                // Update affected clusters
                const offlineDevices = await Device.find({ status: 'OFFLINE' });
                const clusterIDs = [...new Set(offlineDevices.map(d => d.clusterID).filter(Boolean))];

                for (const clusterID of clusterIDs) {
                    await this.updateClusterStatus(clusterID);
                }

                // Emit offline alerts
                if (this.io) {
                    this.io.emit('devices-offline', {
                        count: result.modifiedCount,
                        timestamp: new Date()
                    });
                }
            }
        } catch (error) {
            console.error('[DeviceHealth] Error in auto-offline detection:', error.message);
        }
    }

    /**
     * Get health summary for all devices
     */
    async getHealthSummary() {
        try {
            const total = await Device.countDocuments();
            const active = await Device.countDocuments({ status: 'ACTIVE' });
            const offline = await Device.countDocuments({ status: 'OFFLINE' });
            const pending = await Device.countDocuments({ status: 'PENDING' });
            const maintenance = await Device.countDocuments({ status: 'MAINTENANCE' });

            return {
                total,
                active,
                offline,
                pending,
                maintenance,
                healthPercentage: total > 0 ? Math.round((active / total) * 100) : 0
            };
        } catch (error) {
            console.error('[DeviceHealth] Error getting health summary:', error.message);
            return null;
        }
    }

    /**
     * Get devices with health issues
     */
    async getUnhealthyDevices() {
        try {
            const devices = await Device.find({
                status: { $in: ['OFFLINE', 'MAINTENANCE'] }
            }).sort({ lastHeartbeat: -1 });

            return devices;
        } catch (error) {
            console.error('[DeviceHealth] Error getting unhealthy devices:', error.message);
            return [];
        }
    }

    /**
     * Start auto-offline detection interval
     */
    startAutoOfflineDetection(intervalMs = 60000) {
        console.log('[DeviceHealth] Starting auto-offline detection...');
        setInterval(() => {
            this.autoOfflineDetection();
        }, intervalMs);
    }
}

export default new DeviceHealthService();
