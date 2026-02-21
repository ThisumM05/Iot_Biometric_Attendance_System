import User from '../../models/User.js';
import Device from '../../models/Device.js';
import mqttBridgeService from '../mqtt/mqttBridgeService.js';

/**
 * Template Synchronization Service
 * Manages centralized fingerprint template storage and automatic distribution to all devices
 */
class TemplateSyncService {

    constructor() {
        this.syncQueue = new Map(); // deviceMAC -> Array of pending sync operations
        this.syncInProgress = new Set(); // Track ongoing sync operations
        this.io = null; // Socket.io instance for real-time updates
    }

    /**
     * Set Socket.IO instance for real-time updates
     * @param {Object} io - Socket.IO instance
     */
    setSocketIo(io) {
        this.io = io;
    }

    /**
     * Enroll user fingerprint with centralized template storage
     * @param {String} userId - User ID
     * @param {String} deviceMAC - Device MAC address where enrollment is happening
     * @param {String} scannerID - Scanner ID
     * @returns {Object} Enrollment result
     */
    async initiateGlobalEnrollment(userId, deviceMAC, scannerID) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            const device = await Device.findOne({ deviceMAC });
            if (!device || device.status !== 'ACTIVE') {
                throw new Error('Device not found or inactive');
            }

            // Generate global fingerprint ID
            const globalFpId = await this.generateGlobalFingerprintId();

            // Update user with global ID
            user.globalFingerprintId = globalFpId;
            user.templateMetadata.enrollmentDevice = deviceMAC;
            await user.save();

            // Send enrollment command to primary device
            const command = {
                action: 'ENROLL_WITH_TEMPLATE',
                globalFingerprintId: globalFpId,
                userId: userId,
                targetDeviceMAC: deviceMAC,
                scannerID: scannerID,
                clusterID: device.clusterID,
                requestTemplate: true // Ask device to return template data
            };

            await mqttBridgeService.publishCommand(command);

            console.log(`[TemplateSync] Global enrollment started for user ${userId} (Global FP ID: ${globalFpId})`);

            return {
                success: true,
                globalFingerprintId: globalFpId,
                message: `Global enrollment initiated on ${scannerID}`,
                primaryDevice: deviceMAC
            };

        } catch (error) {
            console.error('[TemplateSync] Global enrollment error:', error);
            throw error;
        }
    }

    /**
     * Handle successful enrollment with template data from device
     * @param {Object} event - Enrollment success event with template
     */
    async handleEnrollmentWithTemplate(event) {
        try {
            const {
                userId,
                globalFingerprintId,
                templateData,
                templateMetadata
            } = event.payload;

            // deviceMAC, scannerID, clusterID are at the TOP LEVEL of the event, not inside payload
            const deviceMAC = event.deviceMAC || event.payload.deviceMAC;
            const scannerID = event.scannerID || event.payload.scannerID;
            const clusterID = event.clusterID || event.payload.clusterID;

            console.log(`[TemplateSync] Received template for Global FP ID: ${globalFingerprintId}`);
            console.log(`[TemplateSync] Device: ${deviceMAC}, Scanner: ${scannerID}, Cluster: ${clusterID}`);

            // Validate required fields before proceeding
            if (!deviceMAC || !scannerID || !clusterID) {
                console.error(`[TemplateSync] Missing required fields - deviceMAC: ${deviceMAC}, scannerID: ${scannerID}, clusterID: ${clusterID}`);
                console.error(`[TemplateSync] Event keys:`, Object.keys(event));
                console.error(`[TemplateSync] Payload keys:`, Object.keys(event.payload));
                return;
            }

            // Update user with template data
            const user = await User.findById(userId);
            if (!user) {
                console.error('[TemplateSync] User not found for template storage');
                return;
            }

            // Store template and metadata
            user.fingerprintTemplate = templateData; // Base64 encoded template
            user.templateMetadata = {
                quality: templateMetadata.quality || 0,
                templateSize: templateMetadata.size || 0,
                enrollmentDevice: deviceMAC,
                templateFormat: templateMetadata.format || 'R308',
                createdAt: new Date()
            };
            user.isEnrolled = true;

            // Clear any existing corrupt syncedDevices entries before adding new one
            // Filter out entries missing required fields, then remove duplicate for this device
            user.syncedDevices = user.syncedDevices.filter(d =>
                d.deviceMAC && d.scannerID && d.clusterID && d.deviceMAC !== deviceMAC
            );

            // Add primary device to synced devices
            user.syncedDevices.push({
                deviceMAC,
                scannerID,
                localFingerprintId: globalFingerprintId, // Use global ID as local ID on primary device
                clusterID,
                syncedAt: new Date(),
                syncStatus: 'synced'
            });

            console.log(`[TemplateSync] Saving user with ${user.syncedDevices.length} synced devices`);
            await user.save();

            console.log(`[TemplateSync] Template stored for user ${user.username} (${templateData.length} bytes)`);

            // Start automatic synchronization to all other devices
            await this.syncTemplateToAllDevices(userId, globalFingerprintId);

            return { success: true, syncedDeviceCount: user.syncedDevices.length };

        } catch (error) {
            console.error('[TemplateSync] Template storage error:', error);
        }
    }

    /**
     * Synchronize user's template to all active devices
     * @param {String} userId - User ID
     * @param {Number} globalFingerprintId - Global fingerprint ID
     */
    async syncTemplateToAllDevices(userId, globalFingerprintId) {
        try {
            const user = await User.findById(userId).select('fingerprintTemplate templateMetadata syncedDevices globalFingerprintId username');
            if (!user || !user.fingerprintTemplate) {
                throw new Error('User or template not found');
            }

            // Get all active devices except those already synced
            const activeDevices = await Device.find({
                status: 'ACTIVE',
                'capabilities': 'fingerprint'
            }).select('deviceMAC scannerID clusterID');

            const syncedDeviceMACs = user.syncedDevices.map(d => d.deviceMAC);
            const devicesToSync = activeDevices.filter(device =>
                !syncedDeviceMACs.includes(device.deviceMAC)
            );

            console.log(`[TemplateSync] Syncing to ${devicesToSync.length} devices for user ${user.username}`);

            // If no other devices to sync, emit completion immediately
            if (devicesToSync.length === 0) {
                console.log(`[TemplateSync] No other devices to sync - enrollment complete`);
                if (this.io) {
                    this.io.emit('template-sync-update', {
                        userId: userId.toString(),
                        username: user.username,
                        deviceMAC: 'none',
                        scannerID: 'none',
                        success: true,
                        current: 0,
                        total: 0,
                        percentage: 100,
                        complete: true,
                        message: 'No other devices to sync'
                    });
                }
                return { totalDevices: 0, successCount: 0, failedCount: 0 };
            }

            // Send template to each device sequentially with progress updates
            let successCount = 0;
            let failedCount = 0;

            for (let i = 0; i < devicesToSync.length; i++) {
                const device = devicesToSync[i];
                try {
                    await this.syncTemplateToDevice(user, device);
                    successCount++;

                    // Emit real-time progress update
                    if (this.io) {
                        this.io.emit('template-sync-update', {
                            userId: userId.toString(),
                            username: user.username,
                            deviceMAC: device.deviceMAC,
                            scannerID: device.scannerID,
                            success: true,
                            current: i + 1,
                            total: devicesToSync.length,
                            percentage: Math.round(((i + 1) / devicesToSync.length) * 100)
                        });
                    }
                } catch (error) {
                    failedCount++;
                    console.error(`[TemplateSync] Failed to sync to ${device.deviceMAC}:`, error.message);

                    // Emit failure update
                    if (this.io) {
                        this.io.emit('template-sync-update', {
                            userId: userId.toString(),
                            username: user.username,
                            deviceMAC: device.deviceMAC,
                            scannerID: device.scannerID,
                            success: false,
                            error: error.message,
                            current: i + 1,
                            total: devicesToSync.length,
                            percentage: Math.round(((i + 1) / devicesToSync.length) * 100)
                        });
                    }
                }
            }

            console.log(`[TemplateSync] Sync completed: ${successCount} success, ${failedCount} failed`);

            return {
                totalDevices: devicesToSync.length,
                successCount,
                failedCount
            };

        } catch (error) {
            console.error('[TemplateSync] Sync to all devices error:', error);
            throw error;
        }
    }

    /**
     * Sync template to a specific device
     * @param {Object} user - User object with template data
     * @param {Object} device - Target device
     */
    async syncTemplateToDevice(user, device) {
        try {
            const { deviceMAC, scannerID, clusterID } = device;

            // Generate unique local fingerprint ID for this device
            const localFpId = await this.generateLocalFingerprintId(deviceMAC);

            // Send template installation command
            const command = {
                action: 'INSTALL_TEMPLATE',
                globalFingerprintId: user.globalFingerprintId,
                localFingerprintId: localFpId,
                userId: user._id,
                templateData: user.fingerprintTemplate,
                templateMetadata: user.templateMetadata,
                targetDeviceMAC: deviceMAC,
                scannerID: scannerID,
                clusterID: clusterID
            };

            await mqttBridgeService.publishCommand(command);

            // Add pending sync record
            await User.findByIdAndUpdate(user._id, {
                $push: {
                    syncedDevices: {
                        deviceMAC,
                        scannerID,
                        localFingerprintId: localFpId,
                        clusterID,
                        syncedAt: new Date(),
                        syncStatus: 'pending'
                    }
                }
            });

            console.log(`[TemplateSync] Template sent to ${scannerID} (Local ID: ${localFpId})`);

            return { success: true, deviceMAC, localFpId };

        } catch (error) {
            console.error(`[TemplateSync] Failed to sync to device ${device.deviceMAC}:`, error);
            throw error;
        }
    }

    /**
     * Handle template installation confirmation from device
     * @param {Object} event - Template installation result
     */
    async handleTemplateInstallResult(event) {
        try {
            // Extract deviceMAC from top level (ESP32 sends it there)
            const deviceMAC = event.deviceMAC || event.payload?.deviceMAC;
            const scannerID = event.scannerID || event.payload?.scannerID;

            // Extract other fields from payload
            const {
                userId,
                globalFingerprintId,
                localFingerprintId,
                success,
                error: installError
            } = event.payload;

            const syncStatus = success ? 'synced' : 'failed';

            console.log(`[TemplateSync] 📥 Template install result received:`);
            console.log(`   Device MAC: ${deviceMAC}`);
            console.log(`   Scanner ID: ${scannerID}`);
            console.log(`   User ID: ${userId}`);
            console.log(`   Global FP ID: ${globalFingerprintId}`);
            console.log(`   Local FP ID: ${localFingerprintId}`);
            console.log(`   Success: ${success}`);

            // Get device details for logging - with debug info
            console.log(`[TemplateSync] 🔍 Looking up device: ${deviceMAC}`);
            const device = await Device.findOne({ deviceMAC }).select('deviceName scannerID clusterID');
            if (device) {
                console.log(`[TemplateSync] ✓ Found device: ${device.scannerID || device.deviceName}`);
            } else {
                console.log(`[TemplateSync] ⚠️  Device not found in database for MAC: ${deviceMAC}`);
                // Try to find with case-insensitive search
                const allDevices = await Device.find({}).select('deviceMAC scannerID').limit(10);
                console.log(`[TemplateSync] 📋 Available devices:`, allDevices.map(d => ({ mac: d.deviceMAC, scanner: d.scannerID })));
            }
            const deviceName = device?.deviceName || device?.scannerID || deviceMAC;

            // Update sync status in user record - use upsert to handle if device doesn't exist in array
            const updateResult = await User.updateOne(
                {
                    _id: userId,
                    'syncedDevices.deviceMAC': deviceMAC
                },
                {
                    $set: {
                        'syncedDevices.$.syncStatus': syncStatus,
                        'syncedDevices.$.syncedAt': new Date() // Update syncedAt at device level
                    }
                }
            );

            // If no device was matched (device not in array at all), add it
            // Only check matchedCount — modifiedCount can be 0 if value is the same
            if (updateResult.matchedCount === 0) {
                // Device not in array — add it atomically
                await User.updateOne(
                    { _id: userId },
                    {
                        $push: {
                            syncedDevices: {
                                deviceMAC,
                                scannerID: device?.scannerID || scannerID,
                                localFingerprintId: localFingerprintId,
                                clusterID: device?.clusterID,
                                syncStatus,
                                syncedAt: new Date()
                            }
                        }
                    }
                );
                console.log(`[TemplateSync] ℹ️  Added ${deviceMAC} to user's syncedDevices array`);
            }

            if (success) {
                console.log(`[TemplateSync] ✓ Template installed on ${deviceName} (Local ID: ${localFingerprintId})`);
            } else {
                console.error(`[TemplateSync] ✗ Template installation failed on ${deviceName}: ${installError}`);
            }

            // Emit real-time update to dashboard
            if (this.io) {
                // Fetch username to include in the notification
                const userForNotification = await User.findById(userId).select('username');
                const username = userForNotification ? userForNotification.username : 'Unknown';

                this.io.emit('template-sync-update', {
                    userId,
                    username,
                    deviceMAC,
                    scannerID: device?.scannerID,
                    success: success,
                    status: syncStatus,
                    localFingerprintId
                });
            }

        } catch (error) {
            console.error('[TemplateSync] Template install result handling error:', error);
        }
    }

    /**
     * Get sync status for a user across all devices
     * @param {String} userId - User ID
     */
    async getUserSyncStatus(userId) {
        try {
            const user = await User.findById(userId).select('username globalFingerprintId syncedDevices isEnrolled');
            if (!user) return null;

            const syncStats = {
                username: user.username,
                globalFingerprintId: user.globalFingerprintId,
                isEnrolled: user.isEnrolled,
                totalDevices: user.syncedDevices.length,
                syncedCount: user.syncedDevices.filter(d => d.syncStatus === 'synced').length,
                pendingCount: user.syncedDevices.filter(d => d.syncStatus === 'pending').length,
                failedCount: user.syncedDevices.filter(d => d.syncStatus === 'failed').length,
                devices: user.syncedDevices.map(d => ({
                    scannerID: d.scannerID,
                    clusterID: d.clusterID,
                    localFingerprintId: d.localFingerprintId,
                    syncStatus: d.syncStatus,
                    syncedAt: d.syncedAt
                }))
            };

            return syncStats;

        } catch (error) {
            console.error('[TemplateSync] Get sync status error:', error);
            return null;
        }
    }

    /**
     * Retry failed synchronizations for a user
     * @param {String} userId - User ID
     */
    async retrySyncForUser(userId) {
        try {
            const user = await User.findById(userId);
            if (!user || !user.fingerprintTemplate) {
                throw new Error('User or template not found');
            }

            // Remove failed sync records
            user.syncedDevices = user.syncedDevices.filter(d => d.syncStatus !== 'failed');
            await user.save();

            // Retry sync to all devices
            return await this.syncTemplateToAllDevices(userId, user.globalFingerprintId);

        } catch (error) {
            console.error('[TemplateSync] Retry sync error:', error);
            throw error;
        }
    }

    /**
     * Generate unique global fingerprint ID
     * @returns {Number} Global fingerprint ID
     */
    async generateGlobalFingerprintId() {
        const lastUser = await User.findOne({ globalFingerprintId: { $ne: null } })
            .sort({ globalFingerprintId: -1 })
            .select('globalFingerprintId');

        return lastUser ? lastUser.globalFingerprintId + 1 : 1;
    }

    /**
     * Generate unique local fingerprint ID for a specific device
     * @param {String} deviceMAC - Device MAC address
     * @returns {Number} Local fingerprint ID for the device
     */
    async generateLocalFingerprintId(deviceMAC) {
        // Find highest local ID used on this device
        const users = await User.find({
            'syncedDevices.deviceMAC': deviceMAC
        }).select('syncedDevices');

        let maxLocalId = 0;
        users.forEach(user => {
            user.syncedDevices.forEach(sync => {
                if (sync.deviceMAC === deviceMAC && sync.localFingerprintId > maxLocalId) {
                    maxLocalId = sync.localFingerprintId;
                }
            });
        });

        return maxLocalId + 1;
    }

    /**
     * Remove user template from all devices
     * @param {String} userId - User ID
     */
    async removeUserFromAllDevices(userId) {
        try {
            const user = await User.findById(userId);
            if (!user) return;

            // Send delete commands to all synced devices
            const deletePromises = user.syncedDevices.map(sync => {
                const command = {
                    action: 'DELETE_TEMPLATE',
                    globalFingerprintId: user.globalFingerprintId,
                    localFingerprintId: sync.localFingerprintId,
                    targetDeviceMAC: sync.deviceMAC,
                    userId: userId
                };
                return mqttBridgeService.publishCommand(command);
            });

            await Promise.allSettled(deletePromises);

            // Clear user enrollment data
            user.globalFingerprintId = null;
            user.fingerprintTemplate = null;
            user.templateMetadata = {};
            user.syncedDevices = [];
            user.isEnrolled = false;

            await user.save();

            console.log(`[TemplateSync] User ${user.username} removed from all devices`);

        } catch (error) {
            console.error('[TemplateSync] Remove user error:', error);
            throw error;
        }
    }

    /**
     * Sync new device with all existing user templates
     * @param {String} deviceMAC - New device MAC address
     */
    async syncNewDeviceWithAllUsers(deviceMAC) {
        try {
            const device = await Device.findOne({ deviceMAC });
            if (!device) {
                throw new Error('Device not found');
            }

            // Get all enrolled users
            const enrolledUsers = await User.find({
                isEnrolled: true,
                fingerprintTemplate: { $ne: null }
            }).select('_id username globalFingerprintId fingerprintTemplate templateMetadata syncedDevices');

            console.log(`[TemplateSync] Syncing ${enrolledUsers.length} users to new device ${device.scannerID}`);

            // Sync each user to the new device
            const syncPromises = enrolledUsers.map(user =>
                this.syncTemplateToDevice(user, device)
            );

            const results = await Promise.allSettled(syncPromises);
            const successCount = results.filter(r => r.status === 'fulfilled').length;

            console.log(`[TemplateSync] New device sync completed: ${successCount}/${enrolledUsers.length} users synced`);

            return { syncedUsers: successCount, totalUsers: enrolledUsers.length };

        } catch (error) {
            console.error('[TemplateSync] New device sync error:', error);
            throw error;
        }
    }

    /**
     * Clear all fingerprint templates from a specific device
     * @param {String} deviceMAC - Device MAC address
     * @returns {Object} Clear operation result
     */
    async clearDeviceTemplates(deviceMAC) {
        try {
            const device = await Device.findOne({ deviceMAC });
            if (!device) {
                throw new Error('Device not found');
            }

            // Send clear command to device
            const command = {
                action: 'CLEAR_ALL_TEMPLATES',
                targetDeviceMAC: deviceMAC,
                scannerID: device.scannerID,
                clusterID: device.clusterID
            };

            await mqttBridgeService.publishCommand(command);

            console.log(`[TemplateSync] Clear all templates command sent to ${device.scannerID}`);

            return {
                success: true,
                message: `Clear command sent to ${device.scannerID}`,
                deviceMAC,
                scannerID: device.scannerID
            };

        } catch (error) {
            console.error('[TemplateSync] Clear device templates error:', error);
            throw error;
        }
    }

    /**
     * Handle clear device templates result from device
     * @param {Object} event - Clear templates result event
     */
    async handleClearDeviceResult(event) {
        try {
            const { deviceMAC, success, clearedCount } = event.payload;

            if (success) {
                // Remove device from all users' syncedDevices arrays
                await User.updateMany(
                    { 'syncedDevices.deviceMAC': deviceMAC },
                    {
                        $pull: {
                            syncedDevices: { deviceMAC: deviceMAC }
                        }
                    }
                );

                console.log(`[TemplateSync] ✓ Device ${deviceMAC} cleared ${clearedCount} templates`);
                console.log(`[TemplateSync] ✓ Removed device from user sync records`);

                return { success: true, clearedCount };
            } else {
                console.error(`[TemplateSync] ✗ Failed to clear templates from ${deviceMAC}`);
                return { success: false };
            }

        } catch (error) {
            console.error('[TemplateSync] Clear device result error:', error);
            throw error;
        }
    }

    /**
     * Sync all existing user templates to all active devices
     * This is useful when adding new devices or recovering from sync issues
     * @returns {Object} Sync results summary
     */
    async syncAllTemplatesToAllDevices() {
        try {
            console.log('[TemplateSync] 🔄 Starting global template sync to all devices...');

            // Get all enrolled users with fingerprint templates
            const enrolledUsers = await User.find({
                isEnrolled: true,
                fingerprintTemplate: { $exists: true, $ne: null }
            });

            // Get all active devices with fingerprint capability
            const activeDevices = await Device.find({
                status: 'ACTIVE',
                capabilities: 'fingerprint'
            }).select('deviceMAC scannerID clusterID deviceRole');

            console.log(`[TemplateSync] Found ${enrolledUsers.length} enrolled users and ${activeDevices.length} active devices`);
            console.log('[TemplateSync] Active devices:', activeDevices.map(d => `${d.deviceMAC} (${d.scannerID || 'no-scanner'}, ${d.deviceRole || 'no-role'})`).join(', '));

            if (enrolledUsers.length === 0) {
                return {
                    success: true,
                    message: 'No enrolled users found',
                    totalUsers: 0,
                    totalDevices: activeDevices.length,
                    syncOperations: 0
                };
            }

            if (activeDevices.length === 0) {
                return {
                    success: true,
                    message: 'No active devices found',
                    totalUsers: enrolledUsers.length,
                    totalDevices: 0,
                    syncOperations: 0
                };
            }

            let totalSyncOperations = 0;
            let successCount = 0;
            let failureCount = 0;

            // Sync each user to all devices
            for (const user of enrolledUsers) {
                console.log(`[TemplateSync] Syncing user ${user.username} to all devices...`);

                try {
                    // DON'T clear sync records - we need to reuse existing slot assignments!
                    // user.syncedDevices = []; // REMOVED - this causes duplicates

                    for (const device of activeDevices) {
                        try {
                            // Check if this device already has a sync record for this user
                            let existingSync = user.syncedDevices.find(
                                sync => sync.deviceMAC === device.deviceMAC
                            );

                            let localFpId;
                            if (existingSync) {
                                // Reuse existing local fingerprint ID
                                localFpId = existingSync.localFingerprintId;
                                console.log(`[TemplateSync] Reusing existing slot ${localFpId} for ${user.username} on ${device.scannerID}`);
                            } else {
                                // Generate new local fingerprint ID for this device
                                localFpId = await this.generateLocalFingerprintId(device.deviceMAC);
                                console.log(`[TemplateSync] Assigning new slot ${localFpId} for ${user.username} on ${device.scannerID}`);
                            }

                            // Set status to pending BEFORE publishing the MQTT command
                            // This ensures the device response (synced/failed) always overwrites pending,
                            // never the other way around
                            if (existingSync) {
                                await User.updateOne(
                                    { _id: user._id, 'syncedDevices.deviceMAC': device.deviceMAC },
                                    {
                                        $set: {
                                            'syncedDevices.$.syncedAt': new Date(),
                                            'syncedDevices.$.syncStatus': 'pending'
                                        }
                                    }
                                );
                            } else {
                                await User.updateOne(
                                    { _id: user._id },
                                    {
                                        $push: {
                                            syncedDevices: {
                                                deviceMAC: device.deviceMAC,
                                                scannerID: device.scannerID,
                                                localFingerprintId: localFpId,
                                                clusterID: device.clusterID,
                                                syncedAt: new Date(),
                                                syncStatus: 'pending'
                                            }
                                        }
                                    }
                                );
                            }

                            // NOW send the command — device response will update pending→synced/failed
                            const command = {
                                action: 'INSTALL_TEMPLATE',
                                globalFingerprintId: user.globalFingerprintId,
                                localFingerprintId: localFpId,
                                userId: user._id,
                                templateData: user.fingerprintTemplate,
                                templateMetadata: user.templateMetadata,
                                targetDeviceMAC: device.deviceMAC,
                                scannerID: device.scannerID,
                                clusterID: device.clusterID
                            };

                            await mqttBridgeService.publishCommand(command);

                            console.log(`[TemplateSync] ✓ Sent template for ${user.username} to ${device.scannerID} (MAC: ${device.deviceMAC}, Slot: ${localFpId})`);

                            totalSyncOperations++;
                            successCount++;

                            // Small delay to prevent overwhelming devices
                            await new Promise(resolve => setTimeout(resolve, 500));

                        } catch (deviceError) {
                            failureCount++;
                            console.error(`[TemplateSync] ✗ Failed to sync ${user.username} to ${device.deviceMAC}:`, deviceError);
                        }
                    }

                    // We removed await user.save() because we updated atomically above

                } catch (userError) {
                    console.error(`[TemplateSync] ✗ Failed to sync user ${user.username}:`, userError);
                }
            }

            const result = {
                success: true,
                totalUsers: enrolledUsers.length,
                totalDevices: activeDevices.length,
                syncOperations: totalSyncOperations,
                successCount,
                failureCount,
                message: `Global sync completed: ${successCount} operations succeeded, ${failureCount} failed`
            };

            console.log(`[TemplateSync] ✅ Global sync completed:`, result);

            // Emit real-time update to dashboard
            if (this.io) {
                this.io.emit('global-sync-update', result);
            }

            return result;

        } catch (error) {
            console.error('[TemplateSync] Global sync error:', error);
            throw error;
        }
    }
}

export default new TemplateSyncService();