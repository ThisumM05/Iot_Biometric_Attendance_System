// RabbitMQ Service for handling login/register topic switching
class RabbitMQService {
    constructor() {
        this.ws = null;
        this.currentMode = 'login'; // 'login' or 'register'
        this.isConnected = false;
        this.eventCallbacks = new Map();
    }

    // Connect to WebSocket server that bridges to RabbitMQ
    connect(url = 'ws://localhost:8080/ws') {
        try {
            this.ws = new WebSocket(url);

            this.ws.onopen = () => {
                this.isConnected = true;
                console.log('Connected to RabbitMQ WebSocket bridge');
                this.emit('connected');
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            this.ws.onclose = () => {
                this.isConnected = false;
                console.log('Disconnected from RabbitMQ WebSocket bridge');
                this.emit('disconnected');
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.emit('error', error);
            };

        } catch (error) {
            console.error('Failed to connect to WebSocket:', error);
        }
    }

    // Switch to register mode - close login topic, open register topic
    switchToRegisterMode() {
        if (!this.isConnected || !this.ws) {
            console.error('WebSocket not connected');
            return false;
        }

        const message = {
            action: 'switch_mode',
            mode: 'register',
            timestamp: new Date().toISOString(),
            topics: {
                close: ['login_topic'],
                open: ['register_topic']
            }
        };

        this.ws.send(JSON.stringify(message));
        this.currentMode = 'register';
        console.log('Switched to register mode');
        return true;
    }

    // Switch to login mode - close register topic, open login topic
    switchToLoginMode() {
        if (!this.isConnected || !this.ws) {
            console.error('WebSocket not connected');
            return false;
        }

        const message = {
            action: 'switch_mode',
            mode: 'login',
            timestamp: new Date().toISOString(),
            topics: {
                close: ['register_topic'],
                open: ['login_topic']
            }
        };

        this.ws.send(JSON.stringify(message));
        this.currentMode = 'login';
        console.log('Switched to login mode');
        return true;
    }

    // Send student registration data
    registerStudent(studentData) {
        if (!this.isConnected || !this.ws) {
            console.error('WebSocket not connected');
            return false;
        }

        const message = {
            action: 'register_student',
            student: studentData,
            timestamp: new Date().toISOString()
        };

        this.ws.send(JSON.stringify(message));
        return true;
    }

    // Handle incoming messages from RabbitMQ
    handleMessage(data) {
        switch (data.type) {
            case 'mode_switched':
                console.log(`Mode switched to: ${data.mode}`);
                this.emit('mode_switched', data.mode);
                break;

            case 'fingerprint_scan_started':
                console.log('Fingerprint scan started');
                this.emit('scan_started');
                break;

            case 'fingerprint_scan_progress':
                console.log(`Scan progress: ${data.progress}%`);
                this.emit('scan_progress', data.progress);
                break;

            case 'fingerprint_scan_complete':
                console.log('Fingerprint scan completed successfully');
                this.emit('scan_complete', data.student);
                break;

            case 'fingerprint_scan_failed':
                console.log('Fingerprint scan failed');
                this.emit('scan_failed', data.error);
                break;

            case 'registration_timeout':
                console.log('Registration timeout');
                this.emit('registration_timeout');
                break;

            case 'authentication_success':
                console.log('Authentication successful');
                this.emit('auth_success', data.student);
                break;

            case 'authentication_failed':
                console.log('Authentication failed');
                this.emit('auth_failed', data.error);
                break;

            default:
                console.log('Unknown message type:', data.type);
        }
    }

    // Event emitter functionality
    on(event, callback) {
        if (!this.eventCallbacks.has(event)) {
            this.eventCallbacks.set(event, []);
        }
        this.eventCallbacks.get(event).push(callback);
    }

    off(event, callback) {
        if (this.eventCallbacks.has(event)) {
            const callbacks = this.eventCallbacks.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    emit(event, data = null) {
        if (this.eventCallbacks.has(event)) {
            this.eventCallbacks.get(event).forEach(callback => callback(data));
        }
    }

    // Disconnect from WebSocket
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
            this.isConnected = false;
        }
    }

    // Get current connection status
    getStatus() {
        return {
            connected: this.isConnected,
            mode: this.currentMode
        };
    }
}

// Export singleton instance
const rabbitMQService = new RabbitMQService();
export default rabbitMQService;