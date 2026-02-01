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
import authRoutes from './routes/auth/authRoutes.js';
import userRoutes from './routes/users/userRoutes.js';
import attendanceRoutes from './routes/attendance/attendanceRoutes.js';
import settingsRoutes from './routes/settings/settingsRoutes.js';

// Middleware
app.use(cors({
    origin: process.env.DASHBOARD_URL, // Vite dev server
    credentials: true
}));
app.use(express.json());

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
        console.error('MongoDB connection error:', error);
        process.exit(1);
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
