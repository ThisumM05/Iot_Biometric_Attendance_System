import { kmeans } from 'ml-kmeans';
import * as math from 'mathjs';

/**
 * Clustering Service for Attendance Pattern Analysis
 * Uses K-Means clustering with automatic cluster optimization
 */
class ClusteringService {
    constructor() {
        this.maxClusters = 6;
        this.minClusters = 2;
    }

    /**
     * Perform K-means clustering on user attendance features
     * @param {Array} normalizedFeatures - Normalized feature data
     * @param {Object} options - Clustering options
     * @returns {Object} Clustering results with optimal clusters
     */
    async performClustering(normalizedFeatures, options = {}) {
        try {
            if (normalizedFeatures.length === 0) {
                throw new Error('No data available for clustering');
            }

            // Convert features to matrix format for clustering
            const featureMatrix = this.prepareFeatureMatrix(normalizedFeatures);

            // Determine optimal number of clusters using Elbow Method
            const optimalClusters = options.clusters || await this.findOptimalClusters(featureMatrix);

            // Perform K-means clustering with optimal clusters
            const clusteringResult = this.performKMeansWithK(featureMatrix, optimalClusters);

            // Organize results by clusters
            const clusters = this.organizeClusterResults(
                normalizedFeatures,
                clusteringResult,
                optimalClusters
            );

            return {
                clusters,
                optimal_clusters: optimalClusters,
                centroids: clusteringResult.centroids.map(centroid =>
                    this.convertCentroidToFeatures(centroid)
                ),
                within_cluster_sum_of_squares: clusteringResult.wcss,
                elbow_analysis: await this.getElbowAnalysis(featureMatrix),
                cluster_insights: this.generateClusterInsights(clusters)
            };
        } catch (error) {
            throw new Error(`Clustering failed: ${error.message}`);
        }
    }

    /**
     * Prepare feature matrix for clustering algorithms
     * @param {Array} normalizedFeatures - Normalized user features
     * @returns {Array} 2D array suitable for clustering
     */
    prepareFeatureMatrix(normalizedFeatures) {
        return normalizedFeatures.map(user => [
            user.normalized_features.average_arrival_time,
            user.normalized_features.late_percentage,
            user.normalized_features.absence_percentage,
            user.normalized_features.attendance_consistency
        ]);
    }

    /**
     * Find optimal number of clusters using Elbow Method
     * @param {Array} featureMatrix - 2D feature matrix
     * @returns {number} Optimal number of clusters
     */
    async findOptimalClusters(featureMatrix) {
        try {
            const elbowData = await this.getElbowAnalysis(featureMatrix);

            // Find elbow point using rate of change
            let maxImprovement = 0;
            let optimalK = this.minClusters;

            for (let i = 1; i < elbowData.length - 1; i++) {
                const improvement = elbowData[i - 1].wcss - elbowData[i].wcss;
                const nextImprovement = elbowData[i].wcss - elbowData[i + 1].wcss;
                const improvementRatio = improvement / (nextImprovement || 1);

                if (improvementRatio > maxImprovement) {
                    maxImprovement = improvementRatio;
                    optimalK = elbowData[i].k;
                }
            }

            // Ensure we have a reasonable number of clusters
            const dataSize = featureMatrix.length;
            return Math.min(optimalK, Math.floor(dataSize / 2), this.maxClusters);
        } catch (error) {
            console.warn('Elbow method failed, using default clusters:', error.message);
            return Math.min(3, Math.floor(featureMatrix.length / 2));
        }
    }

    /**
     * Get elbow analysis data for different K values
     * @param {Array} featureMatrix - 2D feature matrix
     * @returns {Array} Elbow analysis results
     */
    async getElbowAnalysis(featureMatrix) {
        const elbowData = [];
        const maxK = Math.min(this.maxClusters, Math.floor(featureMatrix.length / 2));

        for (let k = this.minClusters; k <= maxK; k++) {
            try {
                const result = this.performKMeansWithK(featureMatrix, k);
                elbowData.push({
                    k,
                    wcss: result.wcss
                });
            } catch (error) {
                console.warn(`Clustering with k=${k} failed:`, error.message);
            }
        }

        return elbowData;
    }

    /**
     * Perform K-means clustering with specified K
     * @param {Array} featureMatrix - 2D feature matrix
     * @param {number} k - Number of clusters
     * @returns {Object} Clustering result
     */
    performKMeansWithK(featureMatrix, k) {
        try {
            if (k > featureMatrix.length) {
                throw new Error(`Cannot create ${k} clusters with only ${featureMatrix.length} data points`);
            }

            const result = kmeans(featureMatrix, k, {
                maxIterations: 100,
                tolerance: 1e-4,
                initialization: 'random'
            });

            return {
                clusters: result.clusters,
                centroids: result.centroids,
                wcss: this.calculateWCSS(featureMatrix, result.clusters, result.centroids)
            };
        } catch (error) {
            throw new Error(`K-means clustering with k=${k} failed: ${error.message}`);
        }
    }

    /**
     * Calculate Within-Cluster Sum of Squares
     * @param {Array} data - Feature matrix
     * @param {Array} clusters - Cluster assignments
     * @param {Array} centroids - Cluster centroids
     * @returns {number} WCSS value
     */
    calculateWCSS(data, clusters, centroids) {
        let wcss = 0;

        for (let i = 0; i < data.length; i++) {
            const point = data[i];
            const clusterId = clusters[i];
            const centroid = centroids[clusterId];

            const distance = this.euclideanDistance(point, centroid);
            wcss += distance * distance;
        }

        return wcss;
    }

    /**
     * Calculate Euclidean distance between two points
     * @param {Array} point1 - First point
     * @param {Array} point2 - Second point
     * @returns {number} Euclidean distance
     */
    euclideanDistance(point1, point2) {
        let sum = 0;
        for (let i = 0; i < point1.length; i++) {
            sum += Math.pow(point1[i] - point2[i], 2);
        }
        return Math.sqrt(sum);
    }

    /**
     * Organize clustering results by clusters
     * @param {Array} normalizedFeatures - Original normalized features
     * @param {Object} clusteringResult - Raw clustering result
     * @param {number} numClusters - Number of clusters
     * @returns {Array} Organized cluster data
     */
    organizeClusterResults(normalizedFeatures, clusteringResult, numClusters) {
        const clusters = [];

        // Initialize clusters
        for (let i = 0; i < numClusters; i++) {
            clusters.push({
                cluster_id: i,
                members: [],
                size: 0,
                behavior_type: '',
                characteristics: {}
            });
        }

        // Assign users to clusters
        normalizedFeatures.forEach((user, index) => {
            const clusterId = clusteringResult.clusters[index];
            if (clusterId < clusters.length) {
                clusters[clusterId].members.push({
                    user_id: user.user_id,
                    user_name: user.user_name,
                    features: user.original_features,
                    normalized_features: user.normalized_features,
                    attendance_count: user.attendance_count
                });
                clusters[clusterId].size++;
            }
        });

        // Calculate cluster characteristics and assign behavior types
        clusters.forEach((cluster, index) => {
            cluster.characteristics = this.calculateClusterCharacteristics(cluster.members);
            cluster.behavior_type = this.determineBehaviorType(cluster.characteristics);
        });

        return clusters;
    }

    /**
     * Calculate average characteristics for a cluster
     * @param {Array} members - Cluster members
     * @returns {Object} Average characteristics
     */
    calculateClusterCharacteristics(members) {
        if (members.length === 0) {
            return {};
        }

        const characteristics = {
            avg_arrival_time: 0,
            avg_late_percentage: 0,
            avg_absence_percentage: 0,
            avg_consistency: 0,
            total_members: members.length
        };

        members.forEach(member => {
            characteristics.avg_arrival_time += member.features.average_arrival_time;
            characteristics.avg_late_percentage += member.features.late_percentage;
            characteristics.avg_absence_percentage += member.features.absence_percentage;
            characteristics.avg_consistency += member.features.attendance_consistency;
        });

        characteristics.avg_arrival_time = Math.round((characteristics.avg_arrival_time / members.length) * 100) / 100;
        characteristics.avg_late_percentage = Math.round((characteristics.avg_late_percentage / members.length) * 100) / 100;
        characteristics.avg_absence_percentage = Math.round((characteristics.avg_absence_percentage / members.length) * 100) / 100;
        characteristics.avg_consistency = Math.round((characteristics.avg_consistency / members.length) * 100) / 100;

        return characteristics;
    }

    /**
     * Determine behavior type based on cluster characteristics
     * Creates unique names by combining multiple behavioral dimensions
     * @param {Object} characteristics - Cluster characteristics
     * @returns {string} Behavior type description
     */
    determineBehaviorType(characteristics) {
        const { avg_late_percentage, avg_absence_percentage, avg_consistency, avg_arrival_time } = characteristics;

        // Convert arrival time to hours for classification
        const avgArrivalHour = avg_arrival_time / 60;

        // Classify arrival time pattern
        let arrivalPattern = '';
        if (avgArrivalHour < 8.5) {
            arrivalPattern = 'Early Birds';
        } else if (avgArrivalHour < 9.25) {
            arrivalPattern = 'On-Time Arrivals';
        } else if (avgArrivalHour < 10) {
            arrivalPattern = 'Late Arrivals';
        } else if (avgArrivalHour < 12) {
            arrivalPattern = 'Very Late Arrivals';
        } else {
            arrivalPattern = 'Extremely Late Arrivals';
        }

        // Classify consistency
        let consistencyPattern = '';
        if (avg_consistency < 20) {
            consistencyPattern = 'Highly Consistent';
        } else if (avg_consistency < 35) {
            consistencyPattern = 'Consistent';
        } else if (avg_consistency < 50) {
            consistencyPattern = 'Moderately Variable';
        } else {
            consistencyPattern = 'Highly Variable';
        }

        // Classify attendance rate
        let attendancePattern = '';
        if (avg_absence_percentage < 5) {
            attendancePattern = 'Perfect Attendance';
        } else if (avg_absence_percentage < 15) {
            attendancePattern = 'Excellent Attendance';
        } else if (avg_absence_percentage < 30) {
            attendancePattern = 'Good Attendance';
        } else if (avg_absence_percentage < 50) {
            attendancePattern = 'Poor Attendance';
        } else if (avg_absence_percentage < 70) {
            attendancePattern = 'Very Poor Attendance';
        } else {
            attendancePattern = 'Critically Low Attendance';
        }

        // Classify lateness
        let latePattern = '';
        if (avg_late_percentage < 10) {
            latePattern = 'Rarely Late';
        } else if (avg_late_percentage < 25) {
            latePattern = 'Occasionally Late';
        } else if (avg_late_percentage < 50) {
            latePattern = 'Frequently Late';
        } else if (avg_late_percentage < 75) {
            latePattern = 'Mostly Late';
        } else {
            latePattern = 'Almost Always Late';
        }

        // Combine patterns to create unique descriptive name
        // Priority: Attendance issues > Consistency > Arrival time
        if (avg_absence_percentage > 50) {
            // Critical attendance issues
            return `${attendancePattern} - ${consistencyPattern}`;
        } else if (avg_absence_percentage > 25) {
            // Moderate to poor attendance
            return `${attendancePattern} - ${arrivalPattern}`;
        } else if (avg_late_percentage > 60) {
            // Chronic lateness
            return `${latePattern} - ${arrivalPattern}`;
        } else if (avg_consistency > 45) {
            // High variability
            return `${consistencyPattern} - ${arrivalPattern}`;
        } else if (avgArrivalHour < 8.5 && avg_late_percentage < 15) {
            // Exceptional performers
            return `${arrivalPattern} - ${attendancePattern}`;
        } else if (avg_late_percentage < 10 && avg_absence_percentage < 10) {
            // Punctual and present
            return `${consistencyPattern} & Punctual`;
        } else {
            // Standard combinations
            return `${arrivalPattern} - ${latePattern}`;
        }
    }

    /**
     * Convert centroid array back to feature object
     * @param {Array} centroid - Centroid coordinates
     * @returns {Object} Feature object
     */
    convertCentroidToFeatures(centroid) {
        return {
            average_arrival_time: Math.round(centroid[0] * 10000) / 10000,
            late_percentage: Math.round(centroid[1] * 10000) / 10000,
            absence_percentage: Math.round(centroid[2] * 10000) / 10000,
            attendance_consistency: Math.round(centroid[3] * 10000) / 10000
        };
    }

    /**
     * Generate insights about the clustering results
     * @param {Array} clusters - Cluster results
     * @returns {Object} Clustering insights
     */
    generateClusterInsights(clusters) {
        const totalUsers = clusters.reduce((sum, cluster) => sum + cluster.size, 0);
        const insights = {
            total_users: totalUsers,
            cluster_distribution: {},
            dominant_behavior: '',
            recommendations: []
        };

        // Calculate cluster distribution
        clusters.forEach(cluster => {
            const percentage = Math.round((cluster.size / totalUsers) * 100);
            insights.cluster_distribution[cluster.behavior_type] = {
                count: cluster.size,
                percentage
            };
        });

        // Find dominant behavior
        const largestCluster = clusters.reduce((max, cluster) =>
            cluster.size > max.size ? cluster : max, clusters[0]
        );
        insights.dominant_behavior = largestCluster.behavior_type;

        // Generate recommendations
        clusters.forEach(cluster => {
            if (cluster.behavior_type === 'Late Arrivals' && cluster.size > 0) {
                insights.recommendations.push(
                    `Focus on ${cluster.size} users with late arrival patterns - consider flexible start times`
                );
            }
            if (cluster.behavior_type === 'High Absentees' && cluster.size > 0) {
                insights.recommendations.push(
                    `Monitor ${cluster.size} users with high absence rates - may need attendance intervention`
                );
            }
            if (cluster.behavior_type === 'Inconsistent' && cluster.size > 0) {
                insights.recommendations.push(
                    `Support ${cluster.size} users with inconsistent patterns - consider attendance coaching`
                );
            }
        });

        return insights;
    }
}

export default new ClusteringService();