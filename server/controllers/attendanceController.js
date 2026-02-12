import featureEngineeringService from '../services/featureEngineering.js';
import clusteringService from '../services/clusteringService.js';

/**
 * Attendance Controller for Clustering Analysis
 * Handles API endpoints for user attendance behavior clustering
 */
class AttendanceController {
    /**
     * Get attendance clusters
     * GET /api/attendance/clusters
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getClusters(req, res) {
        try {
            // Extract query parameters
            const {
                startDate,
                endDate,
                clusters: requestedClusters
            } = req.query;

            // Validate and parse date parameters
            const options = {};
            if (startDate) {
                const parsedStartDate = new Date(startDate);
                if (isNaN(parsedStartDate.getTime())) {
                    return res.status(400).json({
                        error: 'INVALID_DATE_FORMAT',
                        message: 'Invalid start date format. Use YYYY-MM-DD format.',
                        details: { startDate }
                    });
                }
                options.startDate = parsedStartDate;
            }

            if (endDate) {
                const parsedEndDate = new Date(endDate);
                if (isNaN(parsedEndDate.getTime())) {
                    return res.status(400).json({
                        error: 'INVALID_DATE_FORMAT',
                        message: 'Invalid end date format. Use YYYY-MM-DD format.',
                        details: { endDate }
                    });
                }
                options.endDate = parsedEndDate;
            }

            // Validate date range
            if (options.startDate && options.endDate && options.startDate > options.endDate) {
                return res.status(400).json({
                    error: 'INVALID_DATE_RANGE',
                    message: 'Start date cannot be after end date.',
                    details: { startDate: options.startDate, endDate: options.endDate }
                });
            }

            // Validate requested clusters parameter
            if (requestedClusters) {
                const clustersNum = parseInt(requestedClusters, 10);
                if (isNaN(clustersNum) || clustersNum < 2 || clustersNum > 10) {
                    return res.status(400).json({
                        error: 'INVALID_CLUSTERS_COUNT',
                        message: 'Number of clusters must be between 2 and 10.',
                        details: { requestedClusters }
                    });
                }
                options.clusters = clustersNum;
            }

            console.log('🔍 Processing clustering request with options:', options);

            // Step 1: Compute user features
            console.log('📊 Computing user behavioral features...');
            const userFeatures = await featureEngineeringService.computeUserFeatures(options);

            if (userFeatures.length === 0) {
                return res.status(404).json({
                    error: 'NO_DATA_FOUND',
                    message: 'No user attendance data found for the specified criteria.',
                    details: {
                        dateRange: { startDate: options.startDate, endDate: options.endDate },
                        userCount: 0
                    }
                });
            }

            console.log(`📈 Features computed for ${userFeatures.length} users`);

            // Step 2: Normalize features
            console.log('🔄 Normalizing features...');
            const { normalizedFeatures, scalingParams } = featureEngineeringService.normalizeFeatures(userFeatures);

            // Step 3: Perform clustering
            console.log('🎯 Performing K-means clustering...');
            const clusteringResult = await clusteringService.performClustering(normalizedFeatures, options);

            // Step 4: Get feature explanations
            const featureExplanations = featureEngineeringService.getFeatureExplanations();

            console.log(`✅ Clustering completed with ${clusteringResult.optimal_clusters} clusters`);

            // Prepare response
            const response = {
                success: true,
                data: {
                    clusters: clusteringResult.clusters,
                    summary: {
                        total_users: normalizedFeatures.length,
                        optimal_clusters: clusteringResult.optimal_clusters,
                        date_range: {
                            start: options.startDate?.toISOString().split('T')[0] || 'Not specified',
                            end: options.endDate?.toISOString().split('T')[0] || 'Not specified'
                        },
                        clustering_method: 'K-Means with Elbow Method optimization'
                    },
                    analysis: {
                        centroids: clusteringResult.centroids,
                        within_cluster_sum_of_squares: clusteringResult.within_cluster_sum_of_squares,
                        elbow_analysis: clusteringResult.elbow_analysis,
                        cluster_insights: clusteringResult.cluster_insights
                    },
                    metadata: {
                        feature_explanations: featureExplanations,
                        scaling_parameters: scalingParams,
                        timestamp: new Date().toISOString(),
                        algorithm_info: {
                            name: 'K-Means Clustering',
                            optimization: 'Elbow Method',
                            normalization: 'Min-Max Scaling'
                        }
                    }
                }
            };

            res.status(200).json(response);

        } catch (error) {
            console.error('❌ Clustering analysis error:', error);

            // Return appropriate error response
            if (error.message.includes('No data available')) {
                return res.status(404).json({
                    error: 'INSUFFICIENT_DATA',
                    message: 'Insufficient data available for clustering analysis.',
                    details: { originalError: error.message }
                });
            }

            if (error.message.includes('Feature engineering failed')) {
                return res.status(500).json({
                    error: 'FEATURE_ENGINEERING_ERROR',
                    message: 'Failed to compute behavioral features from attendance data.',
                    details: { originalError: error.message }
                });
            }

            if (error.message.includes('Clustering failed')) {
                return res.status(500).json({
                    error: 'CLUSTERING_ERROR',
                    message: 'Failed to perform clustering analysis.',
                    details: { originalError: error.message }
                });
            }

            // Generic server error
            res.status(500).json({
                error: 'INTERNAL_SERVER_ERROR',
                message: 'An unexpected error occurred during clustering analysis.',
                details: {
                    originalError: error.message,
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

    /**
     * Get clustering statistics and information
     * GET /api/attendance/clusters/info
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async getClusteringInfo(req, res) {
        try {
            const featureExplanations = featureEngineeringService.getFeatureExplanations();

            const info = {
                success: true,
                data: {
                    algorithm: {
                        name: 'K-Means Clustering',
                        description: 'Unsupervised machine learning algorithm that groups users based on attendance behavior patterns',
                        optimization: 'Elbow Method for automatic cluster number selection'
                    },
                    features: featureExplanations,
                    behavior_types: {
                        'Early Birds': 'Users who consistently arrive early with low lateness rates',
                        'Punctual': 'Users with on-time arrivals and consistent attendance patterns',
                        'Regular': 'Users with average attendance patterns',
                        'Late Arrivals': 'Users who frequently arrive late but maintain regular attendance',
                        'Inconsistent': 'Users with highly variable attendance patterns',
                        'High Absentees': 'Users with frequent absences'
                    },
                    api_parameters: {
                        startDate: {
                            type: 'string',
                            format: 'YYYY-MM-DD',
                            description: 'Optional start date for attendance analysis',
                            example: '2024-01-01'
                        },
                        endDate: {
                            type: 'string',
                            format: 'YYYY-MM-DD',
                            description: 'Optional end date for attendance analysis',
                            example: '2024-12-31'
                        },
                        clusters: {
                            type: 'integer',
                            range: '2-10',
                            description: 'Optional specific number of clusters (overrides auto-optimization)',
                            example: 4
                        }
                    },
                    usage_examples: [
                        'GET /api/attendance/clusters - Analyze all user attendance patterns',
                        'GET /api/attendance/clusters?clusters=4 - Force 4 clusters',
                        'GET /api/attendance/clusters?startDate=2024-06-01&endDate=2024-12-31 - Analyze specific date range'
                    ]
                }
            };

            res.status(200).json(info);

        } catch (error) {
            console.error('❌ Clustering info error:', error);
            res.status(500).json({
                error: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to retrieve clustering information.',
                details: { originalError: error.message }
            });
        }
    }
}

export default new AttendanceController();