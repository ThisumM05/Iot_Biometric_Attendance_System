import Attendance from '../../models/Attendance.js';
import User from '../../models/User.js';
import AnalyticsCache from '../../models/AnalyticsCache.js';

class AnomalyDetectionService {
    constructor() {
        this.anomalyThresholds = {
            behavioral: {
                unusualTimeThreshold: 2, // hours from normal
                frequencyDropThreshold: 0.5, // 50% drop in attendance
                punctualityChangeThreshold: 0.3 // 30% change in punctuality
            },
            temporal: {
                offHoursThreshold: { before: 6, after: 22 }, // Outside 6 AM - 10 PM
                weekendActivityThreshold: 0.8, // Unusual weekend activity
                holidayActivityThreshold: 0.9 // Activity on holidays
            },
            device: {
                responseTimeThreshold: 5000, // 5 seconds
                errorRateThreshold: 0.1, // 10% error rate
                offlineThreshold: 300000 // 5 minutes offline
            },
            security: {
                multipleAttemptsThreshold: 3, // Multiple failed attempts
                suspiciousTimingThreshold: 30, // 30 seconds between attempts
                unknownDeviceThreshold: 0.95 // Confidence threshold
            }
        };
    }

    /**
     * Main anomaly detection method
     */
    async detectAnomalies(timeframe = 24) {
        try {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setHours(endDate.getHours() - timeframe);

            const anomalies = [];

            // Run all anomaly detection algorithms
            const behavioralAnomalies = await this.detectBehavioralAnomalies(startDate, endDate);
            const temporalAnomalies = await this.detectTemporalAnomalies(startDate, endDate);
            const deviceAnomalies = await this.detectDeviceAnomalies(startDate, endDate);
            const securityAnomalies = await this.detectSecurityAnomalies(startDate, endDate);

            anomalies.push(...behavioralAnomalies, ...temporalAnomalies, ...deviceAnomalies, ...securityAnomalies);

            // Save anomalies to cache
            await this.saveAnomaliesCache(anomalies);

            return {
                success: true,
                detectionPeriod: { startDate, endDate },
                totalAnomalies: anomalies.length,
                anomalies: anomalies.sort((a, b) => this.getSeverityWeight(b.severity) - this.getSeverityWeight(a.severity))
            };

        } catch (error) {
            console.error('Error detecting anomalies:', error);
            throw error;
        }
    }

    /**
     * Detect behavioral anomalies (unusual user patterns)
     */
    async detectBehavioralAnomalies(startDate, endDate) {
        const anomalies = [];

        try {
            // Get users with recent attendance
            const users = await User.find({ fingerprintId: { $ne: null } });

            for (const user of users) {
                // Get user's attendance data
                const recentAttendance = await Attendance.find({
                    user: user._id,
                    timestamp: { $gte: startDate, $lte: endDate }
                }).sort({ timestamp: -1 });

                // Get user's historical pattern (last 30 days)
                const historicalStart = new Date();
                historicalStart.setDate(historicalStart.getDate() - 30);

                const historicalAttendance = await Attendance.find({
                    user: user._id,
                    timestamp: { $gte: historicalStart, $lt: startDate }
                }).sort({ timestamp: -1 });

                if (historicalAttendance.length < 5) continue; // Need baseline data

                // Check for unusual timing patterns
                const timingAnomaly = this.detectUnusualTiming(user, recentAttendance, historicalAttendance);
                if (timingAnomaly) anomalies.push(timingAnomaly);

                // Check for frequency changes
                const frequencyAnomaly = this.detectFrequencyChange(user, recentAttendance, historicalAttendance);
                if (frequencyAnomaly) anomalies.push(frequencyAnomaly);

                // Check for punctuality changes
                const punctualityAnomaly = this.detectPunctualityChange(user, recentAttendance, historicalAttendance);
                if (punctualityAnomaly) anomalies.push(punctualityAnomaly);
            }

        } catch (error) {
            console.error('Error detecting behavioral anomalies:', error);
        }

        return anomalies;
    }

    /**
     * Detect temporal anomalies (unusual time patterns)
     */
    async detectTemporalAnomalies(startDate, endDate) {
        const anomalies = [];

        try {
            const recentAttendance = await Attendance.find({
                timestamp: { $gte: startDate, $lte: endDate }
            }).populate('user');

            for (const record of recentAttendance) {
                const recordTime = new Date(record.timestamp);
                const hour = recordTime.getHours();
                const dayOfWeek = recordTime.getDay();

                // Check for off-hours activity
                if (hour < this.anomalyThresholds.temporal.offHoursThreshold.before ||
                    hour > this.anomalyThresholds.temporal.offHoursThreshold.after) {

                    anomalies.push({
                        type: 'temporal',
                        severity: 'medium',
                        description: `Off-hours attendance detected at ${hour}:00`,
                        userId: record.user._id,
                        detectedAt: new Date(),
                        metadata: { hour, recordTime }
                    });
                }

                // Check for weekend activity
                if ((dayOfWeek === 0 || dayOfWeek === 6)) {
                    anomalies.push({
                        type: 'temporal',
                        severity: 'low',
                        description: 'Weekend attendance detected',
                        userId: record.user._id,
                        detectedAt: new Date(),
                        metadata: { dayOfWeek, recordTime }
                    });
                }
            }

        } catch (error) {
            console.error('Error detecting temporal anomalies:', error);
        }

        return anomalies;
    }

    /**
     * Detect device anomalies (hardware/connectivity issues)
     */
    async detectDeviceAnomalies(startDate, endDate) {
        const anomalies = [];

        try {
            // Note: This would need integration with device monitoring
            // For now, we'll simulate device health checks

            // Check for missing heartbeats or device offline status
            const deviceIds = ['ESP32_001', 'ESP32_002']; // Example device IDs

            for (const deviceId of deviceIds) {
                // Simulate device health check
                const lastSeen = new Date(Date.now() - Math.random() * 600000); // Random last seen time

                if (Date.now() - lastSeen.getTime() > this.anomalyThresholds.device.offlineThreshold) {
                    anomalies.push({
                        type: 'device',
                        severity: 'high',
                        description: `Device ${deviceId} appears to be offline`,
                        deviceId,
                        detectedAt: new Date(),
                        metadata: { lastSeen, offlineDuration: Date.now() - lastSeen.getTime() }
                    });
                }
            }

        } catch (error) {
            console.error('Error detecting device anomalies:', error);
        }

        return anomalies;
    }

    /**
     * Detect security anomalies (suspicious access patterns)
     */
    async detectSecurityAnomalies(startDate, endDate) {
        const anomalies = [];

        try {
            // Check for rapid successive attempts
            const recentAttendance = await Attendance.find({
                timestamp: { $gte: startDate, $lte: endDate }
            }).populate('user').sort({ timestamp: -1 });

            // Group by user and check for rapid succession
            const userAttempts = {};

            for (const record of recentAttendance) {
                const userId = record.user._id.toString();

                if (!userAttempts[userId]) {
                    userAttempts[userId] = [];
                }

                userAttempts[userId].push(record.timestamp);
            }

            // Check for suspicious timing patterns
            for (const [userId, attempts] of Object.entries(userAttempts)) {
                if (attempts.length >= this.anomalyThresholds.security.multipleAttemptsThreshold) {
                    // Check if attempts are too close together
                    for (let i = 1; i < attempts.length; i++) {
                        const timeDiff = Math.abs(new Date(attempts[i]) - new Date(attempts[i - 1]));

                        if (timeDiff < this.anomalyThresholds.security.suspiciousTimingThreshold * 1000) {
                            const user = await User.findById(userId);

                            anomalies.push({
                                type: 'security',
                                severity: 'high',
                                description: `Suspicious rapid attendance attempts detected`,
                                userId: userId,
                                detectedAt: new Date(),
                                metadata: {
                                    attemptCount: attempts.length,
                                    timeBetweenAttempts: timeDiff,
                                    username: user?.username
                                }
                            });
                        }
                    }
                }
            }

        } catch (error) {
            console.error('Error detecting security anomalies:', error);
        }

        return anomalies;
    }

    /**
     * Detect unusual timing patterns for a user
     */
    detectUnusualTiming(user, recentData, historicalData) {
        if (recentData.length === 0 || historicalData.length === 0) return null;

        // Calculate historical average arrival time
        const historicalAvgTime = historicalData.reduce((sum, record) => {
            return sum + new Date(record.timestamp).getHours();
        }, 0) / historicalData.length;

        // Calculate recent average arrival time
        const recentAvgTime = recentData.reduce((sum, record) => {
            return sum + new Date(record.timestamp).getHours();
        }, 0) / recentData.length;

        const timeDifference = Math.abs(recentAvgTime - historicalAvgTime);

        if (timeDifference > this.anomalyThresholds.behavioral.unusualTimeThreshold) {
            return {
                type: 'behavioral',
                severity: 'medium',
                description: `Unusual timing pattern detected for ${user.username}`,
                userId: user._id,
                detectedAt: new Date(),
                metadata: {
                    historicalAvgTime: Math.round(historicalAvgTime),
                    recentAvgTime: Math.round(recentAvgTime),
                    deviation: Math.round(timeDifference * 100) / 100
                }
            };
        }

        return null;
    }

    /**
     * Detect frequency changes in attendance
     */
    detectFrequencyChange(user, recentData, historicalData) {
        const recentFrequency = recentData.length;
        const historicalDailyAvg = historicalData.length / 30; // Assuming 30-day historical period
        const expectedRecent = historicalDailyAvg * 1; // Assuming 1-day recent period

        const frequencyChange = Math.abs(recentFrequency - expectedRecent) / expectedRecent;

        if (frequencyChange > this.anomalyThresholds.behavioral.frequencyDropThreshold) {
            return {
                type: 'behavioral',
                severity: recentFrequency < expectedRecent ? 'high' : 'medium',
                description: `Significant attendance frequency change for ${user.username}`,
                userId: user._id,
                detectedAt: new Date(),
                metadata: {
                    expectedFrequency: Math.round(expectedRecent * 100) / 100,
                    actualFrequency: recentFrequency,
                    changePercentage: Math.round(frequencyChange * 100)
                }
            };
        }

        return null;
    }

    /**
     * Detect punctuality changes
     */
    detectPunctualityChange(user, recentData, historicalData) {
        if (recentData.length === 0 || historicalData.length === 0) return null;

        const historicalPunctuality = historicalData.filter(r => r.status === 'present').length / historicalData.length;
        const recentPunctuality = recentData.filter(r => r.status === 'present').length / recentData.length;

        const punctualityChange = Math.abs(recentPunctuality - historicalPunctuality);

        if (punctualityChange > this.anomalyThresholds.behavioral.punctualityChangeThreshold) {
            return {
                type: 'behavioral',
                severity: recentPunctuality < historicalPunctuality ? 'high' : 'low',
                description: `Significant punctuality change for ${user.username}`,
                userId: user._id,
                detectedAt: new Date(),
                metadata: {
                    historicalPunctuality: Math.round(historicalPunctuality * 100),
                    recentPunctuality: Math.round(recentPunctuality * 100),
                    changePercentage: Math.round(punctualityChange * 100)
                }
            };
        }

        return null;
    }

    /**
     * Get severity weight for sorting
     */
    getSeverityWeight(severity) {
        const weights = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
        return weights[severity] || 0;
    }

    /**
     * Save anomalies to cache for dashboard display
     */
    async saveAnomaliesCache(anomalies) {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            await AnalyticsCache.findOneAndUpdate(
                { analysisDate: today },
                {
                    $set: {
                        anomalies: anomalies,
                        generatedAt: new Date()
                    }
                },
                { upsert: true }
            );
        } catch (error) {
            console.error('Error saving anomalies cache:', error);
        }
    }

    /**
     * Get recent anomalies for dashboard
     */
    async getRecentAnomalies(limit = 10) {
        try {
            const cache = await AnalyticsCache.findOne({
                analysisDate: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            }).sort({ analysisDate: -1 });

            if (!cache || !cache.anomalies) return [];

            return cache.anomalies
                .sort((a, b) => this.getSeverityWeight(b.severity) - this.getSeverityWeight(a.severity))
                .slice(0, limit);
        } catch (error) {
            console.error('Error getting recent anomalies:', error);
            return [];
        }
    }
}

export default new AnomalyDetectionService();