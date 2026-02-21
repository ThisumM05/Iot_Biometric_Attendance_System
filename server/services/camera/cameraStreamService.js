import { WebSocketServer } from 'ws';
import Device from '../../models/Device.js';
import tailgatingDetection from '../accessControl/tailgatingDetection.js';
import yoloFaceService from '../ml/yoloFaceService.js';

class CameraStreamService {
    constructor() {
        this.wss = null;
        this.cameras = new Map(); // deviceId -> { socket, lastFrame, faceCount, isProcessing }
        this.io = null;
        this.modelsLoaded = false;
        this.totalFramesReceived = 0;
        this.totalFramesProcessed = 0;
        this.lastStatusLog = Date.now();

        // Listen to tailgating detection events
        this.setupTailgatingListeners();
    }

    /**
     * Initialize WebSocket server and load AI models
     */
    async initialize(httpServer) {
        // 1. Load AI Models
        try {
            await yoloFaceService.loadModel();
            this.modelsLoaded = true;
            console.log('✓ YOLOv8-Face Service ready');
        } catch (error) {
            console.error('❌ Failed to initialize YOLO service:', error.message);
        }

        // 2. Start WebSocket Server
        // 2. Start WebSocket Server (Manual Upgrade Handling)
        this.wss = new WebSocketServer({
            noServer: true
        });

        // Handle upgrade requests manually to coexist with Socket.IO
        httpServer.on('upgrade', (request, socket, head) => {
            const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

            if (pathname === '/camera/stream') {
                this.wss.handleUpgrade(request, socket, head, (ws) => {
                    this.wss.emit('connection', ws, request);
                });
            }
            // If it's not /camera/stream, do nothing (Socket.IO handles its own path)
        });

        this.wss.on('connection', (ws, req) => {
            console.log('📹 Camera WebSocket connected from:', req.socket.remoteAddress);
            let deviceId = null;

            ws.on('message', async (data) => {
                try {
                    if (data instanceof Buffer && data[0] === 0x7B) {
                        const message = JSON.parse(data.toString());
                        await this.handleTextMessage(ws, message, (id) => { deviceId = id; });
                    } else if (typeof data === 'string') {
                        const message = JSON.parse(data);
                        await this.handleTextMessage(ws, message, (id) => { deviceId = id; });
                    } else {
                        // Binary frame
                        await this.handleBinaryFrame(deviceId, data);
                    }
                } catch (error) {
                    console.error('Error processing camera message:', error);
                }
            });

            ws.on('close', () => {
                console.log('📹 Camera disconnected:', deviceId);
                if (deviceId) this.cameras.delete(deviceId);
            });

            ws.on('error', (error) => console.error('Camera WebSocket error:', error));
        });

        console.log('✓ Camera WebSocket server initialized on /camera/stream (Manual Upgrade Handler)');
    }

    async handleTextMessage(ws, message, setDeviceId) {
        // Control messages handled via MQTT, this is mainly for registration/metadata
        const messageType = message.eventType || message.type;

        switch (messageType) {
            case 'REGISTER':
                setDeviceId(message.deviceId);
                this.cameras.set(message.deviceId, {
                    socket: ws,
                    cameraId: message.cameraId,
                    lastFrame: null,
                    faceCount: 0,
                    isProcessing: false, // Lock to prevent backlog
                    metadata: message
                });
                console.log(`✓ Camera registered: ${message.deviceId}`);

                // AUTO-UPDATE IP Logic
                if (message.ipAddress) {
                    try {
                        const streamURL = `http://${message.ipAddress}:81/stream`;
                        const actualStreamURL = `http://${message.ipAddress}:81/stream`;
                        const snapshotURL = `http://${message.ipAddress}:81/snapshot`;

                        // Only update IP and stream URLs - do NOT change status
                        // PENDING devices must stay PENDING until admin approves
                        const updateFields = {
                            ipAddress: message.ipAddress,
                            streamURL: actualStreamURL,
                            snapshotURL: snapshotURL,
                            lastHeartbeat: new Date()
                        };

                        // Only set ACTIVE if device is already approved (not PENDING)
                        const existingDevice = await Device.findOne({ deviceMAC: message.deviceId });
                        if (existingDevice && existingDevice.status !== 'PENDING') {
                            updateFields.status = 'ACTIVE';
                        }

                        await Device.findOneAndUpdate(
                            { deviceMAC: message.deviceId },
                            { $set: updateFields }
                        );
                        console.log(`✓ Auto-updated IP for ${message.deviceId} -> ${message.ipAddress}`);

                        if (this.io) {
                            this.io.emit('camera-ip-update', {
                                deviceMAC: message.deviceId,
                                ipAddress: message.ipAddress,
                                streamURL: actualStreamURL
                            });
                        }
                    } catch (err) {
                        console.error('❌ Failed to auto-update device IP:', err);
                    }
                }

                ws.send(JSON.stringify({ type: 'REGISTERED', success: true }));
                break;

            case 'FRAME':
                const camera = this.cameras.get(message.deviceId);
                if (camera) camera.lastFrameMetadata = message;
                break;
        }
    }

    async handleBinaryFrame(deviceId, frameData) {
        if (!deviceId) {
            console.warn('⚠️ Binary frame received but no deviceId set (REGISTER not received yet)');
            return;
        }
        const camera = this.cameras.get(deviceId);
        if (!camera) {
            console.warn(`⚠️ Binary frame for unknown device: ${deviceId}`);
            return;
        }

        // Track frame stats
        this.totalFramesReceived++;

        // Store latest frame
        camera.lastFrame = frameData;
        camera.lastFrameTime = Date.now();
        const frameId = `${deviceId}_${camera.lastFrameTime}`;

        // Periodic status log (every 30 seconds)
        if (Date.now() - this.lastStatusLog > 30000) {
            console.log(`📊 [Camera Status] Frames received: ${this.totalFramesReceived}, Processed: ${this.totalFramesProcessed}, Model loaded: ${this.modelsLoaded}, Connected cameras: ${this.cameras.size}`);
            this.lastStatusLog = Date.now();
        }

        // SKIP processing if models aren't ready OR if we're already processing a frame for this camera
        // This prevents CPU overload from 10FPS stream
        if (!this.modelsLoaded || camera.isProcessing) {
            if (!this.modelsLoaded && this.totalFramesReceived % 100 === 1) {
                console.warn('⚠️ YOLO model not loaded — broadcasting frames with faceCount=0');
            }
            // Just broadcast basic info without face count update
            this.broadcastFrame(deviceId, camera, frameData, camera.faceCount || 0);
            return;
        }

        camera.isProcessing = true;

        // Use YOLO Service
        yoloFaceService.detect(frameData).then(detectedFaces => {
            camera.faceCount = detectedFaces;
            camera.isProcessing = false;
            this.totalFramesProcessed++;

            if (detectedFaces > 0) {
                console.log(`🔍 YOLO detected ${detectedFaces} face(s) [device: ${deviceId}]`);
            }

            // Record in logic service
            tailgatingDetection.recordFaceDetection(
                deviceId,
                detectedFaces,
                camera.lastFrameTime,
                frameId
            );

            // Broadcast update
            this.broadcastFrame(deviceId, camera, frameData, detectedFaces);
        }).catch(err => {
            console.error('❌ Face detection error:', err.message);
            camera.isProcessing = false;
        });
    }

    broadcastFrame(deviceId, camera, frameData, faceCount) {
        if (this.io) {
            const connectedSockets = this.io.engine?.clientsCount || 0;
            this.io.emit('camera:frame', {
                deviceId: deviceId,
                cameraId: camera.cameraId,
                timestamp: camera.lastFrameTime,
                frameSize: frameData.length,
                faceCount: faceCount
                // frameBuffer removed - frontend uses direct stream
            });
        }
    }

    // ... (Alarm methods remain matching original logic) ...

    triggerAlarm(deviceId, faceCount) {
        const camera = this.cameras.get(deviceId);
        if (camera && camera.socket.readyState === 1) {
            camera.socket.send(JSON.stringify({
                type: 'TRIGGER_ALARM',
                deviceId: deviceId,
                reason: `${faceCount} people detected`,
                timestamp: Date.now()
            }));

            if (this.io) {
                this.io.emit('security:alert', {
                    type: 'TAILGATING',
                    deviceId: deviceId,
                    faceCount: faceCount,
                    timestamp: Date.now()
                });
            }
            console.log(`🚨 Alarm triggered on camera ${deviceId}`);
        }
    }

    stopAlarm(deviceId) {
        const camera = this.cameras.get(deviceId);
        if (camera && camera.socket.readyState === 1) {
            camera.socket.send(JSON.stringify({ type: 'STOP_ALARM', deviceId, timestamp: Date.now() }));
            console.log(`✓ Alarm stopped on camera ${deviceId}`);
        }
    }

    getConnectedCameras() {
        const cameras = [];
        this.cameras.forEach((camera, deviceId) => {
            cameras.push({
                deviceId,
                cameraId: camera.cameraId,
                connected: camera.socket.readyState === 1,
                lastFrameTime: camera.lastFrameTime,
                faceCount: camera.faceCount || 0
            });
        });
        return cameras;
    }

    setSocketIo(io) { this.io = io; }

    setupTailgatingListeners() {
        // Only react to IR-beam-confirmed tailgating (not camera-only signals)
        tailgatingDetection.on('tailgatingDetected', (alarm) => {
            console.log(`🚨 Tailgating alarm received (IR-confirmed):`, alarm);
            this.triggerAlarm(alarm.deviceId, alarm.actualPassed);
            if (this.io) this.io.emit('security:tailgating', alarm);
        });

        // extraFacesDetected and unauthorizedEntry are handled at the server level (index.js via MQTT)
        // Camera service does NOT trigger alarms based on face count alone
    }
}

export default new CameraStreamService();
