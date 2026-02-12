import * as math from 'mathjs';
import Attendance from '../models/Attendance.js';
import User from '../models/User.js';

/**
 * Feature Engineering Service for Attendance Clustering
 * Computes behavioral features for each user based on attendance patterns
 */
class FeatureEngineeringService {
    /**
     * Compute behavior features for all users
     * @param {Object} options - Configuration options
     * @param {Date} options.startDate - Optional start date filter
     * @param {Date} options.endDate - Optional end date filter
     * @returns {Array} Array of user features
     */
    async computeUserFeatures(options = {}) {
        try {
            const { startDate, endDate } = options;

            // Build attendance query with date filters
            const attendanceQuery = {};
            if (startDate || endDate) {
                attendanceQuery.timestamp = {};
                if (startDate) attendanceQuery.timestamp.$gte = startDate;
                if (endDate) attendanceQuery.timestamp.$lte = endDate;
            }

            // Get all users and their attendance records
            const users = await User.find().lean();
            const attendanceRecords = await Attendance.find(attendanceQuery).lean();

            // Group attendance by user
            const userAttendanceMap = new Map();
            attendanceRecords.forEach(record => {
                const userId = record.user.toString();
                if (!userAttendanceMap.has(userId)) {
                    userAttendanceMap.set(userId, []);
                }
                userAttendanceMap.get(userId).push(record);
            });

            // Compute features for each user
            const userFeatures = [];

            for (const user of users) {
                const userAttendance = userAttendanceMap.get(user._id.toString()) || [];

                if (userAttendance.length === 0) {
                    // User with no attendance - assign default values
                    userFeatures.push({
                        user_id: user._id.toString(),
                        user_name: user.username,
                        features: {
                            average_arrival_time: 540, // 9:00 AM as minutes
                            late_percentage: 100,
                            absence_percentage: 100,
                            attendance_consistency: 60 // High variance
                        },
                        attendance_count: 0
                    });
                    continue;
                }

                const features = await this.computeIndividualFeatures(user, userAttendance, options);
                userFeatures.push({
                    user_id: user._id.toString(),
                    user_name: user.username,
                    features,
                    attendance_count: userAttendance.length
                });
            }

            return userFeatures;
        } catch (error) {
            throw new Error(`Feature engineering failed: ${error.message}`);
        }
    }

    /**
     * Compute features for an individual user
     * @param {Object} user - User object
     * @param {Array} attendanceRecords - User's attendance records
     * @param {Object} options - Configuration options
     * @returns {Object} Computed features
     */
    async computeIndividualFeatures(user, attendanceRecords, options = {}) {
        try {
            // Calculate expected working days in the period
            const expectedDays = this.calculateExpectedWorkingDays(options);

            // Extract arrival times in minutes from midnight
            const arrivalTimes = attendanceRecords.map(record => {
                const date = new Date(record.timestamp);
                return date.getHours() * 60 + date.getMinutes();
            });

            // 1. Average arrival time (in minutes from midnight)
            const average_arrival_time = arrivalTimes.length > 0
                ? math.mean(arrivalTimes)
                : 540; // Default to 9:00 AM

            // 2. Late percentage (arrival after 9:00 AM = 540 minutes)
            const lateArrivals = arrivalTimes.filter(time => time > 540);
            const late_percentage = arrivalTimes.length > 0
                ? (lateArrivals.length / arrivalTimes.length) * 100
                : 0;

            // 3. Absence percentage
            const attendance_days = attendanceRecords.length;
            const absence_percentage = expectedDays > 0
                ? Math.max(0, ((expectedDays - attendance_days) / expectedDays) * 100)
                : 0;

            // 4. Attendance consistency (standard deviation of arrival times)
            const attendance_consistency = arrivalTimes.length > 1
                ? math.std(arrivalTimes)
                : 0;

            return {
                average_arrival_time: Math.round(average_arrival_time * 100) / 100,
                late_percentage: Math.round(late_percentage * 100) / 100,
                absence_percentage: Math.round(absence_percentage * 100) / 100,
                attendance_consistency: Math.round(attendance_consistency * 100) / 100
            };
        } catch (error) {
            throw new Error(`Individual feature computation failed: ${error.message}`);
        }
    }

    /**
     * Calculate expected working days in the given period
     * @param {Object} options - Date range options
     * @returns {number} Expected working days
     */
    calculateExpectedWorkingDays(options = {}) {
        const { startDate, endDate } = options;

        if (!startDate && !endDate) {
            // Default to 60 days (approximately 12 weeks * 5 working days)
            return 60;
        }

        const start = startDate || new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
        const end = endDate || new Date();

        let workingDays = 0;
        const currentDate = new Date(start);

        while (currentDate <= end) {
            const dayOfWeek = currentDate.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
                workingDays++;
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return workingDays;
    }

    /**
     * Normalize features using min-max scaling
     * @param {Array} userFeatures - Array of user features
     * @returns {Array} Normalized features with scaling parameters
     */
    normalizeFeatures(userFeatures) {
        try {
            if (userFeatures.length === 0) {
                return { normalizedFeatures: [], scalingParams: {} };
            }

            const featureKeys = ['average_arrival_time', 'late_percentage', 'absence_percentage', 'attendance_consistency'];
            const scalingParams = {};

            // Calculate min and max for each feature
            featureKeys.forEach(key => {
                const values = userFeatures.map(user => user.features[key]);
                scalingParams[key] = {
                    min: Math.min(...values),
                    max: Math.max(...values)
                };
            });

            // Normalize features
            const normalizedFeatures = userFeatures.map(user => {
                const normalizedFeatureSet = {};

                featureKeys.forEach(key => {
                    const value = user.features[key];
                    const { min, max } = scalingParams[key];

                    // Min-max normalization: (value - min) / (max - min)
                    // Handle case where min === max (all values are the same)
                    normalizedFeatureSet[key] = max === min ? 0.5 : (value - min) / (max - min);
                });

                return {
                    user_id: user.user_id,
                    user_name: user.user_name,
                    original_features: user.features,
                    normalized_features: normalizedFeatureSet,
                    attendance_count: user.attendance_count
                };
            });

            return {
                normalizedFeatures,
                scalingParams
            };
        } catch (error) {
            throw new Error(`Feature normalization failed: ${error.message}`);
        }
    }

    /**
     * Get feature importance explanations
     * @returns {Object} Feature explanations
     */
    getFeatureExplanations() {
        return {
            average_arrival_time: {
                description: "Average time of arrival in minutes from midnight",
                interpretation: "Lower values indicate earlier arrivals",
                unit: "minutes"
            },
            late_percentage: {
                description: "Percentage of days arrived after 9:00 AM",
                interpretation: "Higher values indicate frequent lateness",
                unit: "percentage"
            },
            absence_percentage: {
                description: "Percentage of expected working days missed",
                interpretation: "Higher values indicate frequent absences",
                unit: "percentage"
            },
            attendance_consistency: {
                description: "Standard deviation of arrival times",
                interpretation: "Higher values indicate inconsistent attendance patterns",
                unit: "minutes"
            }
        };
    }
}

export default new FeatureEngineeringService();