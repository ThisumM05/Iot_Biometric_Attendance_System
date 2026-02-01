import amqp from 'amqplib';
import recognitionService from '../../services/pipelines/recognitionService.js';

class RabbitMQService {
    constructor() {
        this.connection = null;
        this.channel = null;
        this.queues = {
            EVENTS: 'biometric_events',
            COMMANDS: 'biometric_commands'
        };
    }

    async connect() {
        try {
            this.connection = await amqp.connect(process.env.RABBITMQ_URI || 'amqp://localhost');
            this.channel = await this.connection.createChannel();

            // Assert queues
            await this.channel.assertQueue(this.queues.EVENTS, { durable: true });
            await this.channel.assertQueue(this.queues.COMMANDS, { durable: true });

            console.log('Connected to RabbitMQ');

            // Start consuming events
            this.consumeEvents();
        } catch (error) {
            console.error('RabbitMQ Connection Error:', error);
            // Retry logic could go here
            setTimeout(() => this.connect(), 5000);
        }
    }

    async publishCommand(command) {
        if (!this.channel) {
            console.error('RabbitMQ channel not ready');
            return;
        }

        const payload = JSON.stringify(command);
        this.channel.sendToQueue(this.queues.COMMANDS, Buffer.from(payload));
        console.log(`[RabbitMQ] Command Sent: ${command.action}`);
    }

    setSocketIo(io) {
        this.io = io;
    }

    consumeEvents() {
        this.channel.consume(this.queues.EVENTS, async (msg) => {
            if (msg !== null) {
                try {
                    const content = JSON.parse(msg.content.toString());
                    console.log('[RabbitMQ] Event Received:', content);

                    if (content.type === 'ATTENDANCE') {
                        await recognitionService.processAttendance(content);
                        // Emit real-time attendance update
                        if (this.io) this.io.emit('attendance-update', content);
                    } else if (content.type === 'ENROLL_SUCCESS') {
                        // Update DB Status
                        await import('../../services/pipelines/registrationService.js').then(m => m.default.handleEnrollmentSuccess(content.payload));

                        // Notify frontend that enrollment is complete
                        if (this.io) this.io.emit('enrollment-success', content);
                    } else if (content.type === 'ENROLL_UPDATE') {
                        // Forward intermediate progress (e.g., "Place finger", "Remove finger")
                        if (this.io) this.io.emit('enrollment-update', content);
                    } else if (content.type === 'ENROLL_FAILED') {
                        if (this.io) this.io.emit('enrollment-failed', content);
                    }

                    this.channel.ack(msg);
                } catch (error) {
                    console.error('Error processing message:', error);
                    // Depending on error, might want to nack or just ack to clear poison pill
                    this.channel.ack(msg);
                }
            }
        });
    }
}

export default new RabbitMQService();
