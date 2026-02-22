import WebSocket from 'ws';
import sharp from 'sharp';
import http from 'http';

const SERVER_URL = 'http://localhost:5000';
const WS_URL = 'ws://localhost:5000/camera/stream';
const DEVICE_ID = 'TEST_DEVICE_' + Math.floor(Math.random() * 10000);
const CAMERA_ID = 'CAM_01';

// Create a simple face SVG buffer
const svgImage = `
<svg width="640" height="480" xmlns="http://www.w3.org/2000/svg">
  <rect width="640" height="480" fill="#CCCCCC"/>
  <!-- Face -->
  <circle cx="320" cy="240" r="100" fill="#FFCCAA" stroke="black" stroke-width="5"/>
  <!-- Eyes -->
  <circle cx="280" cy="210" r="10" fill="black"/>
  <circle cx="360" cy="210" r="10" fill="black"/>
  <!-- Mouth -->
  <path d="M 270 280 Q 320 330 370 280" stroke="black" stroke-width="5" fill="none"/>
</svg>
`;

async function generateTestFrame() {
    return sharp(Buffer.from(svgImage))
        .jpeg()
        .toBuffer();
}

async function runTest() {
    console.log(`🚀 Starting Tailgating Logic Test for Device: ${DEVICE_ID}`);

    // Generate frame once
    const frameBuffer = await generateTestFrame();

    // 1. Connect WebSocket
    const ws = new WebSocket(WS_URL);

    ws.on('open', async () => {
        console.log('✅ WebSocket Connected');

        // Register Camera
        ws.send(JSON.stringify({
            type: 'REGISTER',
            deviceId: DEVICE_ID,
            cameraId: CAMERA_ID
        }));

        // Wait for registration
        setTimeout(async () => {
            console.log('📸 Sending Frames...');

            // Send 10 frames
            let frameCount = 0;
            const interval = setInterval(() => {
                ws.send(frameBuffer);
                frameCount++;
                process.stdout.write('.');

                if (frameCount >= 10) {
                    clearInterval(interval);
                    console.log('\n✅ Frames Sent. NOW TRIGGERING IR CROSSING...');
                    triggerIrCrossing();
                }
            }, 200); // 5 FPS
        }, 1000);
    });

    ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        // console.log('📩 Received:', msg.type);

        if (msg.type === 'TRIGGER_ALARM') {
            console.log('\n🚨🚨 ALARM TRIGGERED SUCCESSFULY! 🚨🚨');
            console.log(`   Reason: ${msg.reason}`);
            console.log('✅ TEST PASSED');
            ws.close();
            process.exit(0);
        }
    });

    ws.on('error', (err) => {
        console.error('❌ WebSocket Error:', err.message);
        process.exit(1);
    });
}

// 2. Trigger IR Crossing via API
function triggerIrCrossing() {
    console.log('🚶 Triggering IR Crossing Event...');

    const postData = JSON.stringify({
        deviceId: DEVICE_ID,
        direction: 'IN', // Be careful, is it IN or OUT based on logic? Default logic usually unauthorized IN = Alarm
        timestamp: Date.now()
    });

    const options = {
        hostname: 'localhost',
        port: 5000,
        path: '/api/ir-beam/crossing',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            console.log('✅ IR Event Response:', data);

            // Wait 5 seconds for server to correlate and trigger alarm
            setTimeout(() => {
                console.log('⏳ Still waiting for alarm... (If no alarm, test failed)');
                // Don't exit yet, give it a chance
            }, 3000);
        });
    });

    req.on('error', (e) => {
        console.error(`❌ API Error: ${e.message}`);
    });

    req.write(postData);
    req.end();
}

runTest().catch(console.error);
