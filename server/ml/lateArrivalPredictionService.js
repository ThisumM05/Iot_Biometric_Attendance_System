import * as ss from 'simple-statistics';
import { Matrix } from 'ml-matrix';
import Attendance from '../models/Attendance.js';
import User from '../models/User.js';

class LateArrivalPredictionService {
    constructor() {
        this.model = null;
        this.features = [];
        this.labels = [];
        this.isModelTrained = false;
        this.featureNames = [
            'dayOfWeek',
            'previousDayLate',
            'avgLatenessPast7Days',
            'avgLatenessPast30Days',
            'consecutiveLateStreak',
            'totalLateCount',
            'attendanceRate',
            'seasonalFactor',
            'monthOfYear',
            'consecutiveOnTimeStreak'
        ];
    }

    /**
     * Load user attendance history for training
     */
    async loadUserAttendanceHistory(userId) {
        try {
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

            const userAttendance = await Attendance.find({
                user: userId,
                timestamp: { $gte: sixMonthsAgo },
                type: 'CHECK_IN' // Only check-in times for late analysis
            }).sort({ timestamp: 1 });

            if (userAttendance.length === 0) {
                console.log(`⚠️  No attendance history found for user ${userId}`);
                return [];
            }

            console.log(`📈 Loaded ${userAttendance.length} attendance records for user ${userId}`);

            return userAttendance.map(record => ({
                date: new Date(record.timestamp).toISOString().split('T')[0],
                checkInTime: record.timestamp,
                isLate: new Date(record.timestamp).getHours() >= 9, // 9 AM threshold
                dayOfWeek: new Date(record.timestamp).getDay(),
                month: new Date(record.timestamp).getMonth() + 1
            }));
        } catch (error) {
            console.error('❌ Error loading user attendance:', error);
            return [];
        }
    }

    /**
     * Extract features for a specific user and date
     */
    async extractUserFeatures(userId, targetDate) {
        try {
            const attendanceHistory = await this.loadUserAttendanceHistory(userId);

            if (attendanceHistory.length === 0) {
                // Return default features for new users
                return this.getDefaultFeatures(targetDate);
            }

            const targetDateObj = new Date(targetDate);
            const dayOfWeek = targetDateObj.getDay();
            const monthOfYear = targetDateObj.getMonth() + 1;

            // Sort records by date
            attendanceHistory.sort((a, b) => new Date(a.date) - new Date(b.date));

            // Calculate historical patterns
            const totalRecords = attendanceHistory.length;
            const lateRecords = attendanceHistory.filter(r => r.isLate);
            const totalLateCount = lateRecords.length;

            // Previous day late status
            const yesterday = new Date(targetDateObj);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayRecord = attendanceHistory.find(r => r.date === yesterday.toISOString().split('T')[0]);
            const previousDayLate = yesterdayRecord ? (yesterdayRecord.isLate ? 1 : 0) : 0;

            // Average lateness in past 7 days
            const sevenDaysAgo = new Date(targetDateObj);
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const recentRecords = attendanceHistory.filter(r => new Date(r.date) >= sevenDaysAgo);
            const avgLatenessPast7Days = recentRecords.length > 0 ?
                recentRecords.filter(r => r.isLate).length / recentRecords.length : 0;

            // Average lateness in past 30 days
            const thirtyDaysAgo = new Date(targetDateObj);
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const monthRecords = attendanceHistory.filter(r => new Date(r.date) >= thirtyDaysAgo);
            const avgLatenessPast30Days = monthRecords.length > 0 ?
                monthRecords.filter(r => r.isLate).length / monthRecords.length : 0;

            // Consecutive late streak
            let consecutiveLateStreak = 0;
            for (let i = attendanceHistory.length - 1; i >= 0; i--) {
                if (attendanceHistory[i].isLate) {
                    consecutiveLateStreak++;
                } else {
                    break;
                }
            }

            // Consecutive on-time streak
            let consecutiveOnTimeStreak = 0;
            for (let i = attendanceHistory.length - 1; i >= 0; i--) {
                if (!attendanceHistory[i].isLate) {
                    consecutiveOnTimeStreak++;
                } else {
                    break;
                }
            }

            // Attendance rate
            const attendanceRate = totalRecords / 30; // Assuming 30 days as baseline

            // Seasonal factor (day of week pattern)
            const sameDayRecords = attendanceHistory.filter(r => r.dayOfWeek === dayOfWeek);
            const seasonalFactor = sameDayRecords.length > 0 ?
                sameDayRecords.filter(r => r.isLate).length / sameDayRecords.length : avgLatenessPast30Days;

            return [
                dayOfWeek,
                previousDayLate,
                avgLatenessPast7Days,
                avgLatenessPast30Days,
                consecutiveLateStreak,
                totalLateCount,
                attendanceRate,
                seasonalFactor,
                monthOfYear,
                consecutiveOnTimeStreak
            ];

        } catch (error) {
            console.error('❌ Error extracting user features:', error);
            return this.getDefaultFeatures(targetDate);
        }
    }

    /**
     * Default features for users with no history
     */
    getDefaultFeatures(targetDate) {
        const targetDateObj = new Date(targetDate);
        return [
            targetDateObj.getDay(), // dayOfWeek
            0, // previousDayLate
            0.3, // avgLatenessPast7Days (average baseline)
            0.3, // avgLatenessPast30Days
            0, // consecutiveLateStreak
            0, // totalLateCount
            1.0, // attendanceRate
            0.3, // seasonalFactor
            targetDateObj.getMonth() + 1, // monthOfYear
            0 // consecutiveOnTimeStreak
        ];
    }

    /**
     * Simple Random Forest implementation for classification
     */
    trainRandomForest(features, labels, nTrees = 10) {
        const trees = [];
        const featureCount = features[0].length;
        const sampleSize = Math.floor(features.length * 0.8); // Bootstrap sampling

        for (let i = 0; i < nTrees; i++) {
            // Bootstrap sampling
            const indices = Array.from({ length: sampleSize }, () =>
                Math.floor(Math.random() * features.length));

            const bootstrapFeatures = indices.map(idx => features[idx]);
            const bootstrapLabels = indices.map(idx => labels[idx]);

            // Train decision tree
            const tree = this.trainDecisionTree(bootstrapFeatures, bootstrapLabels);
            trees.push(tree);
        }

        return {
            trees,
            predict: (newFeatures) => {
                const predictions = trees.map(tree => this.predictWithTree(tree, newFeatures));
                const avgPrediction = ss.mean(predictions);
                return Math.min(1, Math.max(0, avgPrediction)); // Clamp to [0,1]
            }
        };
    }

    /**
     * Simple decision tree implementation
     */
    trainDecisionTree(features, labels) {
        if (features.length === 0) return { prediction: 0.5 };

        const avgLabel = ss.mean(labels);

        if (features.length < 5 || this.allSameLabel(labels)) {
            return { prediction: avgLabel };
        }

        const bestSplit = this.findBestSplit(features, labels);
        if (!bestSplit) return { prediction: avgLabel };

        const { featureIndex, threshold } = bestSplit;

        // Split data
        const leftIndices = [];
        const rightIndices = [];

        for (let i = 0; i < features.length; i++) {
            if (features[i][featureIndex] <= threshold) {
                leftIndices.push(i);
            } else {
                rightIndices.push(i);
            }
        }

        const leftFeatures = leftIndices.map(i => features[i]);
        const leftLabels = leftIndices.map(i => labels[i]);
        const rightFeatures = rightIndices.map(i => features[i]);
        const rightLabels = rightIndices.map(i => labels[i]);

        return {
            featureIndex,
            threshold,
            left: this.trainDecisionTree(leftFeatures, leftLabels),
            right: this.trainDecisionTree(rightFeatures, rightLabels)
        };
    }

    /**
     * Predict with decision tree
     */
    predictWithTree(tree, features) {
        if (tree.prediction !== undefined) {
            return tree.prediction;
        }

        if (features[tree.featureIndex] <= tree.threshold) {
            return this.predictWithTree(tree.left, features);
        } else {
            return this.predictWithTree(tree.right, features);
        }
    }

    /**
     * Find best split for decision tree
     */
    findBestSplit(features, labels) {
        let bestGain = -1;
        let bestSplit = null;
        const currentVariance = ss.variance(labels);

        for (let featureIdx = 0; featureIdx < features[0].length; featureIdx++) {
            const values = features.map(f => f[featureIdx]);
            const uniqueValues = [...new Set(values)].sort((a, b) => a - b);

            for (let i = 0; i < uniqueValues.length - 1; i++) {
                const threshold = (uniqueValues[i] + uniqueValues[i + 1]) / 2;

                const leftLabels = [];
                const rightLabels = [];

                for (let j = 0; j < features.length; j++) {
                    if (features[j][featureIdx] <= threshold) {
                        leftLabels.push(labels[j]);
                    } else {
                        rightLabels.push(labels[j]);
                    }
                }

                if (leftLabels.length === 0 || rightLabels.length === 0) continue;

                const leftWeight = leftLabels.length / labels.length;
                const rightWeight = rightLabels.length / labels.length;
                const weightedVariance = leftWeight * ss.variance(leftLabels) +
                    rightWeight * ss.variance(rightLabels);

                const informationGain = currentVariance - weightedVariance;

                if (informationGain > bestGain) {
                    bestGain = informationGain;
                    bestSplit = { featureIndex: featureIdx, threshold };
                }
            }
        }

        return bestSplit;
    }

    /**
     * Check if all labels are the same
     */
    allSameLabel(labels) {
        return labels.every(label => label === labels[0]);
    }

    /**
     * Train the model on all user data
     */
    async trainModel() {
        try {
            console.log('🤖 Training late arrival prediction model...');

            // Load training data from all users
            const users = await User.find();
            const allFeatures = [];
            const allLabels = [];

            if (users.length === 0) {
                console.log('⚠️  No users found for training');
                this.model = { predict: () => 0.25 }; // Default 25% late probability
                this.isModelTrained = true;
                return this.model;
            }

            for (const user of users) {
                const attendanceHistory = await this.loadUserAttendanceHistory(user._id);

                if (attendanceHistory.length === 0) {
                    console.log(`⚠️  No attendance history for user ${user.username}`);
                    continue;
                }

                for (let i = 1; i < attendanceHistory.length; i++) {
                    const record = attendanceHistory[i];
                    const features = await this.extractUserFeatures(user._id, record.date);

                    allFeatures.push(features);
                    allLabels.push(record.isLate ? 1 : 0);
                }
            }

            console.log(`📈 Training data: ${allFeatures.length} samples from ${users.length} users`);

            if (allFeatures.length < 5) {
                console.log('⚠️  Very limited training data, using baseline model');
                const avgLateness = allLabels.length > 0 ? ss.mean(allLabels) : 0.3;
                this.model = { predict: () => avgLateness };
            } else if (allFeatures.length < 20) {
                console.log('⚠️  Limited training data, using simplified model');
                const avgLateness = ss.mean(allLabels);
                this.model = {
                    predict: (features) => {
                        // Simple heuristic based on day of week and recent patterns
                        const dayOfWeek = features[0];
                        const recentLateness = features[2];
                        let probability = avgLateness;

                        // Monday effect
                        if (dayOfWeek === 1) probability += 0.1;
                        // Recent pattern influence
                        probability = (probability + recentLateness) / 2;

                        return Math.min(1, Math.max(0, probability));
                    }
                };
            } else {
                this.model = this.trainRandomForest(allFeatures, allLabels);
                console.log(`✅ Random Forest model trained on ${allFeatures.length} samples`);
            }

            this.isModelTrained = true;
            return this.model;

        } catch (error) {
            console.error('❌ Error training model:', error);
            this.model = { predict: () => 0.3 };
            this.isModelTrained = true;
        }
    }

    /**
     * Predict late arrival probability for a user and date
     */
    async predictLateArrival(userId, targetDate) {
        try {
            if (!this.isModelTrained) {
                await this.trainModel();
            }

            // Load user attendance history
            const attendanceHistory = await this.loadUserAttendanceHistory(userId);

            // Check if user has any attendance data
            if (attendanceHistory.length === 0) {
                const user = await User.findById(userId);
                throw new Error(
                    `No attendance history found for user ${user?.username || 'Unknown'}. ` +
                    'AI predictions require historical attendance data to analyze patterns.'
                );
            }

            console.log(`🤖 Generating prediction for user with ${attendanceHistory.length} attendance records`);

            const features = await this.extractUserFeatures(userId, targetDate);
            const probability = this.model.predict(features);

            // Get risk level
            let riskLevel = 'Low';
            if (probability > 0.7) riskLevel = 'High';
            else if (probability > 0.4) riskLevel = 'Medium';

            // Generate contextual factors
            const dayOfWeek = new Date(targetDate).toLocaleDateString('en-US', { weekday: 'long' });
            const user = await User.findById(userId);

            const factors = [
                `Day of week: ${dayOfWeek}`,
                `Historical pattern analysis (${attendanceHistory.length} records)`,
                `Recent attendance trends`,
                user?.role === 'admin' ? 'Administrative role flexibility' : 'Standard schedule expectations',
                `Based on ${attendanceHistory.filter(r => r.isLate).length} late arrivals`
            ];

            const result = {
                user_id: userId,
                username: user?.username || 'Unknown',
                date: targetDate,
                probability_late: probability,
                risk_level: riskLevel,
                factors,
                model_confidence: Math.min(0.95, 0.6 + (attendanceHistory.length / 100)), // Confidence based on history
                attendance_data_available: true,
                historical_records_count: attendanceHistory.length
            };

            console.log(`✅ Generated prediction: ${(probability * 100).toFixed(1)}% late probability`);
            return result;

        } catch (error) {
            console.error('❌ Error predicting late arrival:', error);

            // Check if it's a no-data error
            if (error.message.includes('No attendance history')) {
                throw error; // Re-throw to maintain the specific error message
            }

            // Generic fallback prediction
            const user = await User.findById(userId).catch(() => null);
            return {
                user_id: userId,
                username: user?.username || 'Unknown',
                date: targetDate,
                probability_late: 0.3,
                risk_level: 'Medium',
                factors: ['Insufficient data for accurate prediction'],
                model_confidence: 0.5,
                attendance_data_available: false,
                error: error.message
            };
        }
    }
}

export default new LateArrivalPredictionService();