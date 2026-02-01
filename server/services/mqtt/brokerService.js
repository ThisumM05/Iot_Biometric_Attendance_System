import Aedes from 'aedes';
import { createServer } from 'net';
import RawEvent from '../../models/RawEvent.js';

class BrokerService {
    constructor() {
        this.aedes = new Aedes();
        this.server = createServer(this.aedes.handle);
        this.port = process.env.MQTT_PORT || 1883;
    }

    startBroker() {
        this.server.listen(this.port, () => {
            console.log(`MQTT Broker running on port ${this.port}`);
        });

        this.aedes.on('publish', async (packet, client) => {
            if (packet.topic.startsWith('$SYS')) return; // Ignore system topics

            try {
                // Try to parse payload as JSON, otherwise store as string
                let payloadData;
                const payloadString = packet.payload.toString();

                try {
                    payloadData = JSON.parse(payloadString);
                } catch (e) {
                    payloadData = { raw: payloadString };
                }

                const event = new RawEvent({
                    topic: packet.topic,
                    payload: payloadData,
                    metadata: {
                        clientId: client ? client.id : 'unknown'
                    }
                });

                await event.save();
                console.log(`[MQTT] Event saved on topic: ${packet.topic}`);
            } catch (error) {
                console.error(`[MQTT] Error saving event:`, error);
            }
        });

        this.aedes.on('client', (client) => {
            console.log(`[MQTT] Client Connected: ${client ? client.id : client}`);
        });

        this.aedes.on('clientDisconnect', (client) => {
            console.log(`[MQTT] Client Disconnected: ${client ? client.id : client}`);
        });
    }
}

export default new BrokerService();
