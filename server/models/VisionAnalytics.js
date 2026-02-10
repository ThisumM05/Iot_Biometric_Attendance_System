import mongoose from 'mongoose';

const VisionAnalyticsSchema = new mongoose.Schema({
    deviceId: {
        type: String,
        required: true,
        index: true
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    personDetections: [{
        boundingBox: {
            x: Number,
            y: Number,
            width: Number,
            height: Number
        },
        confidence: { type: Number, min: 0, max: 1 },
        trackingId: String // For person tracking across frames
    }],
    occupancyData: {
        personCount: { type: Number, default: 0 },
        occupancyLevel: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
        capacityUtilization: { type: Number, min: 0, max: 1 } // percentage
    },
    motionAnalysis: {
        movementDetected: { type: Boolean, default: false },
        crowdFlow: { type: String, enum: ['entry', 'exit', 'static', 'mixed'] },
        activityLevel: { type: Number, min: 0, max: 1 }
    },
    environmentalFactors: {
        lightingCondition: { type: String, enum: ['good', 'poor', 'dark'] },
        imageQuality: { type: Number, min: 0, max: 1 },
        weatherCondition: String // optional
    },
    correlationData: {
        biometricEventId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'Attendance',
            sparse: true 
        },
        correlationConfidence: { type: Number, min: 0, max: 1 },
        matchedPersons: [{ 
            detectionId: String,
            userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            matchConfidence: Number
        }]
    },
    processedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes for performance and queries
VisionAnalyticsSchema.index({ deviceId: 1, timestamp: -1 });
VisionAnalyticsSchema.index({ timestamp: -1, 'occupancyData.personCount': -1 });
VisionAnalyticsSchema.index({ 'correlationData.biometricEventId': 1 });

// TTL index - vision data expires after 30 days
VisionAnalyticsSchema.index({ "createdAt": 1 }, { expireAfterSeconds: 2592000 });

const VisionAnalytics = mongoose.model('VisionAnalytics', VisionAnalyticsSchema);

export default VisionAnalytics;