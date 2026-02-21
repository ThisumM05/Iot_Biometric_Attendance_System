import Device from '../../models/Device.js';
import Cluster from '../../models/Cluster.js';

class DeviceRegistrationService {
    constructor() {
        this.io = null;
        this.mqttBridgeService = null;
    }

    setSocketIo(io) {
        this.io = io;
    }

    setMqttBridge(mqttBridgeService) {
        this.mqttBridgeService = mqttBridgeService;
    }

    /**
     * Process device registration event
     * @param {Object} event - DEVICE_REGISTER event from ESP32
     * 
     * SECURITY: Always requires admin approval. ESP32 cannot self-assign to clusters.
     * Cluster/role/scanner info from ESP32 is IGNORED for security reasons.
     */
    async registerDevice(event) {
        try {
            const { deviceMAC, payload } = event;
            const { deviceType, firmwareVersion, capabilities } = payload;

            // SECURITY: Ignore clusterID, deviceRole, scannerID from ESP32
            // Only admins can assign these via approval endpoint

            if (!deviceMAC || !deviceType) {
                console.warn('[DeviceRegistration] Missing required fields');
                return;
            }

            console.log(`[DeviceRegistration] Processing: ${deviceMAC} (${deviceType})`);

            // Check if device already exists
            let device = await Device.findOne({ deviceMAC });

            if (device) {
                // Device exists - only update firmware and heartbeat
                device.firmwareVersion = firmwareVersion || device.firmwareVersion;
                device.lastHeartbeat = new Date();

                // SECURITY: Do NOT update cluster info from registration events
                // Cluster assignment only happens via admin approval

                await device.save();
                console.log(`[DeviceRegistration] ✓ Updated existing device: ${deviceMAC} (Status: ${device.status})`);

                // 🔧 FIX: If device was previously approved (has clusterID), send DEVICE_APPROVED command
                // so ESP32 knows it's approved and starts sending heartbeats
                // This handles reconnections where device is marked OFFLINE
                if (device.clusterID && device.scannerID) {
                    console.log(`[DeviceRegistration] 📤 Sending approval config to already-approved device (Status: ${device.status})`);

                    const approvalCommand = {
                        action: 'DEVICE_APPROVED',
                        targetDeviceMAC: deviceMAC, // Keep for device identification
                        config: {
                            deviceMAC: deviceMAC, // Add deviceMAC to config for verification
                            clusterID: device.clusterID,
                            deviceRole: device.deviceRole,
                            scannerID: device.scannerID,
                            status: 'ACTIVE',
                            location: device.location || ''
                        },
                        timestamp: Date.now()
                    };

                    if (this.mqttBridgeService) {
                        this.mqttBridgeService.publishCommand(approvalCommand);
                    }
                }

                return device;
            }

            // New device - ALWAYS create with PENDING status
            // SECURITY: No auto-approval, even if clusterID provided
            device = new Device({
                deviceMAC,
                deviceType,
                firmwareVersion,
                capabilities: capabilities || [],
                clusterID: null,      // SECURITY: Must be null until admin approval
                deviceRole: null,     // SECURITY: Must be null until admin approval
                scannerID: null,      // SECURITY: Must be null until admin approval
                status: 'PENDING',    // SECURITY: Always PENDING for new devices
                lastHeartbeat: new Date()
            });

            await device.save();
            console.log(`[DeviceRegistration] ✓ New device registered: ${deviceMAC} - Status: PENDING (awaiting admin approval)`);

            // Emit notification for admin approval
            if (this.io) {
                this.io.emit('device-pending-approval', {
                    deviceMAC,
                    deviceType,
                    capabilities,
                    registeredAt: device.registeredAt
                });
            }

            return device;
        } catch (error) {
            console.error('[DeviceRegistration] Error:', error.message);
            return null;
        }
    }

    /**
     * Approve a pending device and assign to cluster
     * @param {String} deviceMAC
     * @param {Object} config - { clusterID, deviceRole, scannerID, location }
     * @param {String} adminUserId
     */
    async approveDevice(deviceMAC, config, adminUserId) {
        try {
            const { clusterID, deviceRole, scannerID, location } = config;

            // Update device
            const device = await Device.findOneAndUpdate(
                { deviceMAC },
                {
                    status: 'ACTIVE',
                    clusterID,
                    deviceRole,
                    scannerID,
                    location: location || '',
                    approvedBy: adminUserId
                },
                { new: true }
            );

            if (!device) {
                throw new Error('Device not found');
            }

            // Add device to cluster (create cluster if doesn't exist)
            await Cluster.findOneAndUpdate(
                { clusterID },
                {
                    $addToSet: {
                        devices: {
                            deviceMAC,
                            role: deviceRole,
                            scannerID
                        }
                    },
                    // Set door control device if this is EXIT role with relay capability
                    ...(deviceRole === 'EXIT' && device.capabilities.includes('relay') && {
                        doorControlDevice: deviceMAC
                    })
                },
                { upsert: true, new: true }
            );

            console.log(`[DeviceRegistration] ✓ Approved ${deviceMAC} → ${clusterID}`);

            // Emit approval notification
            if (this.io) {
                this.io.emit('device-approved', {
                    deviceMAC,
                    clusterID,
                    deviceRole,
                    scannerID
                });
            }

            return device;
        } catch (error) {
            console.error('[DeviceRegistration] Approval error:', error.message);
            throw error;
        }
    }

    /**
     * Reject a pending device
     * @param {String} deviceMAC
     */
    async rejectDevice(deviceMAC) {
        try {
            const result = await Device.deleteOne({ deviceMAC, status: 'PENDING' });

            if (result.deletedCount > 0) {
                console.log(`[DeviceRegistration] ✗ Rejected ${deviceMAC}`);

                if (this.io) {
                    this.io.emit('device-rejected', { deviceMAC });
                }

                return true;
            }

            return false;
        } catch (error) {
            console.error('[DeviceRegistration] Rejection error:', error.message);
            throw error;
        }
    }

    /**
     * Get all pending devices awaiting approval
     */
    async getPendingDevices() {
        try {
            return await Device.find({ status: 'PENDING' }).sort({ registeredAt: -1 });
        } catch (error) {
            console.error('[DeviceRegistration] Error getting pending devices:', error.message);
            return [];
        }
    }
}

export default new DeviceRegistrationService();
