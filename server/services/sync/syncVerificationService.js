import User from '../../models/User.js';
import Device from '../../models/Device.js';
import cron from 'node-cron';
import mqttBridgeService from '../mqtt/mqttBridgeService.js';

/**
 * Fingerprint Sync Verification Service
 * Monitors and verifies fingerprint template synchronization across all devices
 */
class SyncVerificationService {
    constructor() {
        this.io = null;
        this.isRunning = false;
        this.syncStatus = new Map(); // deviceMAC -> sync status
        this.lastVerificationRun = null;
    }

    /**
     * Initialize the sync verification service with cron job
     */
    initialize(io) {
        this.io = io;

        // Run sync verification every 5 minutes
        cron.schedule('*/5 * * * *', async () => {
            console.log('[SyncVerification] 🔄 Starting scheduled sync verification...');
            await this.verifyGlobalSync();
        });

        // Initial check on startup (after 30 seconds)
        setTimeout(async () => {
            console.log('[SyncVerification] 🚀 Running initial sync verification...');
            await this.verifyGlobalSync();
        }, 30000);

        console.log('[SyncVerification] ✅ Sync verification cron job initialized');
    }

    /**
     * Main sync verification process
     * Checks all enrolled users and their fingerprint sync status across devices
     */
    async verifyGlobalSync() {
        if (this.isRunning) {
            console.log('[SyncVerification] ⏭️  Skipping verification - already running');
            return;
        }

        try {
            this.isRunning = true;
            this.lastVerificationRun = new Date();

            console.log('[SyncVerification] 📊 Starting global fingerprint sync verification...');

            // Get all enrolled users
            const enrolledUsers = await User.find({
                isEnrolled: true,
                globalFingerprintId: { $exists: true, $ne: null }
            });

            // Get all active devices with fingerprint capability
            const activeDevices = await Device.find({
                status: 'ACTIVE',
                capabilities: 'fingerprint'
            }).select('deviceMAC scannerID clusterID healthMetrics').lean(); // Use .lean() for fresh data

            console.log(`[SyncVerification] Found ${enrolledUsers.length} enrolled users and ${activeDevices.length} fingerprint devices`);

            if (enrolledUsers.length === 0 || activeDevices.length === 0) {
                console.log('[SyncVerification] ✅ No verification needed - no enrolled users or fingerprint devices');
                return;
            }

            const expectedTemplateCount = enrolledUsers.length;
            const syncIssues = [];
            const deviceSyncStatus = [];

            // Check each device's fingerprint count vs expected count
            for (const device of activeDevices) {
                const deviceStatus = await this.verifyDeviceSync(device, expectedTemplateCount);
                deviceSyncStatus.push(deviceStatus);

                if (!deviceStatus.inSync) {
                    syncIssues.push(deviceStatus);
                }
            }

            // Store sync status
            this.syncStatus.clear();
            deviceSyncStatus.forEach(status => {
                this.syncStatus.set(status.deviceMAC, status);
            });

            // Report results
            if (syncIssues.length === 0) {
                console.log('[SyncVerification] ✅ All devices are in sync!');
            } else {
                console.log(`[SyncVerification] ⚠️  Found sync issues on ${syncIssues.length} device(s):`);
                syncIssues.forEach(issue => {
                    console.log(`  - ${issue.deviceMAC}: Expected ${issue.expectedCount}, Found ${issue.actualCount}`);
                });

                // Emit real-time sync status to dashboard
                if (this.io) {
                    this.io.emit('sync-verification-result', {
                        timestamp: new Date(),
                        syncIssues: syncIssues,
                        totalDevices: activeDevices.length,
                        devicesInSync: activeDevices.length - syncIssues.length,
                        expectedTemplateCount,
                        syncHealthPercent: activeDevices.length > 0 ? Math.round(((activeDevices.length - syncIssues.length) / activeDevices.length) * 100) : 100
                    });
                }

                // Attempt to fix sync issues
                await this.fixSyncIssues(syncIssues, enrolledUsers);
            }

        } catch (error) {
            console.error('[SyncVerification] ❌ Error during sync verification:', error);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Verify sync status for a single device
     */
    async verifyDeviceSync(device, expectedCount) {
        const actualCount = device.healthMetrics?.fingerprintCount ?? 0;

        const status = {
            deviceMAC: device.deviceMAC,
            scannerID: device.scannerID,
            clusterID: device.clusterID,
            expectedCount,
            actualCount,
            inSync: actualCount === expectedCount,
            lastChecked: new Date(),
            syncDifference: expectedCount - actualCount
        };

        console.log(`[SyncVerification] ${device.deviceMAC}: ${actualCount}/${expectedCount} templates ${status.inSync ? '✅' : '❌'}`);

        return status;
    }

    /**
     * Attempt to fix sync issues by triggering re-sync
     */
    async fixSyncIssues(syncIssues, enrolledUsers) {
        console.log('[SyncVerification] 🔧 Attempting to fix sync issues...');

        for (const issue of syncIssues) {
            try {
                if (issue.syncDifference > 0) {
                    // Device is missing templates - send missing ones
                    console.log(`[SyncVerification] Re-syncing ${issue.syncDifference} missing templates to ${issue.deviceMAC}`);
                    await this.resyncMissingTemplates(issue, enrolledUsers);
                } else if (issue.syncDifference < 0) {
                    // Device has extra templates - log for manual investigation
                    console.log(`[SyncVerification] ⚠️  Device ${issue.deviceMAC} has ${Math.abs(issue.syncDifference)} extra templates - manual cleanup recommended`);
                }
            } catch (error) {
                console.error(`[SyncVerification] Failed to fix sync for ${issue.deviceMAC}:`, error);
            }
        }
    }

    /**
     * Re-sync missing templates to a device
     */
    async resyncMissingTemplates(deviceIssue, enrolledUsers) {
        // Find which templates are missing on this device
        const deviceUser = await User.find({
            'syncedDevices.deviceMAC': deviceIssue.deviceMAC
        });

        const syncedUserIds = new Set(deviceUser.map(user => user._id.toString()));

        // Find users not synced to this device
        const missingUsers = enrolledUsers.filter(user =>
            !syncedUserIds.has(user._id.toString()) && user.fingerprintTemplate
        );

        console.log(`[SyncVerification] Found ${missingUsers.length} users missing from ${deviceIssue.deviceMAC}`);

        // Send install commands for missing templates
        for (const user of missingUsers.slice(0, 5)) { // Limit to 5 at a time to prevent overload
            try {
                const installCommand = {
                    action: 'INSTALL_TEMPLATE',
                    targetDeviceMAC: deviceIssue.deviceMAC,
                    userId: user._id.toString(),
                    globalFingerprintId: user.globalFingerprintId,
                    templateData: user.fingerprintTemplate,
                    clusterID: deviceIssue.clusterID,
                    scannerID: deviceIssue.scannerID,
                    reason: 'sync_verification'
                };

                await mqttBridgeService.publishCommand(installCommand);

                console.log(`[SyncVerification] Sent install command for user ${user.username} to ${deviceIssue.deviceMAC}`);

                // Small delay between commands to avoid overwhelming the device
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                console.error(`[SyncVerification] Failed to send install command for user ${user.username}:`, error);
            }
        }
    }

    /**
     * Get current sync status for dashboard
     */
    getSyncStatus() {
        return {
            lastVerificationRun: this.lastVerificationRun,
            isRunning: this.isRunning,
            deviceSyncStatus: Array.from(this.syncStatus.values()),
            totalDevices: this.syncStatus.size,
            devicesInSync: Array.from(this.syncStatus.values()).filter(status => status.inSync).length,
            devicesOutOfSync: Array.from(this.syncStatus.values()).filter(status => !status.inSync).length
        };
    }

    /**
     * Manually trigger sync verification
     */
    async triggerManualVerification() {
        console.log('[SyncVerification] 🔄 Manual sync verification triggered');
        await this.verifyGlobalSync();
        return this.getSyncStatus();
    }
}

export default new SyncVerificationService();