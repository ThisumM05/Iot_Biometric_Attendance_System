import mongoose from 'mongoose';

const OccupancyLogSchema = new mongoose.Schema({
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    personCount: {
        type: Number,
        required: true,
        min: 0
    },
    previousCount: {
        type: Number,
        required: true,
        min: 0
    },
    eventType: {
        type: String,
        enum: ['ENTRY', 'EXIT', 'NO_CHANGE'],
        required: true
    },
    deviceId: {
        type: String,
        required: true
    },
    location: {
        type: String,
        default: 'Main Office'
    },
    alertTriggered: {
        type: Boolean,
        default: false
    },
    alertSeverity: {
        type: String,
        enum: ['NONE', 'WARNING', 'CRITICAL'],
        default: 'NONE'
    },
    alertMessage: {
        type: String
    },
    fingerprintScanAttempt: {
        type: Boolean,
        default: false
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    snapshotMetadata: {
        imageUrl: String,
        confidence: Number,
        detectionBox: {
            x: Number,
            y: Number,
            width: Number,
            height: Number
        }
    },
    resolved: {
        type: Boolean,
        default: false
    },
    resolvedAt: {
        type: Date
    },
    resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    notes: {
        type: String
    }
}, {
    timestamps: true
});

// Index for efficient queries
OccupancyLogSchema.index({ timestamp: -1 });
OccupancyLogSchema.index({ alertTriggered: 1, resolved: 1 });
OccupancyLogSchema.index({ deviceId: 1, timestamp: -1 });

export default mongoose.model('OccupancyLog', OccupancyLogSchema);
