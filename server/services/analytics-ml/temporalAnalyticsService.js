/**
 * Temporal Analytics Service
 * Analyzes time-based attendance patterns and trends
 * Handles forecasting and time-series analysis
 */

class TemporalAnalyticsService {
    constructor() {
        this.isInitialized = false;
        this.timePatterns = new Map();
    }

    async initialize() {
        console.log('Temporal Analytics Service initialized');
        this.isInitialized = true;
        return { success: true };
    }

    /**
     * Analyze temporal patterns in attendance data
     */
    async analyzeTemporalPatterns(attendanceData) {
        try {
            const patterns = await this.extractTimePatterns(attendanceData);
            const trends = await this.calculateTrends(attendanceData);
            const forecast = await this.generateForecast(patterns);
            
            // Store temporal insights
            await this.storeTemporalInsights({
                patterns,
                trends,
                forecast,
                user: attendanceData.user,
                timestamp: attendanceData.timestamp
            });
            
            return {
                success: true,
                patterns,
                trends,
                forecast,
                insights: this.generateTemporalInsights(patterns, trends)
            };
            
        } catch (error) {
            console.error('Temporal Analytics Error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Extract time-based patterns from user attendance
     */
    async extractTimePatterns(attendanceData) {
        try {
            const { default: DailyAttendance } = await import('../../models/DailyAttendance.js');
            
            // Get user's historical attendance data
            const historicalData = await DailyAttendance.find({
                user: attendanceData.user
            }).sort({ date: -1 }).limit(30).lean();

            const patterns = {
                dailyPattern: this.analyzeDailyPattern(historicalData),
                weeklyPattern: this.analyzeWeeklyPattern(historicalData),
                timeSlotPreference: this.analyzeTimeSlotPreference(historicalData),
                consistencyScore: this.calculateConsistencyScore(historicalData),
                avgEntryTime: this.calculateAverageEntryTime(historicalData),
                avgExitTime: this.calculateAverageExitTime(historicalData),
                attendanceRate: this.calculateAttendanceRate(historicalData)
            };

            // Update patterns cache
            this.timePatterns.set(attendanceData.user.toString(), patterns);

            return patterns;
            
        } catch (error) {
            console.error('Failed to extract time patterns:', error);
            return this.getDefaultPatterns();
        }
    }

    /**
     * Analyze daily attendance patterns
     */
    analyzeDailyPattern(historicalData) {
        const hourCounts = new Array(24).fill(0);
        
        historicalData.forEach(record => {
            if (record.entryTime) {
                const hour = new Date(record.entryTime).getHours();
                hourCounts[hour]++;
            }
        });

        const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
        
        return {
            hourDistribution: hourCounts,
            peakHour,
            mostActiveTime: `${peakHour}:00-${peakHour + 1}:00`,
            totalEntries: hourCounts.reduce((a, b) => a + b, 0)
        };
    }

    /**
     * Analyze weekly attendance patterns
     */
    analyzeWeeklyPattern(historicalData) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayCounts = new Array(7).fill(0);
        
        historicalData.forEach(record => {
            const dayOfWeek = new Date(record.date).getDay();
            if (record.status === 'present' || record.entryTime) {
                dayCounts[dayOfWeek]++;
            }
        });

        const mostActiveDay = dayCounts.indexOf(Math.max(...dayCounts));
        
        return {
            dayDistribution: dayCounts,
            mostActiveDay: dayNames[mostActiveDay],
            weekdayAvg: dayCounts.slice(1, 6).reduce((a, b) => a + b, 0) / 5,
            weekendAvg: (dayCounts[0] + dayCounts[6]) / 2
        };
    }

    /**
     * Analyze preferred time slots
     */
    analyzeTimeSlotPreference(historicalData) {
        const timeSlots = {
            'Early Morning (6-9)': 0,
            'Morning (9-12)': 0,
            'Afternoon (12-15)': 0,
            'Late Afternoon (15-18)': 0,
            'Evening (18-21)': 0
        };

        historicalData.forEach(record => {
            if (record.entryTime) {
                const hour = new Date(record.entryTime).getHours();
                if (hour >= 6 && hour < 9) timeSlots['Early Morning (6-9)']++;
                else if (hour >= 9 && hour < 12) timeSlots['Morning (9-12)']++;
                else if (hour >= 12 && hour < 15) timeSlots['Afternoon (12-15)']++;
                else if (hour >= 15 && hour < 18) timeSlots['Late Afternoon (15-18)']++;
                else if (hour >= 18 && hour < 21) timeSlots['Evening (18-21)']++;
            }
        });

        const preferredSlot = Object.keys(timeSlots).reduce((a, b) => 
            timeSlots[a] > timeSlots[b] ? a : b
        );

        return {
            timeSlots,
            preferredSlot,
            consistency: this.calculateTimeConsistency(timeSlots)
        };
    }

    /**
     * Calculate attendance consistency score
     */
    calculateConsistencyScore(historicalData) {
        if (historicalData.length === 0) return 0;

        const entryTimes = historicalData
            .filter(record => record.entryTime)
            .map(record => new Date(record.entryTime).getHours() + new Date(record.entryTime).getMinutes() / 60);

        if (entryTimes.length < 2) return 0;

        const avg = entryTimes.reduce((a, b) => a + b, 0) / entryTimes.length;
        const variance = entryTimes.reduce((acc, time) => acc + Math.pow(time - avg, 2), 0) / entryTimes.length;
        const standardDeviation = Math.sqrt(variance);

        // Convert to 0-100 score (lower deviation = higher score)
        return Math.max(0, 100 - (standardDeviation * 10));
    }

    /**
     * Calculate average entry and exit times
     */
    calculateAverageEntryTime(historicalData) {
        const entryTimes = historicalData
            .filter(record => record.entryTime)
            .map(record => {
                const date = new Date(record.entryTime);
                return date.getHours() + date.getMinutes() / 60;
            });

        if (entryTimes.length === 0) return null;

        const avg = entryTimes.reduce((a, b) => a + b, 0) / entryTimes.length;
        const hours = Math.floor(avg);
        const minutes = Math.floor((avg - hours) * 60);
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    calculateAverageExitTime(historicalData) {
        const exitTimes = historicalData
            .filter(record => record.exitTime)
            .map(record => {
                const date = new Date(record.exitTime);
                return date.getHours() + date.getMinutes() / 60;
            });

        if (exitTimes.length === 0) return null;

        const avg = exitTimes.reduce((a, b) => a + b, 0) / exitTimes.length;
        const hours = Math.floor(avg);
        const minutes = Math.floor((avg - hours) * 60);
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    /**
     * Calculate attendance rate
     */
    calculateAttendanceRate(historicalData) {
        if (historicalData.length === 0) return 0;
        
        const presentDays = historicalData.filter(record => 
            record.status === 'present' || record.entryTime
        ).length;
        
        return (presentDays / historicalData.length) * 100;
    }

    /**
     * Calculate trends over time
     */
    async calculateTrends(attendanceData) {
        try {
            const { default: DailyAttendance } = await import('../../models/DailyAttendance.js');
            
            // Get recent trend data
            const recentData = await DailyAttendance.find({
                user: attendanceData.user,
                date: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } // Last 2 weeks
            }).sort({ date: 1 }).lean();

            return {
                attendanceTrend: this.calculateAttendanceTrend(recentData),
                punctualityTrend: this.calculatePunctualityTrend(recentData),
                durationTrend: this.calculateDurationTrend(recentData),
                weeklyComparison: this.compareWeeks(recentData)
            };
            
        } catch (error) {
            console.error('Failed to calculate trends:', error);
            return this.getDefaultTrends();
        }
    }

    /**
     * Generate forecast based on patterns
     */
    async generateForecast(patterns) {
        try {
            // Simple forecasting based on historical patterns
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            const dayOfWeek = tomorrow.getDay();
            const probabilities = patterns.weeklyPattern?.dayDistribution || new Array(7).fill(0.5);
            
            const attendanceProbability = probabilities[dayOfWeek] / Math.max(...probabilities);
            const predictedEntryTime = patterns.avgEntryTime;
            
            return {
                attendanceProbability: Math.min(attendanceProbability * patterns.attendanceRate / 100, 1),
                predictedEntryTime,
                confidenceScore: Math.min(patterns.consistencyScore / 100, 0.95),
                riskFactors: this.identifyRiskFactors(patterns),
                recommendations: this.generateRecommendations(patterns)
            };
            
        } catch (error) {
            console.error('Failed to generate forecast:', error);
            return this.getDefaultForecast();
        }
    }

    /**
     * Store temporal insights in database
     */
    async storeTemporalInsights(insights) {
        try {
            const { default: MLInsights } = await import('../../models/MLInsights.js');
            
            await MLInsights.create({
                type: 'temporal',
                user: insights.user,
                data: {
                    patterns: insights.patterns,
                    trends: insights.trends,
                    forecast: insights.forecast
                },
                timestamp: insights.timestamp,
                confidence: insights.forecast?.confidenceScore || 0.5
            });

            console.log(`[Temporal Analytics] Stored insights for user: ${insights.user}`);
            
        } catch (error) {
            console.error('Failed to store temporal insights:', error);
        }
    }

    /**
     * Generate insights from temporal analysis
     */
    generateTemporalInsights(patterns, trends) {
        const insights = [];

        // High consistency
        if (patterns.consistencyScore > 80) {
            insights.push({
                type: 'high_consistency',
                message: `Very consistent attendance pattern (${Math.round(patterns.consistencyScore)}% consistency)`,
                significance: 'positive'
            });
        }

        // Low attendance rate
        if (patterns.attendanceRate < 70) {
            insights.push({
                type: 'low_attendance',
                message: `Below average attendance rate (${Math.round(patterns.attendanceRate)}%)`,
                significance: 'warning'
            });
        }

        // Strong time preference
        if (patterns.timeSlotPreference?.consistency > 0.7) {
            insights.push({
                type: 'time_preference',
                message: `Strong preference for ${patterns.timeSlotPreference.preferredSlot}`,
                significance: 'info'
            });
        }

        return insights;
    }

    /**
     * Get temporal trends for dashboard
     */
    async getTemporalTrends(days = 30) {
        try {
            const { default: DailyAttendance } = await import('../../models/DailyAttendance.js');
            
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            
            const data = await DailyAttendance.aggregate([
                { $match: { date: { $gte: startDate.toISOString().split('T')[0] } } },
                {
                    $group: {
                        _id: '$date',
                        total: { $sum: 1 },
                        present: { $sum: { $cond: [{ $ne: ['$status', 'absent'] }, 1, 0] } },
                        avgEntryTime: { 
                            $avg: { 
                                $cond: [
                                    { $ne: ['$entryTime', null] },
                                    { $hour: '$entryTime' },
                                    null
                                ]
                            }
                        }
                    }
                },
                { $sort: { _id: 1 } }
            ]);

            return data.map(item => ({
                date: item._id,
                timeSlot: item._id,
                count: item.present,
                total: item.total,
                rate: Math.round((item.present / item.total) * 100),
                avgEntryTime: item.avgEntryTime ? Math.round(item.avgEntryTime) : null
            }));
            
        } catch (error) {
            console.error('Failed to get temporal trends:', error);
            return [];
        }
    }

    // Helper methods for default values and calculations
    getDefaultPatterns() {
        return {
            dailyPattern: { hourDistribution: new Array(24).fill(0), peakHour: 9 },
            weeklyPattern: { dayDistribution: new Array(7).fill(0), mostActiveDay: 'Monday' },
            timeSlotPreference: { preferredSlot: 'Morning (9-12)', consistency: 0 },
            consistencyScore: 0,
            avgEntryTime: '09:00',
            avgExitTime: '17:00',
            attendanceRate: 0
        };
    }

    getDefaultTrends() {
        return {
            attendanceTrend: 'stable',
            punctualityTrend: 'stable',
            durationTrend: 'stable',
            weeklyComparison: { improvement: 0 }
        };
    }

    getDefaultForecast() {
        return {
            attendanceProbability: 0.5,
            predictedEntryTime: '09:00',
            confidenceScore: 0.3,
            riskFactors: [],
            recommendations: []
        };
    }

    calculateTimeConsistency(timeSlots) {
        const values = Object.values(timeSlots);
        const max = Math.max(...values);
        const total = values.reduce((a, b) => a + b, 0);
        return total > 0 ? max / total : 0;
    }

    calculateAttendanceTrend(recentData) {
        if (recentData.length < 7) return 'insufficient_data';
        
        const firstWeek = recentData.slice(0, 7);
        const secondWeek = recentData.slice(7, 14);
        
        const firstWeekRate = firstWeek.filter(d => d.status === 'present').length / 7;
        const secondWeekRate = secondWeek.filter(d => d.status === 'present').length / 7;
        
        const difference = secondWeekRate - firstWeekRate;
        
        if (difference > 0.1) return 'improving';
        if (difference < -0.1) return 'declining';
        return 'stable';
    }

    calculatePunctualityTrend(recentData) {
        // Simplified punctuality calculation
        return 'stable';
    }

    calculateDurationTrend(recentData) {
        // Simplified duration calculation
        return 'stable';
    }

    compareWeeks(recentData) {
        return { improvement: 0 };
    }

    identifyRiskFactors(patterns) {
        const risks = [];
        
        if (patterns.attendanceRate < 60) {
            risks.push('Low attendance rate');
        }
        
        if (patterns.consistencyScore < 40) {
            risks.push('Inconsistent timing');
        }
        
        return risks;
    }

    generateRecommendations(patterns) {
        const recommendations = [];
        
        if (patterns.attendanceRate < 80) {
            recommendations.push('Consider setting attendance reminders');
        }
        
        if (patterns.consistencyScore < 60) {
            recommendations.push('Try to establish a consistent routine');
        }
        
        return recommendations;
    }
}

export default new TemporalAnalyticsService();