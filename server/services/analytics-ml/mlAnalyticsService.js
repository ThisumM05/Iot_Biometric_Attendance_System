import behaviorAnalysisService from './behaviorAnalysisService.js';
import anomalyDetectionService from './anomalyDetectionService.js';
import predictiveAnalyticsService from './predictiveAnalyticsService.js';
import visionAnalyticsService from './visionAnalyticsService.js';
import temporalAnalyticsService from './temporalAnalyticsService.js';
import AnalyticsCache from '../../models/AnalyticsCache.js';

class MLAnalyticsService {
    constructor() {
        this.isInitialized = false;
        this.analysisSchedules = new Map();
        this.realTimeProcessors = new Map();
    }

    /**
     * Initialize ML Analytics Service
     */
    async initialize() {
        try {
            console.log('Initializing ML Analytics Service...');
            
            // Start real-time vision processing
            this.startRealTimeVisionProcessing();
            
            // Schedule periodic analysis
            this.schedulePeriodicAnalysis();
            
            // Initialize behavior clustering
            await this.initializeBehaviorClustering();
            
            this.isInitialized = true;
            console.log('ML Analytics Service initialized successfully');
            
        } catch (error) {
            console.error('Error initializing ML Analytics Service:', error);
            throw error;
        }
    }

    /**
     * Process new attendance event with ML analytics
     */
    async processAttendanceEvent(attendanceData) {
        try {
            if (!this.isInitialized) {
                console.warn('ML Analytics Service not initialized, skipping ML processing');
                return;
            }

            console.log('Processing attendance event with ML analytics:', attendanceData.user);
            
            // Trigger real-time analysis
            const mlInsights = await Promise.allSettled([
                // Update user behavior analysis
                behaviorAnalysisService.analyzeUserBehavior(attendanceData.user),
                
                // Check for anomalies
                anomalyDetectionService.detectAnomalies(1), // Last 1 hour
                
                // Correlate with vision data if available
                visionAnalyticsService.correlateBiometricAttendance(60000) // 1 minute window
            ]);

            // Process ML insights
            const results = {
                userBehavior: mlInsights[0].status === 'fulfilled' ? mlInsights[0].value : null,
                anomalies: mlInsights[1].status === 'fulfilled' ? mlInsights[1].value : null,
                visionCorrelation: mlInsights[2].status === 'fulfilled' ? mlInsights[2].value : null
            };

            // Generate real-time alerts if needed
            const alerts = await this.generateRealTimeAlerts(results, attendanceData);
            
            // Emit ML insights via Socket.IO if available
            if (global.io) {
                global.io.emit('ml-insights', {
                    userId: attendanceData.user,
                    insights: results,
                    alerts: alerts,
                    timestamp: new Date()
                });
            }

            return {
                success: true,
                mlResults: results,
                alerts: alerts
            };

        } catch (error) {
            console.error('Error processing attendance event with ML:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Generate comprehensive dashboard analytics
     */
    async generateDashboardAnalytics() {
        try {
            console.log('Generating comprehensive dashboard analytics...');
            
            const analytics = await Promise.allSettled([
                // Behavior patterns analysis
                behaviorAnalysisService.analyzeAllUsersBehavior(),
                
                // Predictive analytics
                predictiveAnalyticsService.generatePredictions(7), // 7 days forecast
                
                // Temporal trends
                temporalAnalyticsService.generateTemporalAnalysis('monthly'),
                
                // Anomaly detection
                anomalyDetectionService.detectAnomalies(24), // Last 24 hours
                
                // Vision analytics
                visionAnalyticsService.getOccupancyAnalytics(24)
            ]);

            const dashboardData = {
                behaviorClusters: analytics[0].status === 'fulfilled' ? analytics[0].value : {},
                predictions: analytics[1].status === 'fulfilled' ? analytics[1].value : null,
                temporalTrends: analytics[2].status === 'fulfilled' ? analytics[2].value : null,
                anomalies: analytics[3].status === 'fulfilled' ? analytics[3].value : null,
                occupancyAnalytics: analytics[4].status === 'fulfilled' ? analytics[4].value : null,
                generatedAt: new Date()
            };

            // Cache dashboard analytics
            await this.cacheDashboardAnalytics(dashboardData);

            return {
                success: true,
                analytics: dashboardData,
                summary: this.generateAnalyticsSummary(dashboardData)
            };

        } catch (error) {
            console.error('Error generating dashboard analytics:', error);
            throw error;
        }
    }

    /**
     * Get real-time ML insights for dashboard
     */
    async getRealTimeInsights() {
        try {
            const insights = await Promise.allSettled([
                // Current occupancy
                visionAnalyticsService.getRealTimeOccupancy(),
                
                // Recent anomalies
                anomalyDetectionService.getRecentAnomalies(5),
                
                // Today's predictions vs actual
                this.getTodaysPredictionAccuracy()
            ]);

            return {
                currentOccupancy: insights[0].status === 'fulfilled' ? insights[0].value : null,
                recentAnomalies: insights[1].status === 'fulfilled' ? insights[1].value : [],
                predictionAccuracy: insights[2].status === 'fulfilled' ? insights[2].value : null,
                lastUpdated: new Date()
            };

        } catch (error) {
            console.error('Error getting real-time insights:', error);
            throw error;
        }
    }

    /**
     * Get user-specific ML insights
     */
    async getUserMLInsights(userId) {
        try {
            const insights = await behaviorAnalysisService.analyzeUserBehavior(userId);
            
            // Get user's risk assessment and recommendations
            const riskAssessment = await predictiveAnalyticsService.assessUserRisks();
            const userRisk = riskAssessment.assessments.find(a => a.userId.toString() === userId);
            
            return {
                success: true,
                userId,
                behaviorProfile: insights,
                riskAssessment: userRisk,
                recommendations: this.generateUserRecommendations(insights, userRisk)
            };

        } catch (error) {
            console.error('Error getting user ML insights:', error);
            throw error;
        }
    }

    /**
     * Start real-time vision processing
     */
    startRealTimeVisionProcessing() {
        try {
            // Start vision analytics for default camera
            const visionProcessorId = visionAnalyticsService.startRealTimeProcessing(
                'ESP32_CAM_001', 
                30000 // Process every 30 seconds
            );
            
            this.realTimeProcessors.set('vision_default', visionProcessorId);
            console.log('Real-time vision processing started');
            
        } catch (error) {
            console.error('Error starting real-time vision processing:', error);
        }
    }

    /**
     * Schedule periodic ML analysis
     */
    schedulePeriodicAnalysis() {
        try {
            // Full analytics every hour
            const fullAnalysisInterval = setInterval(async () => {
                try {
                    console.log('Running scheduled full ML analysis...');
                    await this.generateDashboardAnalytics();
                } catch (error) {
                    console.error('Error in scheduled full analysis:', error);
                }
            }, 60 * 60 * 1000); // 1 hour

            // Anomaly detection every 10 minutes
            const anomalyDetectionInterval = setInterval(async () => {
                try {
                    const anomalies = await anomalyDetectionService.detectAnomalies(1);
                    if (anomalies.anomalies && anomalies.anomalies.length > 0) {
                        console.log(`Detected ${anomalies.anomalies.length} anomalies`);
                        
                        // Emit critical anomalies via Socket.IO
                        const criticalAnomalies = anomalies.anomalies.filter(a => a.severity === 'critical' || a.severity === 'high');
                        if (criticalAnomalies.length > 0 && global.io) {
                            global.io.emit('critical-anomalies', {
                                anomalies: criticalAnomalies,
                                timestamp: new Date()
                            });
                        }
                    }
                } catch (error) {
                    console.error('Error in scheduled anomaly detection:', error);
                }
            }, 10 * 60 * 1000); // 10 minutes

            this.analysisSchedules.set('full_analysis', fullAnalysisInterval);
            this.analysisSchedules.set('anomaly_detection', anomalyDetectionInterval);
            
            console.log('Periodic ML analysis scheduled');
            
        } catch (error) {
            console.error('Error scheduling periodic analysis:', error);
        }
    }

    /**
     * Initialize behavior clustering for all users
     */
    async initializeBehaviorClustering() {
        try {
            console.log('Initializing behavior clustering...');
            const clusterData = await behaviorAnalysisService.analyzeAllUsersBehavior();
            console.log(`Behavior clustering completed. Found ${Object.keys(clusterData).length} clusters`);
            return clusterData;
        } catch (error) {
            console.error('Error initializing behavior clustering:', error);
        }
    }

    /**
     * Generate real-time alerts based on ML insights
     */
    async generateRealTimeAlerts(mlResults, attendanceData) {
        const alerts = [];

        try {
            // Check for high-risk behavior
            if (mlResults.userBehavior && mlResults.userBehavior.riskAssessment) {
                const risk = mlResults.userBehavior.riskAssessment;
                
                if (risk.absenteeismRisk > 0.8) {
                    alerts.push({
                        type: 'high_absence_risk',
                        severity: 'high',
                        message: 'User showing high absenteeism risk',
                        userId: attendanceData.user,
                        confidence: risk.confidenceLevel
                    });
                }
                
                if (risk.lateArrivalRisk > 0.8 && attendanceData.status === 'late') {
                    alerts.push({
                        type: 'chronic_lateness',
                        severity: 'medium',
                        message: 'User consistently arriving late',
                        userId: attendanceData.user,
                        confidence: risk.confidenceLevel
                    });
                }
            }

            // Check for anomalies
            if (mlResults.anomalies && mlResults.anomalies.anomalies) {
                const userAnomalies = mlResults.anomalies.anomalies.filter(
                    a => a.userId && a.userId.toString() === attendanceData.user.toString()
                );
                
                userAnomalies.forEach(anomaly => {
                    if (anomaly.severity === 'high' || anomaly.severity === 'critical') {
                        alerts.push({
                            type: 'anomaly_detected',
                            severity: anomaly.severity,
                            message: anomaly.description,
                            userId: attendanceData.user,
                            anomalyType: anomaly.type
                        });
                    }
                });
            }

            // Check vision correlation
            if (mlResults.visionCorrelation && mlResults.visionCorrelation.correlations) {
                const lowConfidenceCorrelations = mlResults.visionCorrelation.correlations.filter(
                    c => c.correlationConfidence < 0.5
                );
                
                if (lowConfidenceCorrelations.length > 0) {
                    alerts.push({
                        type: 'vision_correlation_low',
                        severity: 'medium',
                        message: 'Low confidence in biometric-vision correlation',
                        userId: attendanceData.user,
                        confidence: lowConfidenceCorrelations[0].correlationConfidence
                    });
                }
            }

        } catch (error) {
            console.error('Error generating real-time alerts:', error);
        }

        return alerts;
    }

    /**
     * Generate analytics summary for dashboard
     */
    generateAnalyticsSummary(dashboardData) {
        const summary = {
            totalUsers: 0,
            activeUsers: 0,
            averagePunctuality: 0,
            currentOccupancy: 0,
            todayAnomalies: 0,
            predictedTrend: 'stable',
            systemHealth: 'good'
        };

        try {
            // Behavior clusters summary
            if (dashboardData.behaviorClusters) {
                const clusters = dashboardData.behaviorClusters;
                summary.totalUsers = Object.values(clusters).reduce((total, users) => total + users.length, 0);
                
                const allUsers = Object.values(clusters).flat();
                if (allUsers.length > 0) {
                    summary.averagePunctuality = Math.round(
                        (allUsers.reduce((sum, user) => sum + user.punctuality, 0) / allUsers.length) * 100
                    );
                }
            }

            // Occupancy summary
            if (dashboardData.occupancyAnalytics && dashboardData.occupancyAnalytics.summary) {
                summary.currentOccupancy = dashboardData.occupancyAnalytics.summary.averageOccupancy;
            }

            // Anomalies summary
            if (dashboardData.anomalies && dashboardData.anomalies.anomalies) {
                summary.todayAnomalies = dashboardData.anomalies.anomalies.length;
            }

            // Prediction trends
            if (dashboardData.predictions && dashboardData.predictions.predictions.temporalTrends) {
                const trends = dashboardData.predictions.predictions.temporalTrends;
                if (trends.attendance) {
                    summary.predictedTrend = trends.attendance.trend;
                }
            }

        } catch (error) {
            console.error('Error generating analytics summary:', error);
        }

        return summary;
    }

    /**
     * Generate user-specific recommendations
     */
    generateUserRecommendations(behaviorProfile, riskAssessment) {
        const recommendations = [];

        if (!behaviorProfile || !riskAssessment) return recommendations;

        try {
            // Punctuality recommendations
            if (behaviorProfile.behaviorPatterns.punctualityScore < 0.7) {
                recommendations.push({
                    type: 'punctuality',
                    priority: 'medium',
                    title: 'Improve Punctuality',
                    description: 'Consider setting earlier alarms or reviewing your morning routine',
                    action: 'Schedule discussion with supervisor'
                });
            }

            // Consistency recommendations
            if (behaviorProfile.behaviorPatterns.consistencyScore < 0.5) {
                recommendations.push({
                    type: 'consistency',
                    priority: 'high',
                    title: 'Improve Attendance Consistency',
                    description: 'Irregular attendance pattern detected',
                    action: 'Create a structured daily routine'
                });
            }

            // Risk-based recommendations
            if (riskAssessment.riskLevel === 'high') {
                recommendations.push({
                    type: 'intervention',
                    priority: 'high',
                    title: 'Immediate Attention Required',
                    description: 'High risk of attendance issues detected',
                    action: 'Schedule one-on-one meeting'
                });
            }

        } catch (error) {
            console.error('Error generating user recommendations:', error);
        }

        return recommendations;
    }

    /**
     * Get today's prediction accuracy
     */
    async getTodaysPredictionAccuracy() {
        try {
            // This would compare today's predicted vs actual attendance
            // Simplified implementation for now
            return {
                predictedAttendance: 25,
                actualAttendance: 23,
                accuracy: 92,
                status: 'good'
            };
        } catch (error) {
            console.error('Error getting prediction accuracy:', error);
            return null;
        }
    }

    /**
     * Cache dashboard analytics
     */
    async cacheDashboardAnalytics(analyticsData) {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            await AnalyticsCache.findOneAndUpdate(
                { analysisDate: today },
                {
                    $set: {
                        dashboardAnalytics: analyticsData,
                        generatedAt: new Date()
                    }
                },
                { upsert: true }
            );
        } catch (error) {
            console.error('Error caching dashboard analytics:', error);
        }
    }

    /**
     * Cleanup and shutdown
     */
    async shutdown() {
        try {
            console.log('Shutting down ML Analytics Service...');
            
            // Clear intervals
            for (const [name, intervalId] of this.analysisSchedules) {
                clearInterval(intervalId);
                console.log(`Cleared ${name} schedule`);
            }
            
            // Stop real-time processors
            for (const [name, processorId] of this.realTimeProcessors) {
                clearInterval(processorId);
                console.log(`Stopped ${name} processor`);
            }
            
            this.isInitialized = false;
            console.log('ML Analytics Service shutdown complete');
            
        } catch (error) {
            console.error('Error shutting down ML Analytics Service:', error);
        }
    }
}

export default new MLAnalyticsService();