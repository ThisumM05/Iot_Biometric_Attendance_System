import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load environment variables
dotenv.config();

// Debug: Check if Twilio credentials are loaded
console.log('🔍 Environment Check:');
console.log(`   TWILIO_ACCOUNT_SID: ${process.env.TWILIO_ACCOUNT_SID ? 'Set' : 'Missing'}`);
console.log(`   TWILIO_AUTH_TOKEN: ${process.env.TWILIO_AUTH_TOKEN ? 'Set' : 'Missing'}`);
console.log(`   TWILIO_WHATSAPP_FROM: ${process.env.TWILIO_WHATSAPP_FROM || 'Missing'}`);

const app = express();
const PORT = process.env.PORT || 5000;

// Import Routes
import rabbitMQService from './services/rabbitmq/rabbitMQService.js';
import authRoutes from './routes/auth/authRoutes.js';
import userRoutes from './routes/users/userRoutes.js';
import attendanceRoutes from './routes/attendance/attendanceRoutes.js';
import settingsRoutes from './routes/settings/settingsRoutes.js';
import dashboardRoutes from './routes/dashboard/dashboardRoutes.js';
import analyticsRoutes from './routes/analytics/analyticsRoutes.js';
import mlRoutes from './routes/ml/mlRoutes.js';
import occupancyRoutes from './routes/occupancy/occupancyRoutes.js';
import notificationRoutes from './routes/notifications/notificationRoutes.js';
import whatsappService from './services/notification/whatsappService.js';

// Middleware
app.use(cors({
    origin: process.env.DASHBOARD_URL, // Vite dev server
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
// Notification routes (WhatsApp, Email, SMS)
app.use('/api/notifications', notificationRoutes);

// Database Connection
const connectDB = async () => {
    try {
        if (process.env.MONGODB_URI) {
            await mongoose.connect(process.env.MONGODB_URI);
            console.log('MongoDB Connected Successfully');
        } else {
            console.log('MongoDB URI not provided - running without database');
        }
    } catch (error) {
        console.error('MongoDB connection error:', error.message);
        console.log('Running server without database connection...');
        console.log('To fix this:');
        console.log('1. Install MongoDB: https://www.mongodb.com/try/download/community');
        console.log('2. Or update MONGODB_URI in .env to a working connection string');
    }
};

// Connect to database
connectDB();

// Start RabbitMQ Service
rabbitMQService.connect();

import { createServer } from 'http';
import { Server } from 'socket.io';

// Create HTTP server needed for Socket.io
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: process.env.DASHBOARD_URL,
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Pass Socket.io to RabbitMQ Service
rabbitMQService.setSocketIo(io);

// Make Socket.io available to controllers via app
app.set('io', io);

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Join occupancy monitoring room
    socket.on('join:occupancy', () => {
        socket.join('occupancy-monitor');
        console.log('Client joined occupancy monitoring room:', socket.id);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
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

    // Re-initialize WhatsApp service to ensure environment variables are loaded
    console.log('🔄 Re-initializing WhatsApp service...');
    whatsappService.reinitialize();
});
