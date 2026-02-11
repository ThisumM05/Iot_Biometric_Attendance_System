import express from 'express';
import attendanceForecastService from '../../ml/attendanceForecastService.js';
import lateArrivalPredictionService from '../../ml/lateArrivalPredictionService.js';

const router = express.Router();

/**
 * @route GET /api/ml/forecast
 * @desc Get time series forecast for attendance
 * @query {number} days - Number of days to forecast (default: 30)
 */
router.get('/forecast', async (req, res) => {
    try {
        console.log('📈 ML Forecast API called');

        const days = Math.min(parseInt(req.query.days) || 30, 30); // Limit to max 30 days

        console.log(`🔮 Generating ${days} days of future forecast only...`);

        // Load and train model if needed
        console.log('🔄 Loading training data...');
        await attendanceForecastService.loadTrainingData();
        await attendanceForecastService.trainForecastModel();

        // Generate forecast (future days only)
        const forecast = await attendanceForecastService.generateForecast(days);
        const historical = attendanceForecastService.getHistoricalData();
        const metrics = attendanceForecastService.getModelMetrics();

        // Filter historical data to only include past 30 days (excluding today)
        const today = new Date().toISOString().split('T')[0];
        const filteredHistorical = historical
            .filter(item => item.date < today) // Only past dates
            .slice(-30); // Last 30 days only

        console.log(`✅ Generated forecast: ${forecast.length} future days, ${filteredHistorical.length} historical days`);

        res.json({
            success: true,
            data: {
                historical: filteredHistorical, // Past 30 days only (excludes today/future)
                forecast: forecast, // Future 30 days only (starts tomorrow)
                model_metrics: metrics,
                generated_at: new Date().toISOString(),
                forecast_horizon_days: days,
                forecast_period: `Next ${days} days (future only)`,
                historical_period: 'Past 30 days (historical data only)'
            }
        });

    } catch (error) {
        console.error('❌ Error in forecast API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate forecast',
            error: error.message
        });
    }
});

/**
 * @route POST /api/ml/predict-late
 * @desc Predict late arrival probability for a specific user and date
 * @body {string} user_id - User ID
 * @body {string} date - Target date (YYYY-MM-DD)
 */
router.post('/predict-late', async (req, res) => {
    try {
        const { user_id, date } = req.body;

        console.log(`🎯 ML Late Prediction API called for user ${user_id} on ${date}`);

        if (!user_id || !date) {
            return res.status(400).json({
                success: false,
                message: 'User ID and date are required'
            });
        }

        // Validate date format
        const targetDate = new Date(date);
        if (isNaN(targetDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date format. Use YYYY-MM-DD'
            });
        }

        // Check if date is in the past (predictions only for today/future)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        targetDate.setHours(0, 0, 0, 0);

        if (targetDate < today) {
            return res.status(400).json({
                success: false,
                message: 'Past date predictions not allowed. Please select today or a future date.',
                error_type: 'PAST_DATE_ERROR'
            });
        }

        // Verify user exists
        const { default: User } = await import('../../models/User.js');
        const user = await User.findById(user_id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: `User with ID ${user_id} not found`,
                error_type: 'USER_NOT_FOUND'
            });
        }

        // Generate prediction
        const prediction = await lateArrivalPredictionService.predictLateArrival(user_id, date);
        const modelMetrics = lateArrivalPredictionService.getModelMetrics();

        console.log(`✅ Generated prediction: ${(prediction.probability_late * 100).toFixed(1)}% probability`);

        res.json({
            success: true,
            data: {
                ...prediction,
                model_metrics: modelMetrics,
                generated_at: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Error in late prediction API:', error);

        // Handle specific error types
        if (error.message.includes('No attendance history')) {
            return res.status(400).json({
                success: false,
                message: error.message,
                error_type: 'NO_ATTENDANCE_DATA'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to generate prediction',
            error: error.message
        });
    }
});

/**
 * @route GET /api/ml/model-metrics
 * @desc Get performance metrics for ML models
 */
router.get('/model-metrics', async (req, res) => {
    try {
        console.log('📊 ML Model Metrics API called');

        const forecastMetrics = attendanceForecastService.getModelMetrics();
        const predictionMetrics = lateArrivalPredictionService.getModelMetrics();

        res.json({
            success: true,
            data: {
                forecast_model: forecastMetrics,
                prediction_model: predictionMetrics,
                status: {
                    forecast_trained: attendanceForecastService.isModelTrained,
                    prediction_trained: lateArrivalPredictionService.isModelTrained
                },
                updated_at: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Error in model metrics API:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get model metrics',
            error: error.message
        });
    }
});

/**
 * @route POST /api/ml/retrain
 * @desc Manually trigger retraining of ML models
 */
router.post('/retrain', async (req, res) => {
    try {
        console.log('🔄 ML Model Retraining triggered');

        // Retrain both models
        const forecastResult = Promise.all([
            attendanceForecastService.loadTrainingData(),
            attendanceForecastService.trainForecastModel()
        ]);

        const predictionResult = lateArrivalPredictionService.trainModel();

        await Promise.all([forecastResult, predictionResult]);

        console.log('✅ ML models retrained successfully');

        res.json({
            success: true,
            message: 'Models retrained successfully',
            retrained_at: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error retraining models:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrain models',
            error: error.message
        });
    }
});

export default router;