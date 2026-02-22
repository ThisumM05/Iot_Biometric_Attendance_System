import mqtt from 'mqtt';
import EventEmitter from 'events';
import recognitionService from '../pipelines/recognitionService.js';
import deviceHealthService from '../device/deviceHealthService.js';
import deviceRegistrationService from '../device/deviceRegistrationService.js';
import rabbitMQService from '../rabbitmq/rabbitMQService.js';
import tailgatingDetection from '../accessControl/tailgatingDetection.js';
import occupancyService from '../occupancy-state/occupancyService.js';
import Device from '../../models/Device.js';
import Cluster from '../../models/Cluster.js';
import AttendanceLog from '../../models/Attendance.js';
import templateSyncService from '../sync/templateSyncService.js';


class MQTTBridgeService {
    constructor() {
        this.client = null;
        this.topics = {
            EVENTS: 'biometric/events',
            COMMANDS: 'biometric/commands',
            CAMERA: 'camera/events'
        };
        this.io = null;
    }

    setSocketIo(io) {
        this.io = io;
    }

    async connect() {
        try {
            const mqttUrl = process.env.MQTT_URI || 'mqtt://localhost:1883';

            this.client = mqtt.connect(mqttUrl, {
                clientId: `biometric_server_${Math.random().toString(16).slice(2, 10)}`,
                username: process.env.MQTT_USER || 'guest',
                password: process.env.MQTT_PASSWORD || 'guest',
                clean: true,
                reconnectPeriod: 5000
            });

            // Listen for alarms from tailgating detection service
            tailgatingDetection.on('alarm', (data) => {
                console.log(`[MQTT Bridge] 🚨 Security alarm from Tailgating service: ${data.type} (Cluster: ${data.clusterId})`);
                this.handleClusterAlarm(data.clusterId, data.type);
            });

            // Subscribe to RabbitMQ commands and relay them to MQTT devices
            rabbitMQService.subscribeCommands(async (command) => {
                console.log(`[MQTT Bridge] 🔄 Relaying command from RabbitMQ: ${command.action}`);
                await this.publishCommand(command);
            });

            this.client.on('connect', () => {
                console.log('✓ Connected to MQTT Broker');

                // Subscribe to events topic
                this.client.subscribe(this.topics.EVENTS, (err) => {
                    if (err) {
                        console.error('❌ Failed to subscribe to MQTT events:', err);
                    } else {
                        console.log(`✓ Subscribed to MQTT topic: ${this.topics.EVENTS}`);
                    }
                });

                // Subscribe to camera events topic
                this.client.subscribe(this.topics.CAMERA, (err) => {
                    if (err) {
                        console.error('❌ Failed to subscribe to camera events:', err);
                    } else {
                        console.log(`✓ Subscribed to MQTT topic: ${this.topics.CAMERA}`);
                    }
                });

                // Handle incoming messages
                this.client.on('message', this.handleMessage.bind(this));
            });

            this.client.on('error', (err) => {
                console.error('❌ MQTT Connection Error:', err.message);
            });

            this.client.on('close', () => {
                console.warn('⚠️  MQTT Connection Closed - Will attempt reconnect...');
            });

            this.client.on('reconnect', () => {
                console.log('🔄 Reconnecting to MQTT...');
            });

        } catch (error) {
            console.error('❌ MQTT Bridge Connection Error:', error.message);
            console.log('🔄 Retrying MQTT connection in 5 seconds...');
            setTimeout(() => this.connect(), 5000);
        }
    }

    async handleMessage(topic, message) {
        try {
            const event = JSON.parse(message.toString());
            // Support both 'type' and 'eventType' field names for compatibility
            const eventType = event.eventType || event.type;

            // Log all events except heartbeats (too frequent)
            if (eventType !== 'HEARTBEAT') {
                console.log(`[MQTT Bridge] ⬇️  Event: ${eventType}`, {
                    deviceMAC: event.deviceMAC || event.payload?.deviceMAC,
                    topic
                });
            }

            // Route events by type
            switch (eventType) {
                case 'ATTENDANCE':
                    await recognitionService.processAttendance(event);
                    break;

                case 'DEVICE_REGISTER':
                    await deviceRegistrationService.registerDevice(event);
                    break;

                case 'HEARTBEAT':
                    await deviceHealthService.processHeartbeat(event);
                    break;

                case 'REGISTER':
                    // Camera device registration
                    await this.handleCameraRegistration(event);
                    break;

                case 'PHOTO_CAPTURED':
                    await this.handlePhotoCaptured(event);
                    break;

                case 'SECURITY_ALERT':
                    await recognitionService.handleSecurityAlert(event);
                    break;

                case 'ENROLL_SUCCESS':
                    await this.handleEnrollmentSuccess(event);
                    break;

                case 'ENROLL_FAILED':
                    await this.handleEnrollmentFailed(event);
                    break;

                case 'ENROLL_UPDATE':
                    // Forward enrollment progress updates to dashboard
                    console.log('[MQTT Bridge] 📤 Emitting enrollment-update:', {
                        userId: event.userId,
                        message: event.message,
                        step: event.step,
                        totalSteps: event.totalSteps,
                        scannerID: event.scannerID
                    });
                    if (this.io) {
                        this.io.emit('enrollment-update', event);
                    }
                    break;

                case 'ENROLL_WITH_TEMPLATE_SUCCESS':
                    // Forward to RabbitMQ for processing (global enrollment)
                    await this.publishToRabbitMQ(event);
                    // Also emit enrollment-success immediately so dashboard moves to sync phase
                    if (this.io) {
                        this.io.emit('enrollment-success', {
                            ...event,
                            userId: event.payload?.userId || event.userId
                        });
                    }
                    break;

                case 'TEMPLATE_INSTALL_RESULT':
                    // Handle directly instead of routing through RabbitMQ
                    // RabbitMQ path was silently dropping template install results
                    await this.handleTemplateInstallResult(event);
                    break;
                case 'TEMPLATE_DELETE_RESULT':
                case 'CLEAR_ALL_TEMPLATES_RESULT':
                    // Forward device sync results to RabbitMQ for processing
                    await this.publishToRabbitMQ(event);
                    break;

                case 'DEVICE_ERROR':
                    await this.handleDeviceError(event);
                    break;

                case 'DOOR_STATUS':
                    await this.handleDoorStatus(event);
                    break;

                case 'IR_CROSSING':
                    await this.handleIRCrossing(event);
                    break;

                default:
                    console.warn(`[MQTT Bridge] Unknown event type: ${eventType}`);
            }
        } catch (error) {
            console.error('[MQTT Bridge] Error parsing/handling message:', error);
        }
    }

    async handleEnrollmentSuccess(event) {
        console.log('[MQTT Bridge] ✓ Enrollment Success:', event);
        if (this.io) {
            this.io.emit('enrollment-success', {
                userId: event.userId,
                deviceMAC: event.deviceMAC,
                scannerID: event.scannerID,
                fingerprintID: event.fingerprintID
            });
        }
    }

    async handleEnrollmentFailed(event) {
        console.error('[MQTT Bridge] ✗ Enrollment Failed:', event);
        if (this.io) {
            this.io.emit('enrollment-failed', {
                userId: event.userId,
                deviceMAC: event.deviceMAC,
                error: event.error
            });
        }
    }

    async handleDeviceError(event) {
        console.error('[MQTT Bridge] Device Error:', event);
        if (this.io) {
            this.io.emit('device-error', event);
        }
    }

    async handleTemplateInstallResult(event) {
        try {
            console.log('[MQTT Bridge] 📥 Template install result received directly:', {
                deviceMAC: event.deviceMAC,
                userId: event.payload?.userId,
                success: event.payload?.success
            });

            // Use the directly imported templateSyncService
            await templateSyncService.handleTemplateInstallResult(event);
        } catch (error) {
            console.error('[MQTT Bridge] Error handling template install result:', error);
        }
    }

    async handleDoorStatus(event) {
        console.log('[MQTT Bridge] Door Status Update:', event);
        if (this.io) {
            this.io.emit('door-status-update', event);
        }
    }

    /**
     * Handle IR crossing events
     */
    async handleIRCrossing(event) {
        try {
            const { deviceMAC, direction, timestamp } = event;
            const device = await Device.findOne({ deviceMAC });

            const clusterID = device?.clusterID || event.clusterID || 'Unknown Cluster';
            const location = device?.location || 'Unknown Location';
            const deviceRole = device?.role || 'UNKNOWN';

            // IMPORTANT: Only record IN or OUT events for Occupancy Tracking
            // We get the current personCount, simulate an increment/decrement so occupancyService detects an ENTRY/EXIT event
            try {
                // Use cluster as shared tracking key so entry+exit devices share one counter
                const trackingKey = device?.clusterID || deviceMAC;
                const currentState = occupancyService.getDeviceState(trackingKey);
                let newCount = currentState.personCount;

                if (direction === 'IN' || direction === 'ENTRY') {
                    newCount++;
                } else if (direction === 'OUT' || direction === 'EXIT') {
                    newCount = Math.max(0, newCount - 1); // Prevent negative occupancy
                }

                // Push change to occupancy service
                const isEntry = direction === 'IN' || direction === 'ENTRY';
                const isExit = direction === 'OUT' || direction === 'EXIT';
                const result = await occupancyService.updateOccupancy({
                    deviceId: deviceMAC,
                    trackingKey,
                    personCount: newCount,
                    location: `${clusterID} - ${location}`,
                    fingerprintScanAttempt: false,
                    userId: null,
                    forceEventType: isEntry ? 'ENTRY' : isExit ? 'EXIT' : undefined,
                    eventMessage: isExit ? `Person exited. Current count: ${newCount}`
                        : isEntry ? `Person entered. Current count: ${newCount}`
                            : undefined
                });

                // Broadcast via WebSocket to dashboard if io is available
                if (this.io) {
                    if (result.alert?.triggered) {
                        this.io.emit('occupancy:alert', {
                            deviceId: deviceMAC,
                            personCount: newCount,
                            severity: result.alert.severity,
                            message: result.alert.message,
                            timestamp: new Date(),
                            logId: result?.log?._id
                        });
                    }

                    this.io.emit('occupancy:update', {
                        deviceId: deviceMAC,
                        currentState: result.currentState,
                        event: result.event
                    });
                }
            } catch (occErr) {
                console.error('[MQTT Bridge] Occupancy update failed:', occErr.message);
            }

            // Feed IR data into Tailgating Detection Service
            const result = tailgatingDetection.recordBeamCrossing(
                deviceMAC,
                clusterID,
                direction,
                timestamp || Date.now()
            );

            // Emit to dashboard for real-time monitoring
            if (this.io) {
                this.io.emit('security:ir-crossing', {
                    deviceMAC,
                    clusterID,
                    direction,
                    deviceRole,
                    timestamp: Date.now(),
                    sessionActive: !!result
                });
            }
        } catch (error) {
            console.error('[MQTT Bridge] Error handling IR crossing:', error);
        }
    }

    /**
     * Send TRIGGER_ALARM command to a specific device
     */
    sendAlarmCommand(targetDeviceMAC, action = 'TRIGGER_ALARM') {
        this.publishCommand({
            action,
            targetDeviceMAC,
            timestamp: Date.now()
        });
        console.log(`[MQTT Bridge] 🚨 ${action} sent to ${targetDeviceMAC}`);
    }

    /**
     * Publish command to ESP32 devices via MQTT
     * @param {Object} command - Command object with action and targetDeviceMAC
     */
    publishCommand(command) {
        if (!this.client || !this.client.connected) {
            console.error('[MQTT Bridge] Cannot publish - MQTT not connected');
            return false;
        }

        try {
            const payload = JSON.stringify(command);
            this.client.publish(this.topics.COMMANDS, payload, { qos: 1 }, (err) => {
                if (err) {
                    console.error('[MQTT Bridge] Publish error:', err);
                } else {
                    console.log(`[MQTT Bridge] ✓ Command Sent: ${command.action} → ${command.targetDeviceMAC || 'broadcast'}`);
                }
            });
            return true;
        } catch (error) {
            console.error('[MQTT Bridge] Error publishing command:', error);
            return false;
        }
    }

    /**
     * Publish event to RabbitMQ for processing
     * @param {Object} event - Event object
     */
    async publishToRabbitMQ(event) {
        try {
            await rabbitMQService.publishEvent(event);
            return true;
        } catch (error) {
            console.error('[MQTT Bridge] Error publishing to RabbitMQ:', error);
            return false;
        }
    }

    /**
     * Handle camera device registration
     */
    async handleCameraRegistration(event) {
        try {
            console.log('[MQTT Bridge] 📷 Camera registering:', event.deviceId);

            // Register camera as a device
            await deviceRegistrationService.registerDevice({
                deviceMAC: event.deviceId,
                deviceType: 'ESP32-CAM',
                capabilities: event.capabilities?.split(',') || [],
                firmwareVersion: event.firmware || '1.0.0',
                ipAddress: event.ipAddress,
                streamURL: event.streamURL
            });

            // Emit to dashboard
            if (this.io) {
                this.io.emit('camera-registered', {
                    deviceId: event.deviceId,
                    streamURL: event.streamURL,
                    ipAddress: event.ipAddress
                });
            }
        } catch (error) {
            console.error('[MQTT Bridge] Error handling camera registration:', error);
        }
    }

    /**
     * Handle photo captured event
     */
    async handlePhotoCaptured(event) {
        try {
            console.log('[MQTT Bridge] 📸 Photo captured:', {
                deviceId: event.deviceId,
                eventType: event.eventType,
                size: event.imageSize
            });

            // Emit to dashboard for live updates
            if (this.io) {
                this.io.emit('photo-captured', event);
            }
        } catch (error) {
            console.error('[MQTT Bridge] Error handling photo capture:', error);
        }
    }

    /**
     * Publish command to device via MQTT
     * @param {Object} command - Command object to send to device
     * @returns {Promise<boolean>} Success status
     */
    async publishCommand(command) {
        try {
            if (!this.client || !this.client.connected) {
                throw new Error('MQTT client not connected');
            }

            const message = JSON.stringify(command);

            return new Promise((resolve, reject) => {
                this.client.publish(this.topics.COMMANDS, message, { qos: 1 }, (error) => {
                    if (error) {
                        console.error('[MQTT Bridge] Failed to publish command:', error);
                        reject(error);
                    } else {
                        console.log(`[MQTT Bridge] 📤 Command sent: ${command.action} to ${command.targetDeviceMAC || 'unknown-device'}`);
                        resolve(true);
                    }
                });
            });
        } catch (error) {
            console.error('[MQTT Bridge] Error publishing command:', error);
            throw error;
        }
    }

    /**
     * Handle cluster-wide alarms by triggering the master buzzer (EXIT node)
     * @param {String} clusterID 
     * @param {String} alarmType 
     */
    async handleClusterAlarm(clusterID, alarmType) {
        try {
            console.log(`[MQTT Bridge] 📢 Broadcasting ${alarmType} alarm to cluster ${clusterID} for synchronized feedback`);
            this.publishCommand({
                action: 'TRIGGER_ALARM_PATTERN',
                targetDeviceMAC: 'ALL', // Broadcast to all devices in cluster
                clusterID,
                pattern: alarmType,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('[MQTT Bridge] Error handling cluster alarm:', error);
        }
    }

    disconnect() {
        if (this.client) {
            this.client.end();
            console.log('✓ MQTT Bridge disconnected');
        }
    }
}

const mqttBridgeService = new MQTTBridgeService();
export default mqttBridgeService;
