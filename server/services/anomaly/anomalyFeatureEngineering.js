import User from '../../models/User.js';
import { mean, std } from 'mathjs';

/**
 * Anomaly Feature Engineering Service
 * 
 * Extracts and computes numerical features from attendance records
 * for anomaly detection using Isolation Forest.
 * 
 * Features computed:
 * 1. arrival_time_in_minutes - Time of arrival in minutes since midnight
 * 2. day_of_week - Day of the week (0-6, Monday=0)
 * 3. time_difference_from_user_average - Deviation from user's typical arrival time
 * 4. days_since_last_attendance - Days elapsed since last attendance
 * 5. device_consistency_score - How consistent is the device usage
 * 6. hour_of_day - Hour of check-in (0-23)
 * 7. is_weekend - Binary flag for weekend
 */
class AnomalyFeatureEngineering {
    /**
     * Extract features from attendance records for anomaly detection
     * @param {Object} options - Filter options (startDate, endDate, userId)
     * @returns {Promise<Array>} Array of feature vectors with metadata
     */
    async extractFeatures(options = {}) {
        try {
            const { startDate, endDate, userId } = options;

            // Build query filter
            const filter = {};
            if (startDate || endDate) {
                filter.timestamp = {};
                if (startDate) filter.timestamp.$gte = new Date(startDate);
                if (endDate) filter.timestamp.$lte = new Date(endDate);
            }
            if (userId) {
                filter.user = userId;
            }

            // Fetch attendance records
            const attendanceRecords = await Attendance.find(filter)
                .populate('user', 'username email')
                .sort({ timestamp: 1 })
                .lean();

            if (attendanceRecords.length === 0) {
                return [];
            }

            // Group records by user for computing user-specific statistics
            const userRecordsMap = {};
            attendanceRecords.forEach(record => {
                const userId = record.user._id.toString();
                if (!userRecordsMap[userId]) {
                    userRecordsMap[userId] = [];
                }
                userRecordsMap[userId].push(record);
            });

            // Compute user statistics (average arrival time, device patterns)
            const userStats = this._computeUserStatistics(userRecordsMap);

            // Extract features for each record
            const features = [];
            for (const record of attendanceRecords) {
                const userId = record.user._id.toString();
                const userHistory = userRecordsMap[userId];
                const stats = userStats[userId];

                const featureVector = this._extractRecordFeatures(
                    record,
                    userHistory,
                    stats
                );

                features.push({
                    _id: record._id,
                    user_id: userId,
                    user_name: record.user.username,
                    date: record.timestamp,
                    device_id: record.deviceId,
                    features: featureVector.features,
                    metadata: featureVector.metadata
                });
            }

            return features;

        } catch (error) {
            console.error('Error extracting anomaly features:', error);
            throw new Error(`Feature extraction failed: ${error.message}`);
        }
    }

    /**
     * Compute statistics for each user (average arrival time, device patterns, etc.)
     * @private
     */
    _computeUserStatistics(userRecordsMap) {
        const stats = {};

        for (const [userId, records] of Object.entries(userRecordsMap)) {
            // Compute arrival times in minutes
            const arrivalTimes = records.map(r => {
                const date = new Date(r.timestamp);
                return date.getHours() * 60 + date.getMinutes();
            });

            // Compute device frequency
            const deviceFreq = {};
            records.forEach(r => {
                const deviceId = r.deviceId || 'unknown';
                deviceFreq[deviceId] = (deviceFreq[deviceId] || 0) + 1;
            });
            const mostUsedDevice = Object.keys(deviceFreq).reduce((a, b) =>
                deviceFreq[a] > deviceFreq[b] ? a : b
            );

            stats[userId] = {
                avgArrivalTime: mean(arrivalTimes),
                stdArrivalTime: arrivalTimes.length > 1 ? std(arrivalTimes) : 0,
                totalRecords: records.length,
                mostUsedDevice,
                deviceFrequency: deviceFreq
            };
        }

        return stats;
    }

    /**
     * Extract features from a single attendance record
     * @private
     */
    _extractRecordFeatures(record, userHistory, userStats) {
        const checkInDate = new Date(record.timestamp);

        // Feature 1: Arrival time in minutes since midnight
        const arrivalTimeInMinutes = checkInDate.getHours() * 60 + checkInDate.getMinutes();

        // Feature 2: Day of week (0 = Monday, 6 = Sunday)
        const dayOfWeek = (checkInDate.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0

        // Feature 3: Time difference from user average
        const timeDiffFromAverage = Math.abs(arrivalTimeInMinutes - userStats.avgArrivalTime);

        // Feature 4: Days since last attendance
        const recordIndex = userHistory.findIndex(r => r._id.equals(record._id));
        let daysSinceLastAttendance = 0;
        if (recordIndex > 0) {
            const prevRecord = userHistory[recordIndex - 1];
            const prevDate = new Date(prevRecord.timestamp);
            const daysDiff = (checkInDate - prevDate) / (1000 * 60 * 60 * 24);
            daysSinceLastAttendance = Math.floor(daysDiff);
        }

        // Feature 5: Device consistency score (1 if most used, 0 otherwise)
        const deviceId = record.deviceId || 'unknown';
        const deviceConsistencyScore = deviceId === userStats.mostUsedDevice ? 1 : 0;

        // Feature 6: Hour of day
        const hourOfDay = checkInDate.getHours();

        // Feature 7: Is weekend (1 if Saturday/Sunday, 0 otherwise)
        const isWeekend = (checkInDate.getDay() === 0 || checkInDate.getDay() === 6) ? 1 : 0;

        // Feature 8: Normalized attendance frequency (records / total days)
        const firstDate = new Date(userHistory[0].timestamp);
        const totalDays = Math.max(1, (checkInDate - firstDate) / (1000 * 60 * 60 * 24));
        const attendanceFrequency = userHistory.length / totalDays;

        return {
            features: {
                arrival_time_in_minutes: arrivalTimeInMinutes,
                day_of_week: dayOfWeek,
                time_difference_from_user_average: timeDiffFromAverage,
                days_since_last_attendance: daysSinceLastAttendance,
                device_consistency_score: deviceConsistencyScore,
                hour_of_day: hourOfDay,
                is_weekend: isWeekend,
                attendance_frequency: attendanceFrequency
            },
            metadata: {
                avgArrivalTime: userStats.avgArrivalTime,
                stdArrivalTime: userStats.stdArrivalTime,
                deviceId: deviceId,
                mostUsedDevice: userStats.mostUsedDevice
            }
        };
    }

    /**
     * Normalize features using min-max scaling
     * @param {Array} featureData - Array of feature objects
     * @returns {Array} Normalized feature vectors
     */
    normalizeFeatures(featureData) {
        if (featureData.length === 0) return [];

        // Get feature names from first record
        const featureNames = Object.keys(featureData[0].features);

        // Compute min and max for each feature
        const minMax = {};
        featureNames.forEach(name => {
            const values = featureData.map(d => d.features[name]);
            minMax[name] = {
                min: Math.min(...values),
                max: Math.max(...values)
            };
        });

        // Normalize each feature vector
        return featureData.map(data => {
            const normalized = {};
            featureNames.forEach(name => {
                const { min, max } = minMax[name];
                const value = data.features[name];
                // Min-max normalization: (value - min) / (max - min)
                normalized[name] = max > min ? (value - min) / (max - min) : 0;
            });

            return {
                ...data,
                normalizedFeatures: normalized,
                originalFeatures: data.features
            };
        });
    }

    /**
     * Convert feature object to array for ML model
     * @param {Object} features - Feature object
     * @returns {Array} Feature array
     */
    featuresToArray(features) {
        return [
            features.arrival_time_in_minutes,
            features.day_of_week,
            features.time_difference_from_user_average,
            features.days_since_last_attendance,
            features.device_consistency_score,
            features.hour_of_day,
            features.is_weekend,
            features.attendance_frequency
        ];
    }
}

export default new AnomalyFeatureEngineering();
