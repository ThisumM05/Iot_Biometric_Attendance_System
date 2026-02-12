import anomalyFeatureEngineering from '../services/anomaly/anomalyFeatureEngineering.js';
import anomalyDetectionService from '../services/anomaly/anomalyDetectionService.js';
import AttendanceAnomaly from '../models/AttendanceAnomaly.js';
import User from '../models/User.js';
import whatsappService from '../services/notification/whatsappService.js';

/**
 * Anomaly Detection Controller
 * Handles API endpoints for attendance anomaly detection using Isolation Forest
 */
class AnomalyController {
    /**
     * GET /api/attendance/anomalies
     * Get detected anomalies with filtering options
     */
    getAnomalies = async (req, res) => {
        try {
            const {
                startDate,
                endDate,
                userId,
                severity,
                status = 'new',
                limit = 100
            } = req.query;

            // Build filter
            const filter = {};
            if (startDate || endDate) {
                filter.attendanceDate = {};
                if (startDate) filter.attendanceDate.$gte = new Date(startDate);
                if (endDate) filter.attendanceDate.$lte = new Date(endDate);
            }
            if (userId) filter.user = userId;
            if (severity) filter.severity = severity;
            if (status) filter.status = status;

            // Fetch anomalies from database
            const anomalies = await AttendanceAnomaly.find(filter)
                .populate('user', 'username email')
                .sort({ detectedAt: -1, anomalyScore: -1 })
                .limit(parseInt(limit))
                .lean();

            // Get summary statistics
            const stats = await this._getAnomalyStats(filter);

            res.json({
                success: true,
                data: {
                    anomalies: anomalies
                        .filter(a => a.user) // Filter out anomalies with null user references
                        .map(a => ({
                            _id: a._id,
                            user_id: a.user._id,
                            user_name: a.user.username,
                            date: a.attendanceDate,
                            device_id: a.deviceId,
                            anomaly_score: a.anomalyScore,
                            threshold: a.threshold,
                            anomaly_types: a.anomalyTypes,
                            reason: a.reason,
                            severity: a.severity,
                            status: a.status,
                            detected_at: a.detectedAt
                        })),
                    stats,
                    filters: { startDate, endDate, userId, severity, status }
                }
            });

        } catch (error) {
            console.error('Error fetching anomalies:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch anomalies',
                error: error.message
            });
        }
    }

    /**
     * POST /api/attendance/anomaly-detect
     * Run anomaly detection on attendance data
     */
    detectAnomalies = async (req, res) => {
        try {
            const {
                startDate,
                endDate,
                userId,
                saveResults = true
            } = req.body;

            console.log('🔍 Running anomaly detection...');

            // Step 1: Extract features
            console.log('📊 Extracting features...');
            const features = await anomalyFeatureEngineering.extractFeatures({
                startDate,
                endDate,
                userId
            });

            if (features.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No attendance data found for the specified period'
                });
            }

            // Step 2: Normalize features
            console.log('🔢 Normalizing features...');
            const normalizedFeatures = anomalyFeatureEngineering.normalizeFeatures(features);

            // Step 3: Train model if not already trained
            if (!anomalyDetectionService.getModelInfo().trained) {
                console.log('🌲 Training model...');
                await anomalyDetectionService.trainModel(normalizedFeatures, {
                    numTrees: 100,
                    subsampleSize: 256,
                    maxDepth: 10
                });
            }

            // Step 4: Detect anomalies
            console.log('🎯 Detecting anomalies...');
            const anomalies = anomalyDetectionService.detectAnomalies(normalizedFeatures);

            // Step 5: Save results to database if requested
            if (saveResults && anomalies.length > 0) {
                console.log(`💾 Saving ${anomalies.length} anomalies to database...`);
                await this._saveAnomalies(anomalies);
            }

            console.log(`✅ Detection complete: ${anomalies.length} anomalies found`);

            res.json({
                success: true,
                data: {
                    anomalies,
                    summary: {
                        total_records: features.length,
                        anomalies_found: anomalies.length,
                        anomaly_rate: (anomalies.length / features.length * 100).toFixed(2) + '%',
                        severity_breakdown: this._getSeverityBreakdown(anomalies),
                        type_breakdown: this._getTypeBreakdown(anomalies)
                    },
                    model_info: anomalyDetectionService.getModelInfo(),
                    saved: saveResults
                }
            });

        } catch (error) {
            console.error('❌ Error detecting anomalies:', error);
            res.status(500).json({
                success: false,
                message: 'Anomaly detection failed',
                error: error.message
            });
        }
    }

    /**
     * POST /api/attendance/anomaly-train
     * Train/retrain the anomaly detection model
     */
    trainModel = async (req, res) => {
        try {
            const {
                startDate,
                endDate,
                numTrees = 100,
                subsampleSize = 256,
                maxDepth = 10
            } = req.body;

            console.log('🌲 Training anomaly detection model...');

            // Extract and normalize features
            const features = await anomalyFeatureEngineering.extractFeatures({
                startDate,
                endDate
            });

            if (features.length < 50) {
                return res.status(400).json({
                    success: false,
                    message: 'Insufficient training data. Need at least 50 records.'
                });
            }

            const normalizedFeatures = anomalyFeatureEngineering.normalizeFeatures(features);

            // Train model
            const result = await anomalyDetectionService.trainModel(normalizedFeatures, {
                numTrees,
                subsampleSize,
                maxDepth
            });

            res.json({
                success: true,
                message: 'Model trained successfully',
                data: result.modelInfo
            });

        } catch (error) {
            console.error('❌ Error training model:', error);
            res.status(500).json({
                success: false,
                message: 'Model training failed',
                error: error.message
            });
        }
    }

    /**
     * GET /api/attendance/anomaly-stats
     * Get anomaly detection statistics
     */
    getStats = async (req, res) => {
        try {
            const { startDate, endDate, userId } = req.query;

            const filter = {};
            if (startDate || endDate) {
                filter.attendanceDate = {};
                if (startDate) filter.attendanceDate.$gte = new Date(startDate);
                if (endDate) filter.attendanceDate.$lte = new Date(endDate);
            }
            if (userId) filter.user = userId;

            const stats = await this._getDetailedStats(filter);

            res.json({
                success: true,
                data: stats
            });

        } catch (error) {
            console.error('Error fetching anomaly stats:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch statistics',
                error: error.message
            });
        }
    }

    /**
     * PATCH /api/attendance/anomalies/:id/review
     * Mark anomaly as reviewed
     */
    reviewAnomaly = async (req, res) => {
        try {
            const { id } = req.params;
            const { status, notes } = req.body;

            const anomaly = await AttendanceAnomaly.findByIdAndUpdate(
                id,
                {
                    status,
                    reviewNotes: notes,
                    reviewedAt: new Date()
                },
                { new: true }
            ).populate('user', 'username email');

            if (!anomaly) {
                return res.status(404).json({
                    success: false,
                    message: 'Anomaly not found'
                });
            }

            res.json({
                success: true,
                message: 'Anomaly reviewed successfully',
                data: anomaly
            });

        } catch (error) {
            console.error('Error reviewing anomaly:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to review anomaly',
                error: error.message
            });
        }
    }

    // ==================== Private Helper Methods ====================

    /**
     * Save detected anomalies to database
     * @private
     */
    async _saveAnomalies(anomalies) {
        try {
            // Clear existing anomalies for the same attendance records to avoid duplicates
            const attendanceIds = anomalies.map(a => a._id);
            await AttendanceAnomaly.deleteMany({ attendanceId: { $in: attendanceIds } });

            // Prepare documents for bulk insert
            const anomalyDocs = anomalies.map(anomaly => ({
                attendanceId: anomaly._id,
                user: anomaly.user_id,
                attendanceDate: anomaly.date,
                anomalyScore: anomaly.anomaly_score,
                threshold: anomaly.threshold,
                anomalyTypes: anomaly.anomaly_types,
                reason: anomaly.reason,
                details: anomaly.details,
                severity: anomaly.severity,
                deviceId: anomaly.device_id,
                features: anomaly.features,
                status: 'new'
            }));

            // Bulk insert
            await AttendanceAnomaly.insertMany(anomalyDocs);

            console.log(`✅ Saved ${anomalyDocs.length} anomalies to database`);

            // Send WhatsApp notifications for high/critical severity anomalies
            const criticalAnomalies = anomalies.filter(a =>
                a.severity === 'high' || a.severity === 'critical'
            );

            if (criticalAnomalies.length > 0) {
                console.log(`📱 Sending WhatsApp notifications for ${criticalAnomalies.length} critical anomalies`);

                // Send notifications in parallel (but don't wait for them to complete)
                criticalAnomalies.forEach(async (anomaly) => {
                    try {
                        const user = await User.findById(anomaly.user_id);
                        if (user && user.parentWhatsapp) {
                            await whatsappService.sendAnomalyNotification(
                                user.username,
                                user.parentWhatsapp,
                                {
                                    type: anomaly.anomaly_types.join(', '),
                                    severity: anomaly.severity,
                                    timestamp: anomaly.date,
                                    details: anomaly.reason
                                }
                            );
                        }
                    } catch (err) {
                        console.error(`Failed to send WhatsApp notification for user ${anomaly.user_id}:`, err.message);
                    }
                });
            }

        } catch (error) {
            console.error('Error saving anomalies:', error);
            throw error;
        }
    }

    /**
     * Get anomaly statistics
     * @private
     */
    async _getAnomalyStats(filter) {
        const [total, bySeverity, byType, byStatus] = await Promise.all([
            AttendanceAnomaly.countDocuments(filter),
            AttendanceAnomaly.aggregate([
                { $match: filter },
                { $group: { _id: '$severity', count: { $sum: 1 } } }
            ]),
            AttendanceAnomaly.aggregate([
                { $match: filter },
                { $unwind: '$anomalyTypes' },
                { $group: { _id: '$anomalyTypes', count: { $sum: 1 } } }
            ]),
            AttendanceAnomaly.aggregate([
                { $match: filter },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ])
        ]);

        return {
            total,
            by_severity: bySeverity.reduce((acc, item) => {
                acc[item._id] = item.count;
                return acc;
            }, {}),
            by_type: byType.reduce((acc, item) => {
                acc[item._id] = item.count;
                return acc;
            }, {}),
            by_status: byStatus.reduce((acc, item) => {
                acc[item._id] = item.count;
                return acc;
            }, {})
        };
    }

    /**
     * Get detailed statistics
     * @private
     */
    async _getDetailedStats(filter) {
        const stats = await this._getAnomalyStats(filter);

        // Get top users with anomalies
        const topUsers = await AttendanceAnomaly.aggregate([
            { $match: filter },
            { $group: { _id: '$user', count: { $sum: 1 }, avgScore: { $avg: '$anomalyScore' } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
            { $unwind: '$user' },
            { $project: { userId: '$_id', userName: '$user.username', count: 1, avgScore: 1 } }
        ]);

        return {
            ...stats,
            top_users: topUsers,
            model_info: anomalyDetectionService.getModelInfo()
        };
    }

    /**
     * Get severity breakdown
     * @private
     */
    _getSeverityBreakdown(anomalies) {
        const breakdown = { high: 0, medium: 0, low: 0 };
        anomalies.forEach(a => {
            breakdown[a.severity] = (breakdown[a.severity] || 0) + 1;
        });
        return breakdown;
    }

    /**
     * Get type breakdown
     * @private
     */
    _getTypeBreakdown(anomalies) {
        const breakdown = {};
        anomalies.forEach(a => {
            a.anomaly_types.forEach(type => {
                breakdown[type] = (breakdown[type] || 0) + 1;
            });
        });
        return breakdown;
    }
}

export default new AnomalyController();
