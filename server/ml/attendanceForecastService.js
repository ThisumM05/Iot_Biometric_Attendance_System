import * as ss from 'simple-statistics';
import { Matrix } from 'ml-matrix';
import Attendance from '../models/Attendance.js';
import User from '../models/User.js';

class AttendanceForecastService {
    constructor() {
        this.models = {
            timeSeries: null,
            trendAnalysis: null,
            seasonalPatterns: {}
        };
        this.trainingData = [];
        this.isModelTrained = false;
    }

    /**
     * Calculate moving average manually
     */
    calculateMovingAverage(data, windowSize) {
        if (data.length < windowSize) return [ss.mean(data)];

        const result = [];
        for (let i = windowSize - 1; i < data.length; i++) {
            const window = data.slice(i - windowSize + 1, i + 1);
            result.push(ss.mean(window));
        }
        return result;
    }

    /**
     * Load and prepare historical attendance data for ML training
     */
    async loadTrainingData() {
        try {
            console.log('🔄 Loading attendance data for ML training...');

            // Get attendance data from last 6 months for training
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

            const attendanceRecords = await Attendance.find({
                timestamp: { $gte: sixMonthsAgo },
                user: { $ne: null },
                type: 'CHECK_IN' // Only use check-in records for daily counts
            })
                .populate('user')
                .sort({ timestamp: 1 });

            console.log(`📊 Loaded ${attendanceRecords.length} attendance records for training`);

            // Process data into time series format
            const dailyAttendance = this.aggregateDailyAttendance(attendanceRecords);
            this.trainingData = dailyAttendance;

            return this.trainingData;
        } catch (error) {
            console.error('❌ Error loading training data:', error);
            throw error;
        }
    }

    /**
     * Aggregate attendance records into daily counts
     */
    aggregateDailyAttendance(records) {
        const dailyCounts = {};

        records.forEach(record => {
            if (!record.timestamp) return;

            const date = new Date(record.timestamp).toISOString().split('T')[0];

            if (!dailyCounts[date]) {
                dailyCounts[date] = {
                    date,
                    count: 0,
                    lateCount: 0,
                    users: new Set()
                };
            }

            dailyCounts[date].count++;
            dailyCounts[date].users.add(record.user?._id?.toString());

            // Consider late if check-in is after 9:00 AM
            const checkInHour = new Date(record.timestamp).getHours();
            if (checkInHour >= 9) {
                dailyCounts[date].lateCount++;
            }
        });

        // Convert to array and sort by date
        return Object.values(dailyCounts)
            .map(day => ({
                ...day,
                uniqueUsers: day.users.size,
                latePercentage: day.count > 0 ? (day.lateCount / day.count) * 100 : 0
            }))
            .sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    /**
     * Train time series forecasting model using statistical methods
     */
    async trainForecastModel() {
        try {
            console.log('🤖 Training time series forecasting model...');

            if (this.trainingData.length < 5) {
                console.log('⚠️  Very limited data available. Using simplified model.');
                // Create a basic model with minimal data
                const avgAttendance = this.trainingData.length > 0 ?
                    ss.mean(this.trainingData.map(d => d.count)) : 10;

                this.models.timeSeries = {
                    movingAverage7: [avgAttendance],
                    movingAverage14: [avgAttendance],
                    trend: { m: 0, b: avgAttendance },
                    baselineAverage: avgAttendance,
                    variance: 5,
                    standardDeviation: 2.5
                };

                this.models.seasonalPatterns = this.getDefaultSeasonalPatterns();
                this.isModelTrained = true;
                console.log(`✅ Basic model created with ${this.trainingData.length} data points`);
                return this.models;
            }

            if (this.trainingData.length < 14) {
                console.log(`⚠️  Limited training data: ${this.trainingData.length} days (recommended: 14+). Proceeding with available data...`);
            }

            const attendanceCounts = this.trainingData.map(d => d.count);

            // Calculate moving averages for trend analysis (adjust window size based on available data)
            const shortWindow = Math.min(7, Math.floor(attendanceCounts.length / 2));
            const longWindow = Math.min(14, Math.max(shortWindow, Math.floor(attendanceCounts.length * 0.75)));

            const movingAverage7 = attendanceCounts.length >= shortWindow ?
                this.calculateMovingAverage(attendanceCounts, shortWindow) : [ss.mean(attendanceCounts)];
            const movingAverage14 = attendanceCounts.length >= longWindow ?
                this.calculateMovingAverage(attendanceCounts, longWindow) : [ss.mean(attendanceCounts)];

            // Detect seasonal patterns (weekly)
            const weeklyPatterns = this.detectSeasonalPatterns(this.trainingData);

            // Calculate trend using linear regression
            const timePoints = attendanceCounts.map((_, index) => index + 1);
            const points = timePoints.map((x, i) => [x, attendanceCounts[i]]);
            const trendRegression = ss.linearRegression(points);

            this.models.timeSeries = {
                movingAverage7,
                movingAverage14,
                trend: trendRegression,
                baselineAverage: ss.mean(attendanceCounts),
                variance: ss.variance(attendanceCounts),
                standardDeviation: ss.standardDeviation(attendanceCounts)
            };

            this.models.seasonalPatterns = weeklyPatterns;
            this.isModelTrained = true;

            console.log('✅ Time series model trained successfully');
            console.log(`📈 Trend slope: ${trendRegression.m.toFixed(4)}`);
            console.log(`📊 Average attendance: ${this.models.timeSeries.baselineAverage.toFixed(1)}`);
            console.log(`📏 Standard deviation: ${this.models.timeSeries.standardDeviation.toFixed(2)}`);

            return this.models;
        } catch (error) {
            console.error('❌ Error training forecast model:', error);
            throw error;
        }
    }

    /**
     * Detect seasonal patterns in attendance data
     */
    detectSeasonalPatterns(data) {
        const dayOfWeekPatterns = {};

        data.forEach(record => {
            const dayOfWeek = new Date(record.date).getDay(); // 0 = Sunday, 1 = Monday, etc.

            if (!dayOfWeekPatterns[dayOfWeek]) {
                dayOfWeekPatterns[dayOfWeek] = [];
            }

            dayOfWeekPatterns[dayOfWeek].push(record.count);
        });

        // Calculate average attendance for each day of week
        const weeklyPattern = {};
        Object.keys(dayOfWeekPatterns).forEach(day => {
            weeklyPattern[day] = {
                average: ss.mean(dayOfWeekPatterns[day]),
                variance: ss.variance(dayOfWeekPatterns[day]),
                count: dayOfWeekPatterns[day].length
            };
        });

        return weeklyPattern;
    }

    /**
     * Get default seasonal patterns when data is limited
     */
    getDefaultSeasonalPatterns() {
        // Default patterns based on typical work week
        return {
            0: { average: 5, variance: 2, count: 1 },   // Sunday
            1: { average: 8, variance: 2, count: 1 },   // Monday  
            2: { average: 9, variance: 1.5, count: 1 }, // Tuesday
            3: { average: 9, variance: 1.5, count: 1 }, // Wednesday
            4: { average: 9, variance: 1.5, count: 1 }, // Thursday
            5: { average: 8.5, variance: 2, count: 1 }, // Friday
            6: { average: 4, variance: 2, count: 1 }    // Saturday
        };
    }

    /**
     * Generate attendance forecast for next N days (future only, max 30 days)
     */
    async generateForecast(days = 30) {
        try {
            // Limit forecast to maximum 30 days
            const maxDays = Math.min(days, 30);
            console.log(`🔮 Generating ${maxDays}-day future attendance forecast...`);

            if (!this.isModelTrained) {
                await this.loadTrainingData();
                await this.trainForecastModel();
            }

            const forecast = [];
            // Start forecast from TODAY (not from last data point)
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Start of today

            // Generate forecast for future days only
            for (let i = 1; i <= maxDays; i++) {
                const forecastDate = new Date(today);
                forecastDate.setDate(today.getDate() + i);

                const dayOfWeek = forecastDate.getDay();
                const timeIndex = this.trainingData.length + i;

                // Calculate trend component
                const trendValue = this.models.timeSeries.trend.m * timeIndex + this.models.timeSeries.trend.b;

                // Apply seasonal adjustment
                const seasonalMultiplier = this.models.seasonalPatterns[dayOfWeek]?.average || this.models.timeSeries.baselineAverage;
                const seasonalAdjustment = seasonalMultiplier / this.models.timeSeries.baselineAverage;

                // Calculate prediction with confidence intervals
                const prediction = Math.max(0, Math.round(trendValue * seasonalAdjustment));
                const confidence = this.models.timeSeries.standardDeviation * 1.96; // 95% confidence

                forecast.push({
                    date: forecastDate.toISOString().split('T')[0],
                    predicted: prediction,
                    lower: Math.max(0, Math.round(prediction - confidence)),
                    upper: Math.round(prediction + confidence),
                    formatted_date: forecastDate.toLocaleDateString(),
                    confidence_level: 0.95,
                    day_of_week: dayOfWeek,
                    is_future: true // Mark as future data
                });
            }

            console.log(`✅ Generated forecast for ${forecast.length} future days (starting tomorrow)`);
            return forecast;

        } catch (error) {
            console.error('❌ Error generating forecast:', error);
            throw error;
        }
    }

    /**
     * Get historical attendance data for charts
     */
    getHistoricalData() {
        return this.trainingData.map(record => ({
            date: record.date,
            value: record.count,
            formatted_date: new Date(record.date).toLocaleDateString(),
            uniqueUsers: record.uniqueUsers,
            latePercentage: record.latePercentage
        }));
    }

    /**
     * Get model performance metrics
     */
    getModelMetrics() {
        if (!this.isModelTrained) {
            return null;
        }

        const recentData = this.trainingData.slice(-14); // Last 2 weeks
        const predictions = recentData.map((_, index) => {
            const timeIndex = this.trainingData.length - 14 + index + 1;
            return this.models.timeSeries.trend.m * timeIndex + this.models.timeSeries.trend.b;
        });

        const actualValues = recentData.map(d => d.count);
        const mae = ss.mean(actualValues.map((actual, i) => Math.abs(actual - predictions[i])));
        const rmse = Math.sqrt(ss.mean(actualValues.map((actual, i) => Math.pow(actual - predictions[i], 2))));

        return {
            mae: mae.toFixed(1),
            rmse: rmse.toFixed(1),
            accuracy: Math.max(0, (100 - (mae / ss.mean(actualValues)) * 100)).toFixed(1),
            dataPoints: this.trainingData.length,
            lastTraining: new Date().toISOString()
        };
    }
}

export default new AttendanceForecastService();