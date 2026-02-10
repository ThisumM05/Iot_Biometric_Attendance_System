import Attendance from '../../models/Attendance.js';
import User from '../../models/User.js';
import AnalyticsCache from '../../models/AnalyticsCache.js';
import behaviorAnalysisService from './behaviorAnalysisService.js';

class PredictiveAnalyticsService {
    constructor() {
        this.predictionModels = {
            attendance: 'time_series_forecast',
            behavior: 'neural_network',
            occupancy: 'regression_model'
        };
    }

    /**
     * Generate comprehensive predictions
     */
    async generatePredictions(timeframe = 7) {
        try {
            const predictions = {
                attendanceForecast: await this.forecastAttendance(timeframe),
                userRiskAssessment: await this.assessUserRisks(),
                occupancyPredictions: await this.predictOccupancy(timeframe),
                temporalTrends: await this.analyzeTrends(),
                recommendedActions: []
            };

            // Generate recommended actions based on predictions
            predictions.recommendedActions = this.generateRecommendations(predictions);

            // Cache predictions
            await this.cachePredictions(predictions);

            return {
                success: true,
                generatedAt: new Date(),
                predictionPeriod: timeframe,
                predictions
            };

        } catch (error) {
            console.error('Error generating predictions:', error);
            throw error;
        }
    }

    /**
     * Forecast future attendance using time series analysis
     */
    async forecastAttendance(days = 7) {
        try {
            // Get historical attendance data (last 30 days)
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - 30);

            const historicalData = await Attendance.aggregate([
                {
                    $match: {
                        timestamp: { $gte: startDate, $lte: endDate }
                    }
                },
                {
                    $group: {
                        _id: {
                            year: { $year: '$timestamp' },
                            month: { $month: '$timestamp' },
                            day: { $dayOfMonth: '$timestamp' }
                        },
                        totalAttendance: { $sum: 1 },
                        onTimeCount: {
                            $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
                        },
                        lateCount: {
                            $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] }
                        }
                    }
                },
                {
                    $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
                }
            ]);

            // Simple moving average prediction (in production, use more sophisticated models)
            const forecast = this.calculateMovingAverageForecast(historicalData, days);

            return {
                historical: historicalData,
                forecast: forecast,
                period: days,
                confidence: this.calculateForecastConfidence(historicalData),
                trends: this.identifyTrends(historicalData)
            };

        } catch (error) {
            console.error('Error forecasting attendance:', error);
            throw error;
        }
    }

    /**
     * Calculate moving average forecast
     */
    calculateMovingAverageForecast(historicalData, forecastDays) {
        if (historicalData.length < 3) {
            // Not enough data, return conservative estimate
            return this.generateDefaultForecast(forecastDays);
        }

        // Calculate moving average of last 7 days
        const recentData = historicalData.slice(-7);
        const avgAttendance = recentData.reduce((sum, day) => sum + day.totalAttendance, 0) / recentData.length;
        const avgOnTimeRate = recentData.reduce((sum, day) => {
            return sum + (day.onTimeCount / day.totalAttendance || 0);
        }, 0) / recentData.length;

        const forecast = [];
        const today = new Date();

        for (let i = 1; i <= forecastDays; i++) {
            const forecastDate = new Date(today);
            forecastDate.setDate(today.getDate() + i);

            // Apply day-of-week factors
            const dayOfWeek = forecastDate.getDay();
            const dayFactor = this.getDayOfWeekFactor(dayOfWeek);

            const predictedAttendance = Math.round(avgAttendance * dayFactor);
            const predictedOnTime = Math.round(predictedAttendance * avgOnTimeRate);
            const predictedLate = predictedAttendance - predictedOnTime;

            forecast.push({
                date: forecastDate,
                predictedAttendance,
                predictedOnTime,
                predictedLate,
                onTimeRate: avgOnTimeRate,
                dayOfWeek: dayOfWeek,
                confidence: this.calculateDailyConfidence(historicalData, dayOfWeek)
            });
        }

        return forecast;
    }

    /**
     * Get day of week attendance factor
     */
    getDayOfWeekFactor(dayOfWeek) {
        // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        const factors = {
            0: 0.3, // Sunday
            1: 1.0, // Monday
            2: 1.1, // Tuesday
            3: 1.0, // Wednesday
            4: 0.9, // Thursday
            5: 0.8, // Friday
            6: 0.4  // Saturday
        };
        return factors[dayOfWeek] || 1.0;
    }

    /**
     * Assess risks for each user
     */
    async assessUserRisks() {
        try {
            const users = await User.find({ fingerprintId: { $ne: null } });
            const riskAssessments = [];

            for (const user of users) {
                const behavior = await behaviorAnalysisService.analyzeUserBehavior(user._id);

                riskAssessments.push({
                    userId: user._id,
                    username: user.username,
                    absenteeismRisk: behavior.riskAssessment.absenteeismRisk,
                    lateArrivalRisk: behavior.riskAssessment.lateArrivalRisk,
                    overallRisk: this.calculateOverallRisk(behavior.riskAssessment),
                    riskLevel: this.classifyRiskLevel(behavior.riskAssessment),
                    recommendedActions: this.generateUserRecommendations(behavior),
                    confidence: behavior.riskAssessment.confidenceLevel
                });
            }

            // Sort by overall risk (highest first)
            riskAssessments.sort((a, b) => b.overallRisk - a.overallRisk);

            return {
                totalUsers: users.length,
                highRiskUsers: riskAssessments.filter(r => r.riskLevel === 'high').length,
                mediumRiskUsers: riskAssessments.filter(r => r.riskLevel === 'medium').length,
                lowRiskUsers: riskAssessments.filter(r => r.riskLevel === 'low').length,
                assessments: riskAssessments
            };

        } catch (error) {
            console.error('Error assessing user risks:', error);
            throw error;
        }
    }

    /**
     * Predict occupancy levels
     */
    async predictOccupancy(days = 7) {
        try {
            // Get hourly attendance patterns
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - 30);

            const hourlyPatterns = await Attendance.aggregate([
                {
                    $match: {
                        timestamp: { $gte: startDate, $lte: endDate }
                    }
                },
                {
                    $group: {
                        _id: {
                            hour: { $hour: '$timestamp' },
                            dayOfWeek: { $dayOfWeek: '$timestamp' }
                        },
                        count: { $sum: 1 }
                    }
                }
            ]);

            // Generate occupancy predictions
            const occupancyForecast = [];
            const today = new Date();

            for (let day = 1; day <= days; day++) {
                const forecastDate = new Date(today);
                forecastDate.setDate(today.getDate() + day);
                const dayOfWeek = forecastDate.getDay();

                const dailyOccupancy = [];

                for (let hour = 6; hour <= 22; hour++) {
                    const historicalCount = hourlyPatterns
                        .filter(p => p._id.hour === hour && p._id.dayOfWeek === dayOfWeek)
                        .reduce((sum, p) => sum + p.count, 0);

                    const avgCount = historicalCount / 4; // Assuming 4 weeks of data

                    dailyOccupancy.push({
                        hour,
                        predictedOccupancy: Math.round(avgCount),
                        occupancyLevel: this.classifyOccupancyLevel(avgCount)
                    });
                }

                occupancyForecast.push({
                    date: forecastDate,
                    dayOfWeek,
                    hourlyOccupancy: dailyOccupancy,
                    peakOccupancy: Math.max(...dailyOccupancy.map(h => h.predictedOccupancy)),
                    averageOccupancy: dailyOccupancy.reduce((sum, h) => sum + h.predictedOccupancy, 0) / dailyOccupancy.length
                });
            }

            return occupancyForecast;

        } catch (error) {
            console.error('Error predicting occupancy:', error);
            throw error;
        }
    }

    /**
     * Analyze temporal trends
     */
    async analyzeTrends() {
        try {
            const endDate = new Date();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(endDate.getDate() - 30);
            const sixtyDaysAgo = new Date();
            sixtyDaysAgo.setDate(endDate.getDate() - 60);

            // Get recent and historical data for comparison
            const [recentData, historicalData] = await Promise.all([
                this.getAttendanceMetrics(thirtyDaysAgo, endDate),
                this.getAttendanceMetrics(sixtyDaysAgo, thirtyDaysAgo)
            ]);

            const trends = {
                attendance: {
                    current: recentData.totalAttendance,
                    previous: historicalData.totalAttendance,
                    change: this.calculatePercentageChange(historicalData.totalAttendance, recentData.totalAttendance),
                    trend: this.determineTrend(historicalData.totalAttendance, recentData.totalAttendance)
                },
                punctuality: {
                    current: recentData.onTimeRate,
                    previous: historicalData.onTimeRate,
                    change: this.calculatePercentageChange(historicalData.onTimeRate, recentData.onTimeRate),
                    trend: this.determineTrend(historicalData.onTimeRate, recentData.onTimeRate)
                },
                engagement: {
                    weekdayAttendance: recentData.weekdayAttendance,
                    weekendAttendance: recentData.weekendAttendance,
                    consistencyScore: this.calculateConsistencyScore(recentData)
                }
            };

            return trends;

        } catch (error) {
            console.error('Error analyzing trends:', error);
            throw error;
        }
    }

    /**
     * Generate recommendations based on predictions
     */
    generateRecommendations(predictions) {
        const recommendations = [];

        // High-risk users recommendations
        const highRiskUsers = predictions.userRiskAssessment.assessments
            .filter(u => u.riskLevel === 'high');

        if (highRiskUsers.length > 0) {
            recommendations.push({
                type: 'user_intervention',
                priority: 'high',
                title: `${highRiskUsers.length} users need immediate attention`,
                description: 'High absenteeism risk detected for several users',
                action: 'Schedule individual meetings with at-risk users',
                affectedUsers: highRiskUsers.slice(0, 5).map(u => u.username)
            });
        }

        // Capacity management recommendations
        const peakOccupancy = Math.max(...predictions.occupancyPredictions
            .flatMap(day => day.hourlyOccupancy.map(h => h.predictedOccupancy)));

        if (peakOccupancy > 45) { // Assuming capacity of 50
            recommendations.push({
                type: 'capacity_management',
                priority: 'medium',
                title: 'High occupancy expected',
                description: `Peak occupancy of ${peakOccupancy} people predicted`,
                action: 'Consider implementing staggered schedules or additional space',
                timeline: 'Next 7 days'
            });
        }

        // Attendance trend recommendations
        if (predictions.temporalTrends.attendance.trend === 'declining') {
            recommendations.push({
                type: 'engagement_improvement',
                priority: 'medium',
                title: 'Declining attendance trend detected',
                description: `Attendance has decreased by ${Math.abs(predictions.temporalTrends.attendance.change)}%`,
                action: 'Investigate causes and implement engagement strategies',
                trend: predictions.temporalTrends.attendance.change
            });
        }

        return recommendations;
    }

    /**
     * Helper methods
     */
    calculateOverallRisk(riskAssessment) {
        return (riskAssessment.absenteeismRisk * 0.6) +
            (riskAssessment.lateArrivalRisk * 0.3) +
            (riskAssessment.irregularityScore * 0.1);
    }

    classifyRiskLevel(riskAssessment) {
        const overall = this.calculateOverallRisk(riskAssessment);
        if (overall > 0.7) return 'high';
        if (overall > 0.4) return 'medium';
        return 'low';
    }

    classifyOccupancyLevel(count) {
        if (count > 40) return 'high';
        if (count > 25) return 'medium';
        return 'low';
    }

    calculatePercentageChange(oldValue, newValue) {
        if (oldValue === 0) return newValue > 0 ? 100 : 0;
        return Math.round(((newValue - oldValue) / oldValue) * 100);
    }

    determineTrend(oldValue, newValue) {
        const change = this.calculatePercentageChange(oldValue, newValue);
        if (change > 5) return 'improving';
        if (change < -5) return 'declining';
        return 'stable';
    }

    async getAttendanceMetrics(startDate, endDate) {
        const data = await Attendance.find({
            timestamp: { $gte: startDate, $lte: endDate }
        });

        const totalAttendance = data.length;
        const onTimeCount = data.filter(r => r.status === 'present').length;
        const weekdayCount = data.filter(r => {
            const day = new Date(r.timestamp).getDay();
            return day >= 1 && day <= 5;
        }).length;
        const weekendCount = totalAttendance - weekdayCount;

        return {
            totalAttendance,
            onTimeRate: totalAttendance > 0 ? (onTimeCount / totalAttendance) : 0,
            weekdayAttendance: weekdayCount,
            weekendAttendance: weekendCount
        };
    }

    generateDefaultForecast(days) {
        const forecast = [];
        const today = new Date();

        for (let i = 1; i <= days; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);

            forecast.push({
                date,
                predictedAttendance: 20, // Default estimate
                predictedOnTime: 16,
                predictedLate: 4,
                onTimeRate: 0.8,
                confidence: 0.3
            });
        }

        return forecast;
    }

    calculateForecastConfidence(historicalData) {
        const dataPoints = historicalData.length;
        if (dataPoints < 7) return 0.3;
        if (dataPoints < 14) return 0.6;
        if (dataPoints < 21) return 0.8;
        return 0.9;
    }

    calculateDailyConfidence(historicalData, dayOfWeek) {
        const dayData = historicalData.filter(d => {
            const date = new Date(d._id.year, d._id.month - 1, d._id.day);
            return date.getDay() === dayOfWeek;
        });

        return Math.min(dayData.length / 4, 1); // Confidence based on historical data points
    }

    identifyTrends(data) {
        if (data.length < 7) return { trend: 'insufficient_data' };

        const recent = data.slice(-7);
        const earlier = data.slice(-14, -7);

        const recentAvg = recent.reduce((sum, d) => sum + d.totalAttendance, 0) / recent.length;
        const earlierAvg = earlier.reduce((sum, d) => sum + d.totalAttendance, 0) / earlier.length;

        const change = this.calculatePercentageChange(earlierAvg, recentAvg);

        return {
            trend: this.determineTrend(earlierAvg, recentAvg),
            change: change,
            direction: change > 0 ? 'increasing' : 'decreasing'
        };
    }

    generateUserRecommendations(behavior) {
        const recommendations = [];

        if (behavior.riskAssessment.absenteeismRisk > 0.7) {
            recommendations.push('Schedule one-on-one meeting');
            recommendations.push('Review attendance policy');
        }

        if (behavior.riskAssessment.lateArrivalRisk > 0.6) {
            recommendations.push('Discuss schedule flexibility');
            recommendations.push('Provide time management resources');
        }

        if (behavior.behaviorPatterns.consistencyScore < 0.3) {
            recommendations.push('Identify attendance barriers');
            recommendations.push('Create attendance improvement plan');
        }

        return recommendations;
    }

    calculateConsistencyScore(data) {
        // Simple consistency measure based on attendance variance
        if (data.totalAttendance === 0) return 0;

        const weekdayRate = data.weekdayAttendance / (data.weekdayAttendance + data.weekendAttendance);
        return Math.min(weekdayRate * data.onTimeRate, 1);
    }

    async cachePredictions(predictions) {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            await AnalyticsCache.findOneAndUpdate(
                { analysisDate: today },
                {
                    $set: {
                        predictions: predictions,
                        generatedAt: new Date()
                    }
                },
                { upsert: true }
            );
        } catch (error) {
            console.error('Error caching predictions:', error);
        }
    }
}

export default new PredictiveAnalyticsService();