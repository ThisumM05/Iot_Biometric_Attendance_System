import amqp from 'amqplib';
import dotenv from 'dotenv';
import readline from 'readline';

// Load environment variables
dotenv.config({ path: '../.env' }); // Adjust path if running from scripts folder

const RABBITMQ_URI = process.env.RABBITMQ_URI || 'amqp://localhost';
const QUEUES = {
    EVENTS: 'biometric_events',
    COMMANDS: 'biometric_commands'
};

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let channel;

async function startSimulator() {
    try {
        console.log('Connecting to RabbitMQ...');
        const connection = await amqp.connect(RABBITMQ_URI);
        channel = await connection.createChannel();

        await channel.assertQueue(QUEUES.EVENTS, { durable: true });
        await channel.assertQueue(QUEUES.COMMANDS, { durable: true });

        console.log('✅ Connected! Simulation Active.');
        console.log('-----------------------------------');
        console.log('WAITING for messages on "biometric_commands"...');
        console.log('👉 Type a Fingerprint ID and press Enter to simulate a scan');
        console.log('   (e.g., type "1" for User 1)');
        console.log('Press [Q] to Quit');
        console.log('-----------------------------------');

        // Listen for Commands from Server/Dashboard
        channel.consume(QUEUES.COMMANDS, async (msg) => {
            if (msg !== null) {
                const command = JSON.parse(msg.content.toString());
                console.log(`\n[⬇️ RECEIVED] Command: ${command.action}`, command);

                if (command.action === 'ENROLL') {
                    await simulateEnrollmentProcess(command);
                }

                channel.ack(msg);
            }
        });

        handleInput();

    } catch (error) {
        console.error('Connection Failed:', error);
    }
}

async function simulateEnrollmentProcess(command) {
    // Note: RegistrationService sends { action: 'ENROLL', id: fpId, userId: mongoId, deviceId }
    const userId = command.userId;
    console.log(`[🔄 SIMULATION] Starting Enrollment for User ID: ${userId}`);

    // Step 1: Wait initial
    await sleep(1500);
    publishEvent({ type: 'ENROLL_UPDATE', message: 'Place finger on sensor...', step: 1, totalSteps: 3, deviceId: 'SIM-001' });

    // Step 2: Image 1 Captured
    await sleep(2000);
    publishEvent({ type: 'ENROLL_UPDATE', message: 'Image taken! Remove finger.', step: 2, totalSteps: 3, deviceId: 'SIM-001' });

    // Step 3: Wait for second place
    await sleep(2000);
    publishEvent({ type: 'ENROLL_UPDATE', message: 'Place same finger again...', step: 3, totalSteps: 3, deviceId: 'SIM-001' });

    // Step 4: Success
    await sleep(2000);
    const fakeFingerprintId = Math.floor(Math.random() * 1000) + 1;
    publishEvent({
        type: 'ENROLL_SUCCESS',
        payload: {
            fingerprintId: fakeFingerprintId,
            userId: userId
        },
        deviceId: 'SIM-001'
    });
    console.log(`[✅ SIMULATION] Enrollment Complete. Assigned ID: ${fakeFingerprintId}`);
}

// Function merged into handleInput layout
// async function simulateAttendance() { ... } removed

function publishEvent(event) {
    channel.sendToQueue(QUEUES.EVENTS, Buffer.from(JSON.stringify(event)));
}

// Default mode is waiting for scans (Attendance)
function handleInput() {
    rl.question('👉 Enter Fingerprint ID to Simulate Scan (or Q to quit): ', (input) => {
        const trimmed = input.trim();

        if (trimmed.toLowerCase() === 'q') {
            console.log('Exiting...');
            process.exit(0);
        } else if (trimmed && !isNaN(trimmed)) {
            // It's a number -> Simulate Attendance
            publishEvent({
                type: 'ATTENDANCE',
                payload: {
                    fingerprintId: parseInt(trimmed)
                },
                timestamp: new Date().toISOString(),
                deviceId: 'SIM-001'
            });
            console.log(`[📤 SENT] Attendance event for ID: ${trimmed}`);
        } else if (trimmed) {
            console.log('❌ Invalid input. Enter a numeric Fingerprint ID.');
        }

        handleInput(); // Loop back
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

startSimulator();
