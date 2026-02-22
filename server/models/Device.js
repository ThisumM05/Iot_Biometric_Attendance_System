import mongoose from 'mongoose';

const deviceSchema = new mongoose.Schema({
    deviceMAC: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    deviceType: {
        type: String,
        enum: ['ESP32', 'ESP32-CAM'],
        required: true
    },
    clusterID: {
        type: String,
        required: false,
        index: true
    },
    deviceRole: {
        type: String,
        enum: ['ENTRY', 'EXIT'],
        required: false
    },
    scannerID: {
        type: String,
        required: false
    },
    location: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'OFFLINE', 'MAINTENANCE', 'PENDING'],
        default: 'PENDING'
    },
    capabilities: [{
        type: String,
        enum: ['fingerprint', 'camera', 'buzzer', 'relay']
    }],
    firmwareVersion: {
        type: String,
        default: '1.0.0'
    },
    ipAddress: {
        type: String,
        default: null
    },
    streamURL: {
        type: String,
        default: null
    },
    snapshotURL: {
        type: String,
        default: null
    },
    lastHeartbeat: {
        type: Date,
        default: null
    },
    registeredAt: {
        type: Date,
        default: Date.now
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    healthMetrics: {
        uptime: {
            type: Number,
            default: 0
        },
        wifiSignal: {
            type: Number,
            default: 0
        },
        freeHeap: {
            type: Number,
            default: 0
        },
        fpSensorStatus: {
            type: String,
            default: 'UNKNOWN'
        },
        cameraStatus: {
            type: String,
            default: 'UNKNOWN'
        },
        relayStatus: {
            type: String,
            default: 'UNKNOWN'
        },
        doorLockState: {
            type: String,
            enum: ['LOCKED', 'UNLOCKED', 'UNKNOWN'],
            default: 'UNKNOWN'
        },
        lastScanTime: {
            type: Date,
            default: null
        }
    }
}, {
    timestamps: true
});

// Index for faster queries
deviceSchema.index({ clusterID: 1, status: 1 });
deviceSchema.index({ status: 1 });

// Virtual for time since last heartbeat
deviceSchema.virtual('minutesSinceHeartbeat').get(function () {
    if (!this.lastHeartbeat) return null;
    return Math.floor((Date.now() - this.lastHeartbeat.getTime()) / 60000);
});

// Method to check if device is online
deviceSchema.methods.isOnline = function () {
    if (!this.lastHeartbeat) return false;
    const minutesSince = Math.floor((Date.now() - this.lastHeartbeat.getTime()) / 60000);
    return minutesSince < 2; // Consider offline after 2 minutes
};

export default mongoose.model('Device', deviceSchema);
