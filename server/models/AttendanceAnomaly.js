import mongoose from 'mongoose';

const attendanceAnomalySchema = new mongoose.Schema({
    // Reference to attendance record
    attendanceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Attendance',
        required: true
    },

    // Reference to user
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // Anomaly detection timestamp
    detectedAt: {
        type: Date,
        default: Date.now,
        index: true
    },

    // Attendance date
    attendanceDate: {
        type: Date,
        required: true,
        index: true
    },

    // Anomaly score (0-1, higher = more anomalous)
    anomalyScore: {
        type: Number,
        required: true,
        min: 0,
        max: 1
    },

    // Detection threshold used
    threshold: {
        type: Number,
        required: true
    },

    // Anomaly types
    anomalyTypes: [{
        type: String,
        enum: [
            'time_anomaly',
            'device_anomaly',
            'frequency_anomaly',
            'pattern_anomaly',
            'general_anomaly'
        ]
    }],

    // Human-readable reason
    reason: {
        type: String,
        required: true
    },

    // Detailed explanation
    details: [{
        type: String
    }],

    // Severity classification
    severity: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium',
        index: true
    },

    // Device information
    deviceId: {
        type: String
    },

    // Features at time of detection
    features: {
        arrival_time_in_minutes: Number,
        day_of_week: Number,
        time_difference_from_user_average: Number,
        days_since_last_attendance: Number,
        device_consistency_score: Number,
        hour_of_day: Number,
        is_weekend: Number,
        attendance_frequency: Number
    },

    // Status tracking
    status: {
        type: String,
        enum: ['new', 'reviewed', 'resolved', 'false_positive'],
        default: 'new',
        index: true
    },

    // Review information
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    reviewedAt: {
        type: Date
    },

    reviewNotes: {
        type: String
    }
}, {
    timestamps: true
});

// Indexes for efficient querying
attendanceAnomalySchema.index({ user: 1, detectedAt: -1 });
attendanceAnomalySchema.index({ attendanceDate: -1 });
attendanceAnomalySchema.index({ anomalyScore: -1 });
attendanceAnomalySchema.index({ status: 1, severity: -1 });

// Virtual for user name
attendanceAnomalySchema.virtual('userName', {
    ref: 'User',
    localField: 'user',
    foreignField: '_id',
    justOne: true
});

// Ensure virtuals are included in JSON
attendanceAnomalySchema.set('toJSON', { virtuals: true });
attendanceAnomalySchema.set('toObject', { virtuals: true });

const AttendanceAnomaly = mongoose.model('AttendanceAnomaly', attendanceAnomalySchema);

export default AttendanceAnomaly;
