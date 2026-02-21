import User from '../../models/User.js';
import Attendance from '../../models/Attendance.js';
import Cluster from '../../models/Cluster.js';
import Device from '../../models/Device.js';
import whatsappService from '../notification/whatsappService.js';
import rabbitMQService from '../rabbitmq/rabbitMQService.js';
import tailgatingDetection from '../accessControl/tailgatingDetection.js';

class RecognitionService {
    constructor() {
        this.io = null; // Socket.io instance for real-time updates
    }

    setSocketIo(io) {
        this.io = io;
    }

    /**
     * Process attendance event from device (cluster-aware)
     * @param {Object} event - { type: 'ATTENDANCE', payload: {...}, deviceMAC, clusterID, scannerID, deviceRole }
     */
    async processAttendance(event) {
        try {
            console.log('[Recognition] Processing Event:', JSON.stringify(event));

            const { payload, deviceMAC, clusterID, scannerID, deviceRole } = event;
            const { fingerprintId, direction, multiPersonDetected } = payload;

            // SECURITY: Block attendance from non-approved devices
            if (deviceMAC) {
                const device = await Device.findOne({ deviceMAC });
                if (!device) {
                    console.warn(`[Recognition] ⛔ Unknown device: ${deviceMAC}`);
                    return;
                }
                if (device.status !== 'ACTIVE') {
                    console.warn(`[Recognition] ⛔ Device not active: ${deviceMAC} (Status: ${device.status})`);
                    return;
                }
            }

            if (!fingerprintId) {
                console.warn('[Recognition] Missing fingerprintId in payload');
                return;
            }

            // Handle security alert first
            if (multiPersonDetected) {
                console.warn('⚠️  Security Alert: Multiple persons detected');
                await this.handleSecurityAlert(event);
                return; // Block further processing - don't allow entry
            }

            // Find user by fingerprint ID with enhanced lookup for global sync system
            // Priority: Global ID -> Local syncedDevices -> Legacy enrollments -> Legacy fingerprintId
            let user = null;

            // Method 1: Global fingerprint ID lookup (new global sync system)
            user = await User.findOne({
                'syncedDevices': {
                    $elemMatch: {
                        localFingerprintId: fingerprintId,
                        deviceMAC: deviceMAC,
                        syncStatus: 'synced'
                    }
                }
            });

            // Method 2: Global fingerprint ID direct match
            if (!user) {
                user = await User.findOne({
                    globalFingerprintId: fingerprintId,
                    isEnrolled: true
                });
            }

            // Method 3: Legacy multi-scanner enrollment format
            if (!user) {
                user = await User.findOne({
                    'enrollments': {
                        $elemMatch: {
                            fingerprintId: fingerprintId,
                            $or: [
                                { deviceMAC: deviceMAC },
                                { scannerID: scannerID }
                            ]
                        }
                    }
                });
            }

            // Method 4: Legacy single fingerprint ID (for backward compatibility)
            if (!user) {
                user = await User.findOne({
                    fingerprintId: fingerprintId,
                    isEnrolled: true
                });
            }

            if (!user) {
                console.warn(`[Recognition] Unknown fingerprint ${fingerprintId} on ${scannerID} (${deviceMAC})`);
                console.log(`[Recognition] Lookup attempted: Global sync, Direct global ID, Legacy enrollments, Legacy single ID`);
                return;
            }

            // Enhanced access validation for global sync system
            const hasAccess = await this.checkUserAccess(user, clusterID, scannerID, deviceMAC, fingerprintId);
            if (!hasAccess) {
                console.warn(`[Recognition] Access denied for ${user.username} on ${scannerID}`);
                return;
            }

            console.log(`[Recognition] ✓ Identified: ${user.username} - Direction: ${direction}`);

            // 🔐 Start Tailgating Detection Session
            // This creates a 10-second window to monitor camera and IR sensor for unauthorized entries
            const scanTimestamp = Date.now();
            const sessionId = tailgatingDetection.addFingerprintScan(
                deviceMAC,
                user._id.toString(),
                scanTimestamp
            );
            console.log(`[Tailgating] Session: ${sessionId} | User: ${user.username}`);

            // Load system settings
            const SystemSettings = (await import('../../models/SystemSettings.js')).default;
            const settingsList = await SystemSettings.find({});
            const settings = {
                shiftStart: "08:00",
                classEnd: "10:30",
                lateThreshold: 15
            };

            settingsList.forEach(s => {
                if (s.key === 'SHIFT_START_TIME') settings.shiftStart = s.value;
                if (s.key === 'CLASS_END_TIME') settings.classEnd = s.value;
                if (s.key === 'LATE_THRESHOLD') settings.lateThreshold = s.value;
            });

            // Save raw attendance log
            const rawLog = new Attendance({
                user: user._id,
                fingerprintId: fingerprintId,
                deviceId: deviceMAC || scannerID || 'UNKNOWN',
                type: direction === 'IN' ? 'CHECK_IN' : 'CHECK_OUT',
                timestamp: new Date()
            });
            await rawLog.save();

            // Process daily attendance session
            const DailyAttendance = (await import('../../models/DailyAttendance.js')).default;
            const todayStr = new Date().toISOString().split('T')[0];

            let session = await DailyAttendance.findOne({
                user: user._id,
                date: todayStr
            });

            const now = new Date();

            if (!session) {
                // First scan of the day (Clock In)
                console.log(`[Attendance] New Session for ${user.username}`);

                const [startHour, startMin] = settings.shiftStart.split(':').map(Number);
                const shiftStartTime = new Date(now);
                shiftStartTime.setHours(startHour, startMin, 0, 0);

                const lateLimit = new Date(shiftStartTime.getTime() + settings.lateThreshold * 60000);

                let status = 'PRESENT';
                if (now > lateLimit) {
                    status = 'LATE';
                }

                session = new DailyAttendance({
                    user: user._id,
                    date: todayStr,
                    clockIn: now,
                    clockOut: now,
                    status: status,
                    events: [rawLog._id]
                });
            } else {
                // Subsequent scan (Clock Out)
                const lastEventId = session.events[session.events.length - 1];
                const lastLog = await Attendance.findById(lastEventId);

                // Debounce duplicate scans within 60 seconds
                if (lastLog && (now - lastLog.timestamp) < 60000) {
                    console.log(`[Attendance] Debounced rapid scan for ${user.username}`);
                    return;
                }

                console.log(`[Attendance] Updating Session (Clock Out) for ${user.username}`);
                session.clockOut = now;
                session.events.push(rawLog._id);

                const diffMs = session.clockOut - session.clockIn;
                session.duration = Math.floor(diffMs / 60000);

                // Check for early departure
                if (session.status === 'PRESENT' || session.status === 'LEFT_EARLY') {
                    const [endHour, endMin] = settings.classEnd.split(':').map(Number);
                    const classEndTime = new Date(now);
                    classEndTime.setHours(endHour, endMin, 0, 0);

                    if (session.clockOut < classEndTime) {
                        session.status = 'LEFT_EARLY';
                    } else {
                        session.status = 'PRESENT';
                    }
                }
            }

            await session.save();
            console.log(`[Attendance] ✓ Saved for ${user.username} - Status: ${session.status}`);

            // Check access permissions and decide door unlock
            const shouldUnlock = await this.checkAccessRules(user, clusterID, direction);

            if (shouldUnlock && clusterID) {
                await this.unlockDoor(clusterID, user._id, fingerprintId);
            }

            // Real-time dashboard update
            if (this.io) {
                this.io.emit('attendance-update', {
                    userId: user._id,
                    username: user.username,
                    direction: direction,
                    clusterID: clusterID,
                    scannerID: scannerID,
                    timestamp: now,
                    status: session.status
                });
            }

            // Send WhatsApp notification (only on first check-in)
            if (user.parentWhatsapp && session.clockIn.getTime() === now.getTime()) {
                console.log(`[WhatsApp] Sending notification for ${user.username}`);

                whatsappService.sendCheckInNotification(
                    user.username,
                    user.parentWhatsapp,
                    session.clockIn
                ).catch(err => console.error('WhatsApp error:', err));

                if (session.status === 'LATE') {
                    const [startHour, startMin] = settings.shiftStart.split(':').map(Number);
                    const shiftStartTime = new Date(now);
                    shiftStartTime.setHours(startHour, startMin, 0, 0);
                    const minutesLate = Math.floor((now - shiftStartTime) / 60000);

                    whatsappService.sendLateArrivalNotification(
                        user.username,
                        user.parentWhatsapp,
                        session.clockIn,
                        minutesLate
                    ).catch(err => console.error('WhatsApp late notification error:', err));
                }
            }

        } catch (error) {
            console.error('[Recognition] Error:', error);
        }
    }

    /**
     * Check if user has access permission
     * @param {Object} user
     * @param {String} clusterID
     * @param {String} direction
     * @returns {Boolean}
     */
    async checkAccessRules(user, clusterID, direction) {
        try {
            // Basic access rule: allow all enrolled users
            // TODO: Add more sophisticated rules:
            // - Time-based access
            // - Role-based permissions
            // - Blacklist checking
            // - Anti-passback (prevent re-entry without exit)

            if (!user.isEnrolled) {
                console.log(`[Access] Denied: User ${user.username} not enrolled`);
                return false;
            }

            // Check if user has enrollment for this cluster
            const hasEnrollment = user.enrollments?.some(e => e.clusterID === clusterID);
            if (hasEnrollment || user.enrollments?.length > 0) {
                console.log(`[Access] ✓ Granted: ${user.username}`);
                return true;
            }

            // For backward compatibility, allow legacy fingerprintId
            if (user.fingerprintId) {
                console.log(`[Access] ✓ Granted (legacy): ${user.username}`);
                return true;
            }

            console.log(`[Access] Denied: No enrollment for cluster ${clusterID}`);
            return false;

        } catch (error) {
            console.error('[Access] Error checking rules:', error);
            return false;
        }
    }

    /**
     * Send unlock door command to cluster's door control device
     * @param {String} clusterID
     * @param {String} userId
     * @param {Number} fingerprintId
     */
    async unlockDoor(clusterID, userId, fingerprintId) {
        try {
            // Find cluster and get door control device
            const cluster = await Cluster.findOne({ clusterID });
            if (!cluster || !cluster.doorControlDevice) {
                console.warn(`[DoorControl] No door control device for cluster: ${clusterID}`);
                return;
            }

            console.log(`[DoorControl] 🔓 Unlocking door for cluster: ${clusterID}`);

            // Send UNLOCK_DOOR command via RabbitMQ
            const command = {
                action: 'UNLOCK_DOOR',
                targetDeviceMAC: cluster.doorControlDevice,
                clusterID: clusterID,
                duration: cluster.unlockDuration || 5000,
                reason: `Valid scan - User ${userId} - FP ${fingerprintId}`,
                timestamp: Date.now()
            };

            await rabbitMQService.publishCommand(command);

            // Emit real-time notification
            if (this.io) {
                this.io.emit('door-unlocked', {
                    clusterID,
                    userId,
                    timestamp: new Date()
                });
            }

            console.log(`[DoorControl] ✓ Command sent to ${cluster.doorControlDevice}`);

        } catch (error) {
            console.error('[DoorControl] Error:', error);
        }
    }

    /**     * Enhanced access validation for global sync system
     * @param {Object} user - User object
     * @param {String} clusterID - Cluster ID
     * @param {String} scannerID - Scanner ID
     * @param {String} deviceMAC - Device MAC address
     * @param {Number} fingerprintId - Local fingerprint ID used for recognition
     * @returns {Boolean} Whether user has access
     */
    async checkUserAccess(user, clusterID, scannerID, deviceMAC, fingerprintId) {
        try {
            // Check if user has global enrollment (new system)
            if (user.globalFingerprintId && user.isEnrolled) {
                // For globally enrolled users, check if they're synced to this device
                const deviceSync = user.syncedDevices?.find(sync =>
                    sync.deviceMAC === deviceMAC &&
                    sync.syncStatus === 'synced' &&
                    sync.localFingerprintId === fingerprintId
                );

                if (deviceSync) {
                    console.log(`[Access] ✓ Global enrollment: ${user.username} → ${scannerID} (Global ID: ${user.globalFingerprintId}, Local ID: ${fingerprintId})`);
                    return true;
                }

                // Check if user has global ID but maybe legacy recognition
                if (user.globalFingerprintId === fingerprintId) {
                    console.log(`[Access] ✓ Global ID match: ${user.username} (Global ID: ${fingerprintId})`);
                    return true;
                }
            }

            // Check legacy multi-scanner enrollment
            const specificEnrollment = user.enrollments?.find(enrollment =>
                enrollment.fingerprintId === fingerprintId &&
                (enrollment.deviceMAC === deviceMAC || enrollment.scannerID === scannerID)
            );

            if (specificEnrollment) {
                console.log(`[Access] ✓ Scanner-specific enrollment: ${user.username} → ${scannerID} (Legacy ID: ${fingerprintId})`);
                return true;
            }

            // Check legacy single fingerprint system
            if (user.fingerprintId === fingerprintId && user.isEnrolled) {
                console.log(`[Access] ✓ Legacy enrollment: ${user.username} (Legacy ID: ${fingerprintId})`);
                return true;
            }

            console.warn(`[Access] ✗ Access denied: ${user.username} not enrolled on ${scannerID} (FP ID: ${fingerprintId})`);
            console.log(`[Access] User enrollment status:`, {
                globalFingerprintId: user.globalFingerprintId,
                isEnrolled: user.isEnrolled,
                syncedDevicesCount: user.syncedDevices?.length || 0,
                legacyEnrollmentsCount: user.enrollments?.length || 0,
                legacyFingerprintId: user.fingerprintId
            });

            return false;

        } catch (error) {
            console.error('[Access] Error checking user access:', error);
            return false;
        }
    }

    /**     * Handle security alert (multiple persons detected)
     * @param {Object} event
     */
    async handleSecurityAlert(event) {
        try {
            const { payload, deviceMAC, clusterID, scannerID } = event;
            const { fingerprintId, multiPersonDetected } = payload;

            console.error(`🚨 SECURITY ALERT - Cluster: ${clusterID}, Device: ${deviceMAC}`);

            // Log security incident
            // TODO: Create SecurityIncident model for persistent logging

            // Real-time alert to dashboard
            if (this.io) {
                this.io.emit('security-alert', {
                    type: 'MULTIPLE_PERSONS_DETECTED',
                    clusterID: clusterID,
                    deviceMAC: deviceMAC,
                    scannerID: scannerID,
                    fingerprintId: fingerprintId,
                    personsDetected: payload.personsDetected || 2,
                    timestamp: new Date(),
                    severity: 'HIGH'
                });
            }

            // TODO: Send admin notification (email, SMS, push notification)
            // TODO: Trigger alarm/siren via IoT command
            // TODO: Record camera snapshot to evidence folder

            console.log('[SecurityAlert] ✓ Admin notified');

        } catch (error) {
            console.error('[SecurityAlert] Error:', error);
        }
    }
}

export default new RecognitionService();
