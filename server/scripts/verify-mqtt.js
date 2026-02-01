import mqtt from 'mqtt';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the parent directory (server root)
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const port = process.env.MQTT_PORT || 1883;
const client = mqtt.connect(`mqtt://localhost:${port}`);

client.on('connect', () => {
    console.log('Connected to MQTT Broker');

    const topic = 'biometric/test';
    const message = JSON.stringify({
        deviceId: 'DEV-001',
        action: 'check-in',
        userId: 'USER-123'
    });

    client.publish(topic, message, { qos: 1 }, (err) => {
        if (err) {
            console.error('Publish error:', err);
        } else {
            console.log('Message published');
            client.end();
        }
    });
});

client.on('error', (err) => {
    console.error('Connection error:', err);
    client.end();
});
