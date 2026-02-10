import mongoose from 'mongoose';

const MLInsightsSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    analysisDate: {
        type: Date,
        default: Date.now,
        index: true
    },
    behaviorPatterns: {
        punctualityScore: { type: Number, default: 0 }, // 0-1 score
        consistencyScore: { type: Number, default: 0 }, // 0-1 score
        frequencyScore: { type: Number, default: 0 },   // attendance frequency
        peakTimePreference: { type: Number, default: 9 }, // preferred hour
        weekendActivity: { type: Number, default: 0 },  // weekend attendance rate
        behaviorCluster: { type: Number, default: 0 }   // cluster assignment
    },
    riskAssessment: {
        absenteeismRisk: { type: Number, default: 0 },  // 0-1 risk score
        lateArrivalRisk: { type: Number, default: 0 },  // 0-1 risk score
        irregularityScore: { type: Number, default: 0 }, // pattern deviation
        confidenceLevel: { type: Number, default: 0 }   // prediction confidence
    },
    predictions: {
        nextWeekAttendance: { type: Number, default: 0 }, // predicted days
        expectedArrivalTime: { type: String, default: '09:00' }, // HH:MM format
        absenceAlert: { type: Boolean, default: false } // high absence risk
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes for performance
MLInsightsSchema.index({ userId: 1, analysisDate: -1 });
MLInsightsSchema.index({ 'riskAssessment.absenteeismRisk': -1 });
MLInsightsSchema.index({ 'behaviorPatterns.behaviorCluster': 1 });

const MLInsights = mongoose.model('MLInsights', MLInsightsSchema);

export default MLInsights;