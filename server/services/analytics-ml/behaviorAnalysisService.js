import MLInsights from '../../models/MLInsights.js';
import Attendance from '../../models/Attendance.js';
import User from '../../models/User.js';

class BehaviorAnalysisService {
    constructor() {
        this.clusterProfiles = {
            0: 'Always Early',
            1: 'Consistent & Punctual', 
            2: 'Often Late',
            3: 'Irregular Pattern',
            4: 'Weekend Active'
        };
    }

    /**
     * Analyze attendance behavior patterns for a specific user
     */
    async analyzeUserBehavior(userId, timeframe = 30) {
        try {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - timeframe);

            // Get user attendance data
            const attendanceData = await Attendance.find({
                user: userId,
                timestamp: { $gte: startDate, $lte: endDate }
            }).sort({ timestamp: -1 });

            if (attendanceData.length === 0) {
                return this.getDefaultBehaviorProfile(userId);
            }

            // Calculate behavior patterns
            const behaviorPatterns = {
                punctualityScore: this.calculatePunctuality(attendanceData),
                consistencyScore: this.calculateConsistency(attendanceData),
                frequencyScore: this.calculateFrequency(attendanceData, timeframe),
                peakTimePreference: this.findPeakTime(attendanceData),
                weekendActivity: this.calculateWeekendActivity(attendanceData),
                behaviorCluster: await this.assignBehaviorCluster(attendanceData)
            };

            // Calculate risk assessment
            const riskAssessment = {
                absenteeismRisk: this.calculateAbsenteeismRisk(behaviorPatterns),
                lateArrivalRisk: this.calculateLateArrivalRisk(behaviorPatterns),
                irregularityScore: this.calculateIrregularityScore(behaviorPatterns),
                confidenceLevel: this.calculateConfidenceLevel(attendanceData.length)
            };

            // Generate predictions
            const predictions = {
                nextWeekAttendance: this.predictNextWeekAttendance(behaviorPatterns),
                expectedArrivalTime: this.predictArrivalTime(attendanceData),
                absenceAlert: riskAssessment.absenteeismRisk > 0.7
            };

            // Save or update ML insights
            await this.saveBehaviorInsights(userId, {
                behaviorPatterns,
                riskAssessment,
                predictions
            });

            return {
                success: true,
                userId,
                analysisDate: new Date(),
                behaviorPatterns,
                riskAssessment,
                predictions,
                clusterProfile: this.clusterProfiles[behaviorPatterns.behaviorCluster]
            };

        } catch (error) {
            console.error('Error analyzing user behavior:', error);
            throw error;
        }
    }

    /**
     * Calculate punctuality score (0-1)
     */
    calculatePunctuality(attendanceData) {
        if (attendanceData.length === 0) return 0;
        
        const onTimeCount = attendanceData.filter(record => record.status === 'present').length;
        return Math.min(onTimeCount / attendanceData.length, 1);
    }

    /**
     * Calculate consistency score based on timing patterns
     */
    calculateConsistency(attendanceData) {
        if (attendanceData.length < 2) return 0;
        
        const arrivalTimes = attendanceData.map(record => {
            const hour = new Date(record.timestamp).getHours();
            const minute = new Date(record.timestamp).getMinutes();
            return hour + minute / 60;
        });
        
        const mean = arrivalTimes.reduce((sum, time) => sum + time, 0) / arrivalTimes.length;
        const variance = arrivalTimes.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / arrivalTimes.length;
        const stdDev = Math.sqrt(variance);
        
        // Lower standard deviation = higher consistency
        return Math.max(0, 1 - (stdDev / 4)); // Normalize to 0-1
    }

    /**
     * Calculate attendance frequency score
     */
    calculateFrequency(attendanceData, timeframeDays) {
        const expectedDays = Math.min(timeframeDays, 30); // Assume max 30 working days
        return Math.min(attendanceData.length / expectedDays, 1);
    }

    /**
     * Find user's preferred attendance time
     */
    findPeakTime(attendanceData) {
        if (attendanceData.length === 0) return 9; // Default to 9 AM
        
        const hourCounts = {};
        attendanceData.forEach(record => {
            const hour = new Date(record.timestamp).getHours();
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        });
        
        return parseInt(Object.keys(hourCounts).reduce((a, b) => hourCounts[a] > hourCounts[b] ? a : b));
    }

    /**
     * Calculate weekend activity rate
     */
    calculateWeekendActivity(attendanceData) {
        const weekendRecords = attendanceData.filter(record => {
            const dayOfWeek = new Date(record.timestamp).getDay();
            return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
        });
        
        const weekdayRecords = attendanceData.length - weekendRecords.length;
        return weekdayRecords > 0 ? weekendRecords.length / weekdayRecords : 0;
    }

    /**
     * Assign behavior cluster using simple heuristics
     */
    async assignBehaviorCluster(attendanceData) {
        if (attendanceData.length === 0) return 3; // Irregular pattern
        
        const avgArrivalHour = attendanceData.reduce((sum, record) => {
            return sum + new Date(record.timestamp).getHours();
        }, 0) / attendanceData.length;
        
        const lateRate = attendanceData.filter(record => record.status === 'late').length / attendanceData.length;
        
        // Simple clustering logic
        if (avgArrivalHour < 8 && lateRate < 0.1) return 0; // Always Early
        if (lateRate < 0.2 && avgArrivalHour >= 8 && avgArrivalHour <= 10) return 1; // Consistent & Punctual
        if (lateRate > 0.5) return 2; // Often Late
        if (attendanceData.length < 10) return 3; // Irregular Pattern
        return 4; // Weekend Active (fallback)
    }

    /**
     * Calculate absenteeism risk score
     */
    calculateAbsenteeismRisk(patterns) {
        let risk = 0;
        
        // Low frequency increases risk
        if (patterns.frequencyScore < 0.5) risk += 0.3;
        if (patterns.frequencyScore < 0.3) risk += 0.2;
        
        // Irregular patterns increase risk
        if (patterns.consistencyScore < 0.5) risk += 0.2;
        
        // Poor punctuality increases risk
        if (patterns.punctualityScore < 0.7) risk += 0.3;
        
        return Math.min(risk, 1);
    }

    /**
     * Calculate late arrival risk score
     */
    calculateLateArrivalRisk(patterns) {
        let risk = 1 - patterns.punctualityScore;
        
        // Inconsistent timing increases risk
        if (patterns.consistencyScore < 0.5) risk += 0.2;
        
        return Math.min(risk, 1);
    }

    /**
     * Calculate irregularity score
     */
    calculateIrregularityScore(patterns) {
        return 1 - patterns.consistencyScore;
    }

    /**
     * Calculate confidence level based on data points
     */
    calculateConfidenceLevel(dataPoints) {
        if (dataPoints < 5) return 0.3;
        if (dataPoints < 10) return 0.6;
        if (dataPoints < 20) return 0.8;
        return 0.95;
    }

    /**
     * Predict next week attendance
     */
    predictNextWeekAttendance(patterns) {
        const baseAttendance = patterns.frequencyScore * 5; // 5 working days
        const riskReduction = (1 - patterns.punctualityScore) * 0.5;
        return Math.max(Math.round(baseAttendance - riskReduction), 0);
    }

    /**
     * Predict expected arrival time
     */
    predictArrivalTime(attendanceData) {
        if (attendanceData.length === 0) return '09:00';
        
        const avgMinutes = attendanceData.reduce((sum, record) => {
            const date = new Date(record.timestamp);
            return sum + (date.getHours() * 60 + date.getMinutes());
        }, 0) / attendanceData.length;
        
        const hours = Math.floor(avgMinutes / 60);
        const minutes = Math.round(avgMinutes % 60);
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    /**
     * Save behavior insights to database
     */
    async saveBehaviorInsights(userId, insights) {
        try {
            await MLInsights.findOneAndUpdate(
                { userId, analysisDate: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
                {
                    userId,
                    analysisDate: new Date(),
                    ...insights,
                    lastUpdated: new Date()
                },
                { upsert: true, new: true }
            );
        } catch (error) {
            console.error('Error saving behavior insights:', error);
            throw error;
        }
    }

    /**
     * Get default behavior profile for new users
     */
    getDefaultBehaviorProfile(userId) {
        return {
            success: true,
            userId,
            analysisDate: new Date(),
            behaviorPatterns: {
                punctualityScore: 0.5,
                consistencyScore: 0.5,
                frequencyScore: 0,
                peakTimePreference: 9,
                weekendActivity: 0,
                behaviorCluster: 3
            },
            riskAssessment: {
                absenteeismRisk: 0.5,
                lateArrivalRisk: 0.5,
                irregularityScore: 0.8,
                confidenceLevel: 0.1
            },
            predictions: {
                nextWeekAttendance: 2,
                expectedArrivalTime: '09:00',
                absenceAlert: false
            },
            clusterProfile: 'New User'
        };
    }

    /**
     * Analyze all users and return behavior clusters
     */
    async analyzeAllUsersBehavior() {
        try {
            const users = await User.find({ fingerprintId: { $ne: null } });
            const clusterData = {};
            
            for (const user of users) {
                const behavior = await this.analyzeUserBehavior(user._id);
                const cluster = behavior.clusterProfile;
                
                if (!clusterData[cluster]) {
                    clusterData[cluster] = [];
                }
                
                clusterData[cluster].push({
                    userId: user._id,
                    username: user.username,
                    punctuality: behavior.behaviorPatterns.punctualityScore,
                    consistency: behavior.behaviorPatterns.consistencyScore,
                    risk: behavior.riskAssessment.absenteeismRisk
                });
            }
            
            return clusterData;
        } catch (error) {
            console.error('Error analyzing all users behavior:', error);
            throw error;
        }
    }
}

export default new BehaviorAnalysisService();