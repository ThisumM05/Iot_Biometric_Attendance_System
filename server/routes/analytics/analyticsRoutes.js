import express from 'express';
import mlAnalyticsService from '../../services/analytics-ml/mlAnalyticsService.js';
import behaviorAnalysisService from '../../services/analytics-ml/behaviorAnalysisService.js';
import anomalyDetectionService from '../../services/analytics-ml/anomalyDetectionService.js';
import predictiveAnalyticsService from '../../services/analytics-ml/predictiveAnalyticsService.js';
import visionAnalyticsService from '../../services/analytics-ml/visionAnalyticsService.js';
import temporalAnalyticsService from '../../services/analytics-ml/temporalAnalyticsService.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/analytics/dashboard
 * Get comprehensive dashboard analytics
 */
router.get('/dashboard', async (req, res) => {
    try {
        console.log('Generating dashboard analytics...');
        const analytics = await mlAnalyticsService.generateDashboardAnalytics();
        
        res.json({
            success: true,
            message: 'Dashboard analytics generated successfully',
            data: analytics
        });
        
    } catch (error) {
        console.error('Error generating dashboard analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate dashboard analytics',
            error: error.message
        });
    }
});

/**
 * GET /api/analytics/realtime
 * Get real-time ML insights
 */
router.get('/realtime', async (req, res) => {
    try {
        const insights = await mlAnalyticsService.getRealTimeInsights();
        
        res.json({
            success: true,
            message: 'Real-time insights retrieved successfully',
            data: insights
        });
        
    } catch (error) {
        console.error('Error getting real-time insights:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get real-time insights',
            error: error.message
        });
    }
});

/**
 * GET /api/analytics/behavior/patterns
 * Get behavior pattern analysis for all users
 */
router.get('/behavior/patterns', async (req, res) => {
    try {
        const patterns = await behaviorAnalysisService.analyzeAllUsersBehavior();
        
        res.json({
            success: true,
            message: 'Behavior patterns analyzed successfully',
            data: patterns
        });
        
    } catch (error) {
        console.error('Error analyzing behavior patterns:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to analyze behavior patterns',
            error: error.message
        });
    }
});

/**
 * GET /api/analytics/behavior/user/:userId
 * Get behavior analysis for specific user
 */
router.get('/behavior/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const insights = await mlAnalyticsService.getUserMLInsights(userId);
        
        res.json({
            success: true,
            message: 'User behavior analysis completed',
            data: insights
        });
        
    } catch (error) {
        console.error('Error analyzing user behavior:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to analyze user behavior',
            error: error.message
        });
    }
});

/**
 * GET /api/analytics/predictions
 * Get predictive analytics
 */
router.get('/predictions', async (req, res) => {
    try {
        const { timeframe = 7 } = req.query;
        const predictions = await predictiveAnalyticsService.generatePredictions(parseInt(timeframe));
        
        res.json({
            success: true,
            message: 'Predictions generated successfully',
            data: predictions
        });
        
    } catch (error) {
        console.error('Error generating predictions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate predictions',
            error: error.message
        });
    }
});

/**
 * GET /api/analytics/anomalies
 * Get anomaly detection results
 */
router.get('/anomalies', async (req, res) => {
    try {
        const { timeframe = 24 } = req.query;
        const anomalies = await anomalyDetectionService.detectAnomalies(parseInt(timeframe));
        
        res.json({
            success: true,
            message: 'Anomaly detection completed',
            data: anomalies
        });
        
    } catch (error) {
        console.error('Error detecting anomalies:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to detect anomalies',
            error: error.message
        });
    }
});

/**
 * GET /api/analytics/anomalies/recent
 * Get recent anomalies for dashboard alerts
 */
router.get('/anomalies/recent', async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const anomalies = await anomalyDetectionService.getRecentAnomalies(parseInt(limit));
        
        res.json({
            success: true,
            message: 'Recent anomalies retrieved',
            data: anomalies
        });
        
    } catch (error) {
        console.error('Error getting recent anomalies:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get recent anomalies',
            error: error.message
        });
    }
});

/**
 * GET /api/analytics/temporal/trends
 * Get temporal trends analysis
 */
router.get('/temporal/trends', async (req, res) => {
    try {
        const { timeframe = 'monthly' } = req.query;
        const trends = await temporalAnalyticsService.generateTemporalAnalysis(timeframe);
        
        res.json({
            success: true,
            message: 'Temporal trends analyzed successfully',
            data: trends
        });
        
    } catch (error) {
        console.error('Error analyzing temporal trends:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to analyze temporal trends',
            error: error.message
        });
    }
});

/**
 * GET /api/analytics/vision/occupancy
 * Get occupancy analytics
 */
router.get('/vision/occupancy', async (req, res) => {
    try {
        const { timeframe = 24 } = req.query;
        const occupancy = await visionAnalyticsService.getOccupancyAnalytics(parseInt(timeframe));
        
        res.json({
            success: true,
            message: 'Occupancy analytics retrieved',
            data: occupancy
        });
        
    } catch (error) {
        console.error('Error getting occupancy analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get occupancy analytics',
            error: error.message
        });
    }
});

/**
 * GET /api/analytics/vision/realtime
 * Get real-time occupancy data
 */
router.get('/vision/realtime', async (req, res) => {
    try {
        const { deviceId } = req.query;
        const occupancy = await visionAnalyticsService.getRealTimeOccupancy(deviceId);
        
        res.json({
            success: true,
            message: 'Real-time occupancy data retrieved',
            data: occupancy
        });
        
    } catch (error) {
        console.error('Error getting real-time occupancy:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get real-time occupancy',
            error: error.message
        });
    }
});

/**
 * POST /api/analytics/vision/process
 * Manually trigger vision processing
 */
router.post('/vision/process', async (req, res) => {
    try {
        const { deviceId = 'ESP32_CAM_001', imageData } = req.body;
        const result = await visionAnalyticsService.processCameraFrame(deviceId, imageData);
        
        res.json({
            success: true,
            message: 'Vision processing completed',
            data: result
        });
        
    } catch (error) {
        console.error('Error processing vision frame:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process vision frame',
            error: error.message
        });
    }
});

/**
 * GET /api/analytics/clustering
 * Get user behavior clustering data for scatter plot visualization
 */
router.get('/clustering', async (req, res) => {
    try {
        const clusterData = await behaviorAnalysisService.analyzeAllUsersBehavior();
        
        // Transform data for scatter plot visualization
        const scatterPlotData = [];
        Object.entries(clusterData).forEach(([cluster, users]) => {
            users.forEach((user, index) => {
                scatterPlotData.push({
                    x: user.punctuality * 100, // Punctuality percentage
                    y: user.consistency * 100,  // Consistency percentage
                    cluster: cluster,
                    userId: user.userId,
                    username: user.username,
                    risk: user.risk,
                    size: Math.max(10, (1 - user.risk) * 20) // Risk-based bubble size
                });
            });
        });
        
        res.json({
            success: true,
            message: 'Clustering data prepared for visualization',
            data: {
                clusters: clusterData,
                scatterPlotData: scatterPlotData,
                legendData: Object.keys(clusterData).map(cluster => ({
                    name: cluster,
                    count: clusterData[cluster].length
                }))
            }
        });
        
    } catch (error) {
        console.error('Error getting clustering data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get clustering data',
            error: error.message
        });
    }
});

/**
 * GET /api/analytics/forecast
 * Get time-series forecasting data for line charts
 */
router.get('/forecast', async (req, res) => {
    try {
        const { days = 7 } = req.query;
        const predictions = await predictiveAnalyticsService.generatePredictions(parseInt(days));
        
        // Format data for line chart visualization
        const forecast = predictions.predictions.attendanceForecast;
        
        const chartData = {
            historical: forecast.historical.map(day => ({
                date: new Date(day._id.year, day._id.month - 1, day._id.day).toISOString().split('T')[0],
                actual: day.totalAttendance,
                onTime: day.onTimeCount,
                late: day.lateCount
            })),
            predicted: forecast.forecast.map(day => ({
                date: day.date.toISOString().split('T')[0],
                predicted: day.predictedAttendance,
                onTime: day.predictedOnTime,
                late: day.predictedLate,
                confidence: day.confidence
            }))
        };
        
        res.json({
            success: true,
            message: 'Forecast data prepared for visualization',
            data: {
                chartData,
                confidence: forecast.confidence,
                trends: forecast.trends
            }
        });
        
    } catch (error) {
        console.error('Error getting forecast data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get forecast data',
            error: error.message
        });
    }
});

/**
 * GET /api/analytics/heatmap
 * Get occupancy heatmap data
 */
router.get('/heatmap', async (req, res) => {
    try {
        const { timeframe = 24 } = req.query;
        const occupancyData = await visionAnalyticsService.getOccupancyAnalytics(parseInt(timeframe));
        
        res.json({
            success: true,
            message: 'Heatmap data retrieved',
            data: {
                heatmapData: occupancyData.heatmapData,
                summary: occupancyData.summary,
                trends: occupancyData.occupancyTrends
            }
        });
        
    } catch (error) {
        console.error('Error getting heatmap data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get heatmap data',
            error: error.message
        });
    }
});

// Get user behavior analytics
router.get('/users', async (req, res) => {
    try {
        // For now, return dummy data - will be replaced with real ML analysis
        const dummyUsers = [
            {
                id: 'U001',
                name: 'John Doe',
                email: 'john.doe@school.edu',
                fingerprintId: 'FP001',
                riskLevel: 'Low',
                behaviorCluster: 'Early Birds',
                averageArrival: '07:45',
                attendanceRate: 95,
                punctualityScore: 92,
                lastSeen: '2026-02-11T07:43:00Z'
            },
            {
                id: 'U002',
                name: 'Sarah Smith',
                email: 'sarah.smith@school.edu',
                fingerprintId: 'FP002',
                riskLevel: 'Medium',
                behaviorCluster: 'Regular',
                averageArrival: '08:15',
                attendanceRate: 88,
                punctualityScore: 78,
                lastSeen: '2026-02-11T08:18:00Z'
            },
            {
                id: 'U003',
                name: 'Mike Johnson',
                email: 'mike.johnson@school.edu',
                fingerprintId: 'FP003',
                riskLevel: 'High',
                behaviorCluster: 'Frequently Late',
                averageArrival: '08:45',
                attendanceRate: 76,
                punctualityScore: 45,
                lastSeen: '2026-02-10T09:15:00Z'
            },
            {
                id: 'U004',
                name: 'Emma Wilson',
                email: 'emma.wilson@school.edu',
                fingerprintId: 'FP004',
                riskLevel: 'Very Low',
                behaviorCluster: 'Punctual',
                averageArrival: '08:00',
                attendanceRate: 98,
                punctualityScore: 98,
                lastSeen: '2026-02-11T07:58:00Z'
            },
            {
                id: 'U005',
                name: 'David Lee',
                email: 'david.lee@school.edu',
                fingerprintId: 'FP005',
                riskLevel: 'Very High',
                behaviorCluster: 'Irregular',
                averageArrival: '09:30',
                attendanceRate: 62,
                punctualityScore: 25,
                lastSeen: '2026-02-09T10:45:00Z'
            }
        ];

        res.json({
            success: true,
            data: dummyUsers
        });

    } catch (error) {
        console.error('Error fetching user behavior analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching user behavior analytics',
            error: error.message
        });
    }
});

// Get individual user behavior details
router.get('/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // For now, return detailed dummy data - will be replaced with real ML analysis
        const userDetails = {
            'U001': {
                id: 'U001',
                name: 'John Doe',
                email: 'john.doe@school.edu',
                fingerprintId: 'FP001',
                riskLevel: 'Low',
                behaviorCluster: 'Early Birds',
                averageArrival: '07:45',
                attendanceRate: 95,
                punctualityScore: 92,
                lastSeen: '2026-02-11T07:43:00Z',
                weeklyPattern: [
                    { day: 'Mon', arrival: '07:45', status: 'on-time' },
                    { day: 'Tue', arrival: '07:42', status: 'early' },
                    { day: 'Wed', arrival: '07:48', status: 'on-time' },
                    { day: 'Thu', arrival: '07:40', status: 'early' },
                    { day: 'Fri', arrival: '07:50', status: 'on-time' }
                ],
                monthlyAttendance: [
                    { month: 'Oct', present: 22, absent: 1 },
                    { month: 'Nov', present: 21, absent: 2 },
                    { month: 'Dec', present: 18, absent: 1 },
                    { month: 'Jan', present: 23, absent: 0 },
                    { month: 'Feb', present: 8, absent: 0 }
                ],
                behaviorInsights: [
                    'Consistently arrives early (7:40-7:50 AM)',
                    'Never missed a day this month',
                    'Strong punctuality pattern',
                    'Belongs to "Early Birds" cluster'
                ],
                anomalies: []
            },
            // Add other users' detailed data as needed...
        };

        const userData = userDetails[userId];
        
        if (!userData) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            data: userData
        });

    } catch (error) {
        console.error('Error fetching user details:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching user details',
            error: error.message
        });
    }
});

export default router;