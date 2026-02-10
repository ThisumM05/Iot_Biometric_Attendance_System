import mongoose from 'mongoose';

const AnalyticsCacheSchema = new mongoose.Schema({
    analysisDate: {
        type: Date,
        required: true,
        index: true,
        unique: true
    },
    attendanceMetrics: {
        totalAttendance: { type: Number, default: 0 },
        onTimeRate: { type: Number, default: 0 },
        lateRate: { type: Number, default: 0 },
        absentRate: { type: Number, default: 0 },
        peakHours: [{ hour: Number, count: Number }],
        averageArrivalTime: { type: String, default: '09:00' }
    },
    temporalTrends: {
        dailyPattern: [{ hour: Number, attendanceCount: Number }],
        weeklyPattern: [{ day: Number, attendanceRate: Number }],
        monthlyTrend: { type: Number, default: 0 }, // percentage change
        seasonalFactors: { type: Map, of: Number }
    },
    predictions: {
        nextDayAttendance: { type: Number, default: 0 },
        nextWeekTrend: { type: Number, default: 0 },
        expectedPeakTime: { type: String, default: '09:00' },
        confidenceInterval: { lower: Number, upper: Number }
    },
    anomalies: [{
        type: { type: String, enum: ['behavioral', 'temporal', 'device', 'security'] },
        severity: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
        description: String,
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        detectedAt: { type: Date, default: Date.now },
        resolved: { type: Boolean, default: false }
    }],
    visionAnalytics: {
        averageOccupancy: { type: Number, default: 0 },
        peakOccupancy: { type: Number, default: 0 },
        entryExitRatio: { type: Number, default: 0 },
        crowdFlowPatterns: [{ time: String, flow: Number }]
    },
    generatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// TTL index - cache expires after 7 days
AnalyticsCacheSchema.index({ "createdAt": 1 }, { expireAfterSeconds: 604800 });

const AnalyticsCache = mongoose.model('AnalyticsCache', AnalyticsCacheSchema);

export default AnalyticsCache;