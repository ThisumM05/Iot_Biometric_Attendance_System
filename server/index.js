import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Import Routes
import rabbitMQService from './services/rabbitmq/rabbitMQService.js';
import mqttBridgeService from './services/mqtt/mqttBridgeService.js';
import authRoutes from './routes/auth/authRoutes.js';
import userRoutes from './routes/users/userRoutes.js';
import attendanceRoutes from './routes/attendance/attendanceRoutes.js';
import settingsRoutes from './routes/settings/settingsRoutes.js';
import dashboardRoutes from './routes/dashboard/dashboardRoutes.js';
import analyticsRoutes from './routes/analytics/analyticsRoutes.js';
import mlRoutes from './routes/ml/mlRoutes.js';
import occupancyRoutes from './routes/occupancy/occupancyRoutes.js';
import deviceRoutes from './routes/devices/deviceRoutes.js';
import templateSyncRoutes from './routes/sync/templateSyncRoutes.js';
import syncVerificationRoutes from './routes/sync/syncVerificationRoutes.js';
import cameraRoutes from './routes/cameras/cameraRoutes.js';
import irBeamRoutes from './routes/api/irBeamRoutes.js';

// Import Services
import deviceHealthService from './services/device/deviceHealthService.js';
import deviceRegistrationService from './services/device/deviceRegistrationService.js';
import cameraStreamService from './services/camera/cameraStreamService.js';
import templateSyncService from './services/sync/templateSyncService.js';
import syncVerificationService from './services/sync/syncVerificationService.js';
import tailgatingDetection from './services/accessControl/tailgatingDetection.js';
import occupancyService from './services/occupancy-state/occupancyService.js';

// Middleware
app.use(cors({
    origin: "http://localhost:5173", // Explicit Vite dev server URL
    credentials: true
}));
app.use(express.json());

// Logging middleware for all requests
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    const method = req.method;
    const url = req.originalUrl;
    const ip = req.ip || req.connection.remoteAddress || 'Unknown';

    // Only log auth-related endpoints to avoid spam
    if (url.includes('/api/auth/') || url.includes('/api/rabbitmq/')) {
        console.log(`${method} ${url} | ${timestamp} | ${ip}`);
    }

    next();
});

// Routes
app.get('/', (req, res) => {
    res.json({
        message: 'IoT Biometric Attendance System Server is running',
        status: 'OK',
        timestamp: new Date().toISOString()
    });
});

// Authentication routes
app.use('/api/auth', authRoutes);
// User routes
app.use('/api/users', userRoutes);
// Attendance routes
app.use('/api/attendance', attendanceRoutes);
// Settings routes
app.use('/api/settings', settingsRoutes);
// Dashboard routes
app.use('/api/dashboard', dashboardRoutes);
// Analytics routes
app.use('/api/analytics', analyticsRoutes);
// ML routes
app.use('/api/ml', mlRoutes);
// Occupancy tracking routes
app.use('/api/occupancy', occupancyRoutes);
// Device management routes
app.use('/api/devices', deviceRoutes);
// Template synchronization routes
app.use('/api/sync', templateSyncRoutes);
// Sync verification routes  
app.use('/api/sync', syncVerificationRoutes);
// Camera routes
app.use('/api/cameras', cameraRoutes);
// IR Beam Sensor routes (for tailgating detection)
app.use('/api/ir-beam', irBeamRoutes);

// Database Connection
const connectDB = async () => {
    if (!process.env.MONGODB_URI) {
        console.log('MongoDB URI not provided - running without database');
        return;
    }

    const tryConnect = async () => {
        try {
            await mongoose.connect(process.env.MONGODB_URI);
            console.log('✓ MongoDB Connected Successfully');
            return true;
        } catch (error) {
            console.error('MongoDB connection error:', error.message);
            return false;
        }
    };

    const connected = await tryConnect();
    if (!connected) {
        console.log('⏳ Will retry MongoDB connection every 15 seconds...');
        const retryInterval = setInterval(async () => {
            console.log('🔄 Retrying MongoDB connection...');
            const success = await tryConnect();
            if (success) {
                clearInterval(retryInterval);
                console.log('✓ MongoDB reconnected! Database operations will now work.');
            }
        }, 15000);
    }
};

// Connect to database
connectDB().then(() => {
    // Initialize occupancy service after DB connection
    occupancyService.initialize();
});

// Start RabbitMQ Service (for internal AMQP communication)
rabbitMQService.connect();

// Start MQTT Bridge Service (for ESP32 communication)
mqttBridgeService.connect();

import { createServer } from 'http';
import { Server } from 'socket.io';

// Create HTTP server needed for Socket.io
const httpServer = createServer(app);
const io = new Server(httpServer, {
    path: '/socket.io/', // Explicit path for Socket.io
    cors: {
        origin: ["http://localhost:5173", "http://localhost:5174"], // Support both ports
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling'], // Support both transports
    allowEIO3: true, // Support older clients if needed
    pingTimeout: 60000,
    pingInterval: 25000,
    connectTimeout: 45000
});

// Pass Socket.io to services
rabbitMQService.setSocketIo(io);
mqttBridgeService.setSocketIo(io);
deviceHealthService.setSocketIo(io);
deviceRegistrationService.setSocketIo(io);
deviceRegistrationService.setMqttBridge(mqttBridgeService);
cameraStreamService.setSocketIo(io);
templateSyncService.setSocketIo(io);
tailgatingDetection.setSocketIo(io);

// Wire alarm event handlers — send TRIGGER_ALARM to EXIT NODE buzzer
tailgatingDetection.on('tailgatingDetected', (alarm) => {
    console.log(`🚨 [Alarm Dispatch] Tailgating detected! Sending TRIGGER_ALARM to all EXIT devices`);
    mqttBridgeService.publishCommand({
        action: 'TRIGGER_ALARM',
        targetDeviceMAC: 'ALL',
        reason: alarm.reason,
        clusterId: alarm.clusterId,
        type: 'TAILGATING',
        timestamp: Date.now()
    });

    // Auto-stop alarm after 10 seconds
    setTimeout(() => {
        mqttBridgeService.publishCommand({
            action: 'STOP_ALARM',
            targetDeviceMAC: 'ALL',
            timestamp: Date.now()
        });
        io.emit('security:alarm_stop', { type: 'TAILGATING', timestamp: Date.now() });
    }, 10000);
});

tailgatingDetection.on('unauthorizedEntry', (alert) => {
    console.log(`🚨 [Alarm Dispatch] Unauthorized entry! Sending TRIGGER_ALARM`);
    mqttBridgeService.publishCommand({
        action: 'TRIGGER_ALARM',
        targetDeviceMAC: 'ALL',
        reason: alert.reason,
        clusterId: alert.clusterId,
        type: 'UNAUTHORIZED_ENTRY',
        timestamp: Date.now()
    });

    // Auto-stop alarm after 10 seconds
    setTimeout(() => {
        mqttBridgeService.publishCommand({
            action: 'STOP_ALARM',
            targetDeviceMAC: 'ALL',
            timestamp: Date.now()
        });
        io.emit('security:alarm_stop', { type: 'UNAUTHORIZED_ENTRY', timestamp: Date.now() });
    }, 10000);
});

// Initialize sync verification service with cron job
syncVerificationService.initialize(io);

// Initialize Camera WebSocket Server
cameraStreamService.initialize(httpServer);

// Make Socket.io available to controllers via app
app.set('io', io);

// Start device health monitoring (checks every 60 seconds)
deviceHealthService.startAutoOfflineDetection(60000);

// Socket.io error handling
io.engine.on('connection_error', (err) => {
    console.error('Socket.io connection error:', {
        code: err.code,
        message: err.message,
        context: err.context
    });
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('✓ Socket.io client connected:', socket.id);

    // Join occupancy monitoring room
    socket.on('join:occupancy', () => {
        socket.join('occupancy-monitor');
        console.log('Client joined occupancy monitoring room:', socket.id);
    });

    socket.on('disconnect', () => {
        console.log('✗ Socket.io client disconnected:', socket.id);
    });

    socket.on('error', (error) => {
        console.error('Socket.io error:', error);
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Something went wrong!'
    });
});

httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
