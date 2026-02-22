import amqp from 'amqplib';
import recognitionService from '../../services/pipelines/recognitionService.js';
import deviceHealthService from '../device/deviceHealthService.js';
import deviceRegistrationService from '../device/deviceRegistrationService.js';
import templateSyncService from '../sync/templateSyncService.js';

class RabbitMQService {
    constructor() {
        this.connection = null;
        this.channel = null;
        this.queues = {
            EVENTS: 'biometric_events',
            COMMANDS: 'biometric_commands'
        };
        this.io = null;
    }

    async connect() {
        try {
            this.connection = await amqp.connect(process.env.RABBITMQ_URI || 'amqp://localhost');
            this.channel = await this.connection.createChannel();

            // Handle connection errors to prevent crashes
            this.connection.on('error', (err) => {
                console.error('❌ RabbitMQ Connection Error:', err.message);
                // Connection will try to reconnect via 'close' event
            });

            this.connection.on('close', () => {
                console.warn('⚠️  RabbitMQ Connection Closed - Reconnecting in 5 seconds...');
                this.connection = null;
                this.channel = null;
                setTimeout(() => this.connect(), 5000);
            });

            // Handle channel errors to prevent crashes
            this.channel.on('error', (err) => {
                console.error('❌ RabbitMQ Channel Error:', err.message);
            });

            this.channel.on('close', () => {
                console.warn('⚠️  RabbitMQ Channel Closed');
            });

            // Assert queues
            await this.channel.assertQueue(this.queues.EVENTS, { durable: true });
            await this.channel.assertQueue(this.queues.COMMANDS, { durable: true });

            console.log('✓ Connected to RabbitMQ');

            // Start consuming events
            this.consumeEvents();
        } catch (error) {
            console.error('❌ RabbitMQ Connection Error:', error.message);
            // Retry connection
            console.log('🔄 Retrying RabbitMQ connection in 5 seconds...');
            setTimeout(() => this.connect(), 5000);
        }
    }

    async publishCommand(command) {
        if (!this.channel) {
            console.error('RabbitMQ channel not ready');
            return false;
        }

        try {
            const payload = JSON.stringify(command);
            this.channel.sendToQueue(this.queues.COMMANDS, Buffer.from(payload), {
                persistent: true
            });
            console.log(`[RabbitMQ] ✓ Command Sent: ${command.action} → ${command.targetDeviceMAC || 'broadcast'}`);
            return true;
        } catch (error) {
            console.error(`[RabbitMQ] Error publishing command:`, error);
            return false;
        }
    }

    async publishEvent(event) {
        if (!this.channel) {
            console.error('RabbitMQ channel not ready');
            return false;
        }

        try {
            const payload = JSON.stringify(event);
            this.channel.sendToQueue(this.queues.EVENTS, Buffer.from(payload), {
                persistent: true
            });
            console.log(`[RabbitMQ] ✓ Event Published: ${event.eventType || event.type}`);
            return true;
        } catch (error) {
            console.error(`[RabbitMQ] Error publishing event:`, error);
            return false;
        }
    }

    setSocketIo(io) {
        this.io = io;
        // Pass socket.io to services
        recognitionService.setSocketIo(io);
        deviceHealthService.setSocketIo(io);
        deviceRegistrationService.setSocketIo(io);
        templateSyncService.setSocketIo(io);
    }

    consumeEvents() {
        this.channel.consume(this.queues.EVENTS, async (msg) => {
            if (msg !== null) {
                try {
                    const event = JSON.parse(msg.content.toString());
                    const eventType = event.type;

                    // Log all events except heartbeats (too frequent)
                    if (eventType !== 'HEARTBEAT') {
                        console.log(`[RabbitMQ] ⬇️  Event: ${eventType}`, {
                            deviceMAC: event.deviceMAC,
                            clusterID: event.clusterID,
                            scannerID: event.scannerID
                        });
                    }

                    // Route events by type
                    switch (eventType) {
                        case 'ATTENDANCE':
                            await recognitionService.processAttendance(event);
                            // Real-time update already handled in recognitionService
                            break;

                        case 'DEVICE_REGISTER':
                            // SECURITY: Device registration always creates PENDING status
                            // Cluster/role/scanner assignment ONLY via admin approval API
                            await deviceRegistrationService.registerDevice(event);
                            break;

                        case 'HEARTBEAT':
                            await deviceHealthService.processHeartbeat(event);
                            break;

                        case 'SECURITY_ALERT':
                            await recognitionService.handleSecurityAlert(event);
                            // Real-time alert already handled in recognitionService
                            break;

                        case 'ENROLL_SUCCESS':
                            await this.handleEnrollmentSuccess(event);
                            if (this.io) {
                                this.io.emit('enrollment-success', event);
                            }
                            break;

                        case 'ENROLL_WITH_TEMPLATE_SUCCESS':
                            // Handle new template-based enrollment
                            await this.handleTemplateEnrollmentSuccess(event);
                            if (this.io) {
                                // Ensure userId is at top level for dashboard to detect
                                this.io.emit('enrollment-success', {
                                    ...event,
                                    userId: event.payload?.userId || event.userId
                                });
                            }
                            break;

                        case 'TEMPLATE_INSTALL_RESULT':
                            // Handle template installation confirmation
                            await this.handleTemplateInstallResult(event);
                            break;

                        case 'TEMPLATE_DELETE_RESULT':
                            // Handle template deletion confirmation
                            await this.handleTemplateDeleteResult(event);
                            break;
                        case 'CLEAR_ALL_TEMPLATES_RESULT':
                            // Handle device clear templates result
                            await templateSyncService.handleClearDeviceResult(event);
                            break;
                        case 'ENROLL_UPDATE':
                            // Forward progress updates to dashboard
                            if (this.io) {
                                this.io.emit('enrollment-update', event);
                            }
                            break;

                        case 'ENROLL_FAILED':
                            if (this.io) {
                                this.io.emit('enrollment-failed', event);
                            }
                            break;

                        default:
                            console.warn(`[RabbitMQ] Unknown event type: ${eventType}`);
                    }

                    this.channel.ack(msg);
                } catch (error) {
                    console.error('[RabbitMQ] Error processing message:', error);
                    // Acknowledge to prevent reprocessing bad messages
                    this.channel.ack(msg);
                }
            }
        });
    }

    /**
     * Subscribe to the commands queue
     * @param {Function} callback - Function to call when a command is received
     */
    async subscribeCommands(callback) {
        if (!this.channel) {
            console.log('⏳ RabbitMQ channel not ready for command subscription, waiting 2s...');
            setTimeout(() => this.subscribeCommands(callback), 2000);
            return;
        }

        try {
            console.log(`[RabbitMQ] ✓ Subscribed to command queue: ${this.queues.COMMANDS}`);
            this.channel.consume(this.queues.COMMANDS, async (msg) => {
                if (msg !== null) {
                    try {
                        const command = JSON.parse(msg.content.toString());
                        await callback(command);
                        this.channel.ack(msg);
                    } catch (error) {
                        console.error('[RabbitMQ] Error in command subscriber:', error);
                        this.channel.ack(msg);
                    }
                }
            });
        } catch (error) {
            console.error('[RabbitMQ] Error subscribing to commands:', error);
        }
    }

    /**
     * Handle enrollment success event
     * @param {Object} event
     */
    async handleEnrollmentSuccess(event) {
        try {
            const { payload, deviceMAC, clusterID, scannerID } = event;
            const { fingerprintId, userId } = payload;

            console.log(`[Enrollment] Success: User ${userId} → FP ${fingerprintId} on ${scannerID}`);

            // Import User model and update
            const User = (await import('../../models/User.js')).default;

            const user = await User.findById(userId);
            if (!user) {
                console.warn(`[Enrollment] User ${userId} not found`);
                return;
            }

            // Add enrollment to user's enrollments array
            user.enrollments = user.enrollments || [];

            // Check if already enrolled on this scanner
            const existingIndex = user.enrollments.findIndex(
                e => e.scannerID === scannerID || e.deviceMAC === deviceMAC
            );

            const enrollmentData = {
                scannerID: scannerID,
                deviceMAC: deviceMAC,
                fingerprintId: fingerprintId,
                clusterID: clusterID,
                enrolledAt: new Date()
            };

            if (existingIndex >= 0) {
                // Update existing enrollment
                user.enrollments[existingIndex] = enrollmentData;
            } else {
                // Add new enrollment
                user.enrollments.push(enrollmentData);
            }

            // Update legacy fields for backward compatibility
            if (!user.fingerprintId) {
                user.fingerprintId = fingerprintId;
            }
            user.isEnrolled = true;

            await user.save();

            console.log(`[Enrollment] ✓ User ${user.username} enrolled on ${scannerID}`);

        } catch (error) {
            console.error('[Enrollment] Error:', error);
        }
    }

    /**
     * Handle template-based enrollment success with template data
     * @param {Object} event
     */
    async handleTemplateEnrollmentSuccess(event) {
        try {
            const templateSyncService = (await import('../sync/templateSyncService.js')).default;
            await templateSyncService.handleEnrollmentWithTemplate(event);

        } catch (error) {
            console.error('[TemplateEnrollment] Error:', error);
        }
    }

    /**
     * Handle template installation result from device
     * @param {Object} event
     */
    async handleTemplateInstallResult(event) {
        try {
            const templateSyncService = (await import('../sync/templateSyncService.js')).default;
            await templateSyncService.handleTemplateInstallResult(event);

        } catch (error) {
            console.error('[TemplateInstall] Error:', error);
        }
    }

    /**
     * Handle template deletion result from device
     * @param {Object} event
     */
    async handleTemplateDeleteResult(event) {
        try {
            // Extract deviceMAC from top level (ESP32 sends it there)
            const deviceMAC = event.deviceMAC || event.payload.deviceMAC;
            const { userId, globalFingerprintId, success } = event.payload;

            if (success) {
                // Remove from user's syncedDevices array
                const User = (await import('../../models/User.js')).default;
                await User.updateOne(
                    { _id: userId },
                    {
                        $pull: {
                            syncedDevices: { deviceMAC: deviceMAC }
                        }
                    }
                );

                console.log(`[TemplateDelete] ✓ User ${userId} removed from ${deviceMAC}`);
            } else {
                console.error(`[TemplateDelete] ✗ Failed to remove user ${userId} from ${deviceMAC}`);
            }

            // Emit real-time update
            if (this.io) {
                this.io.emit('template-delete-update', {
                    userId,
                    deviceMAC,
                    success,
                    globalFingerprintId
                });
            }

        } catch (error) {
            console.error('[TemplateDelete] Error:', error);
        }
    }

    /**
     * Get connection status
     */
    isConnected() {
        return this.connection !== null && this.channel !== null;
    }

    /**
     * Graceful shutdown
     */
    async close() {
        try {
            if (this.channel) await this.channel.close();
            if (this.connection) await this.connection.close();
            console.log('RabbitMQ connection closed');
        } catch (error) {
            console.error('Error closing RabbitMQ connection:', error);
        }
    }
}

export default new RabbitMQService();