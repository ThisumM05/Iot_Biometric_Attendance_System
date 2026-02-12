import anomalyFeatureEngineering from './anomalyFeatureEngineering.js';
import { mean, std } from 'mathjs';

/**
 * Calculate quantile (percentile) from sorted array
 * @param {Array} sortedData - Sorted array of numbers
 * @param {Number} q - Quantile value (0-1)
 */
function quantile(sortedData, q) {
    const sorted = [...sortedData].sort((a, b) => a - b);
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;

    if (sorted[base + 1] !== undefined) {
        return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    } else {
        return sorted[base];
    }
}

/**
 * Isolation Forest Anomaly Detection Service
 * 
 * Implements an Isolation Forest algorithm for detecting anomalies
 * in attendance behavior. Uses ensemble of isolation trees to identify
 * data points that are easy to isolate (anomalies).
 * 
 * The algorithm is based on the principle that anomalies are:
 * - Few in number
 * - Different from normal instances
 * - Easier to isolate (require fewer splits in a tree)
 */
class AnomalyDetectionService {
    constructor() {
        this.model = null;
        this.trainingData = null;
        this.threshold = null;
        this.featureStats = null;
    }

    /**
     * Train the Isolation Forest model on historical attendance data
     * @param {Array} featureData - Array of normalized feature objects
     * @param {Object} options - Training options
     */
    async trainModel(featureData, options = {}) {
        try {
            const {
                numTrees = 100,
                subsampleSize = 256,
                maxDepth = 10
            } = options;

            console.log(`🌲 Training Isolation Forest with ${numTrees} trees...`);

            //Convert features to arrays for training
            const trainingVectors = featureData.map(data =>
                anomalyFeatureEngineering.featuresToArray(data.normalizedFeatures)
            );

            if (trainingVectors.length === 0) {
                throw new Error('No training data available');
            }

            // Build ensemble of isolation trees
            const trees = [];
            for (let i = 0; i < numTrees; i++) {
                // Random subsample
                const sampleSize = Math.min(subsampleSize, trainingVectors.length);
                const sample = this._randomSample(trainingVectors, sampleSize);

                // Build isolation tree
                const tree = this._buildIsolationTree(sample, 0, maxDepth);
                trees.push(tree);
            }

            // Store model
            this.model = {
                trees,
                numTrees,
                subsampleSize,
                maxDepth,
                avgPathLength: this._averagePathLength(subsampleSize)
            };

            this.trainingData = featureData;

            // Compute anomaly scores for training data
            const trainingScores = trainingVectors.map(vector =>
                this._computeAnomalyScore(vector)
            );

            // Calculate dynamic threshold (95th percentile)
            this.threshold = quantile(trainingScores, 0.95);

            console.log(`✅ Model trained successfully`);
            console.log(`   Training samples: ${trainingVectors.length}`);
            console.log(`   Anomaly threshold: ${this.threshold.toFixed(4)}`);

            return {
                success: true,
                modelInfo: {
                    numTrees,
                    subsampleSize,
                    maxDepth,
                    trainingSize: trainingVectors.length,
                    threshold: this.threshold
                }
            };

        } catch (error) {
            console.error('❌ Error training anomaly detection model:', error);
            throw error;
        }
    }

    /**
     * Detect anomalies in attendance records
     * @param {Array} featureData - Array of normalized feature objects
     * @returns {Array} Detected anomalies with scores and explanations
     */
    detectAnomalies(featureData) {
        if (!this.model) {
            throw new Error('Model not trained. Call trainModel() first.');
        }

        const anomalies = [];

        for (const data of featureData) {
            const vector = anomalyFeatureEngineering.featuresToArray(data.normalizedFeatures);
            const anomalyScore = this._computeAnomalyScore(vector);

            // Classify as anomaly if score > threshold
            if (anomalyScore > this.threshold) {
                const explanation = this._generateExplanation(data, anomalyScore);

                anomalies.push({
                    _id: data._id,
                    user_id: data.user_id,
                    user_name: data.user_name,
                    date: data.date,
                    device_id: data.device_id,
                    anomaly_score: anomalyScore,
                    threshold: this.threshold,
                    anomaly_types: explanation.types,
                    reason: explanation.reason,
                    details: explanation.details,
                    features: data.originalFeatures,
                    severity: this._classifySeverity(anomalyScore)
                });
            }
        }

        return anomalies;
    }

    /**
     * Build a single isolation tree
     * @private
     */
    _buildIsolationTree(data, currentDepth, maxDepth) {
        // Base case: max depth reached or insufficient data
        if (currentDepth >= maxDepth || data.length <= 1) {
            return {
                type: 'leaf',
                size: data.length,
                depth: currentDepth
            };
        }

        // Randomly select a feature and split value
        const numFeatures = data[0].length;
        const featureIndex = Math.floor(Math.random() * numFeatures);
        const featureValues = data.map(d => d[featureIndex]);
        const minVal = Math.min(...featureValues);
        const maxVal = Math.max(...featureValues);

        if (minVal === maxVal) {
            return {
                type: 'leaf',
                size: data.length,
                depth: currentDepth
            };
        }

        // Random split point
        const splitValue = minVal + Math.random() * (maxVal - minVal);

        // Split data
        const leftData = data.filter(d => d[featureIndex] < splitValue);
        const rightData = data.filter(d => d[featureIndex] >= splitValue);

        return {
            type: 'internal',
            featureIndex,
            splitValue,
            left: this._buildIsolationTree(leftData, currentDepth + 1, maxDepth),
            right: this._buildIsolationTree(rightData, currentDepth + 1, maxDepth)
        };
    }

    /**
     * Compute path length for a vector in a tree
     * @private
     */
    _pathLength(vector, tree, currentDepth = 0) {
        if (tree.type === 'leaf') {
            // Estimate path length adjustment for leaf nodes
            return currentDepth + this._averagePathLength(tree.size);
        }

        const value = vector[tree.featureIndex];
        if (value < tree.splitValue) {
            return this._pathLength(vector, tree.left, currentDepth + 1);
        } else {
            return this._pathLength(vector, tree.right, currentDepth + 1);
        }
    }

    /**
     * Compute average path length (for normalization)
     * @private
     */
    _averagePathLength(n) {
        if (n <= 1) return 0;
        const H = Math.log(n - 1) + 0.5772156649; // Euler's constant
        return 2 * H - (2 * (n - 1) / n);
    }

    /**
     * Compute anomaly score for a feature vector
     * @private
     */
    _computeAnomalyScore(vector) {
        if (!this.model) return 0;

        // Average path length across all trees
        const avgPathLength = mean(
            this.model.trees.map(tree => this._pathLength(vector, tree))
        );

        // Normalize: anomaly score = 2^(-avgPathLength / c(n))
        const c = this.model.avgPathLength;
        const score = Math.pow(2, -avgPathLength / c);

        return score;
    }

    /**
     * Random sample from array
     * @private
     */
    _randomSample(array, size) {
        const shuffled = [...array].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, size);
    }

    /**
     * Generate human-readable explanation for anomaly
     * @private
     */
    _generateExplanation(data, anomalyScore) {
        const features = data.originalFeatures;
        const metadata = data.metadata;
        const types = [];
        const details = [];

        // Check for time anomalies
        if (features.time_difference_from_user_average > 60) {
            types.push('time_anomaly');
            const hoursOff = (features.time_difference_from_user_average / 60).toFixed(1);
            details.push(`Arrival time differs by ${hoursOff} hours from typical pattern`);
        }

        // Check for device anomalies
        if (features.device_consistency_score === 0) {
            types.push('device_anomaly');
            details.push(`Unusual device used (${data.device_id} instead of ${metadata.mostUsedDevice})`);
        }

        // Check for frequency anomalies
        if (features.days_since_last_attendance > 7) {
            types.push('frequency_anomaly');
            details.push(`${features.days_since_last_attendance} days gap since last attendance`);
        }

        // Check for unusual hour
        if (features.hour_of_day < 6 || features.hour_of_day > 22) {
            types.push('time_anomaly');
            details.push(`Check-in at unusual hour: ${features.hour_of_day}:00`);
        }

        // Check for weekend attendance if unexpected
        if (features.is_weekend === 1 && features.attendance_frequency < 0.3) {
            types.push('pattern_anomaly');
            details.push('Attendance on weekend (unusual for this user)');
        }

        // Default if no specific type
        if (types.length === 0) {
            types.push('general_anomaly');
            details.push('Overall attendance pattern significantly differs from norm');
        }

        const reason = details.join('; ');

        return { types, reason, details };
    }

    /**
     * Classify anomaly severity based on score
     * @private
     */
    _classifySeverity(score) {
        if (score > 0.8) return 'high';
        if (score > 0.65) return 'medium';
        return 'low';
    }

    /**
     * Get model information
     */    getModelInfo() {
        if (!this.model) {
            return { trained: false };
        }

        return {
            trained: true,
            numTrees: this.model.numTrees,
            subsampleSize: this.model.subsampleSize,
            maxDepth: this.model.maxDepth,
            threshold: this.threshold,
            trainingSize: this.trainingData?.length || 0
        };
    }
}

export default new AnomalyDetectionService();
