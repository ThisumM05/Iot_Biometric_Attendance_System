import express from 'express';
import Attendance from '../../models/Attendance.js';
import attendanceController from '../../controllers/attendanceController.js';
import anomalyController from '../../controllers/anomalyController.js';

const router = express.Router();

/**
 * @route GET /api/attendance
 * @desc Get recent attendance logs (populated with user info)
 */
router.get('/', async (req, res) => {
    try {
        const DailyAttendance = (await import('../../models/DailyAttendance.js')).default;

        const logs = await DailyAttendance.find()
            .sort({ date: -1, clockIn: -1 })
            .limit(100)
            .populate('user', 'username email fingerprintId');

        res.json({ success: true, data: logs });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * Attendance Clustering Routes
 * Handles all endpoints related to user attendance behavior clustering
 */

// GET /api/attendance/clusters
// Main clustering endpoint
router.get('/clusters', attendanceController.getClusters);

// GET /api/attendance/clusters/info  
// Get clustering algorithm information and API documentation
router.get('/clusters/info', attendanceController.getClusteringInfo);

/**
 * Anomaly Detection Routes
 * Handles all endpoints related to attendance anomaly detection using Isolation Forest
 */

// GET /api/attendance/anomalies
// Get detected anomalies with filtering
router.get('/anomalies', anomalyController.getAnomalies);

// POST /api/attendance/anomaly-detect
// Run anomaly detection on attendance data
router.post('/anomaly-detect', anomalyController.detectAnomalies);

// POST /api/attendance/anomaly-train
// Train/retrain the anomaly detection model
router.post('/anomaly-train', anomalyController.trainModel);

// GET /api/attendance/anomaly-stats
// Get anomaly detection statistics
router.get('/anomaly-stats', anomalyController.getStats);

// PATCH /api/attendance/anomalies/:id/review
// Mark anomaly as reviewed
router.patch('/anomalies/:id/review', anomalyController.reviewAnomaly);

/**
 * @route GET /api/attendance/user/:userId/stats
 * @desc Get attendance statistics for a specific user
 */
router.get('/user/:userId/stats', async (req, res) => {
    try {
        const { userId } = req.params;

        // Get all check-in records for this user
        const checkIns = await Attendance.find({
            user: userId,
            type: 'CHECK_IN'
        }).sort({ timestamp: 1 });

        if (checkIns.length === 0) {
            return res.json({
                success: true,
                data: {
                    total_days: 0,
                    present_days: 0,
                    absent_days: 0,
                    late_arrivals: 0,
                    on_time_arrivals: 0,
                    attendance_rate: 0
                }
            });
        }

        // Calculate late arrivals (assuming 9 AM is the threshold)
        const lateThreshold = 9; // 9 AM
        const lateArrivals = checkIns.filter(record => {
            const hour = new Date(record.timestamp).getHours();
            return hour >= lateThreshold;
        }).length;

        const onTimeArrivals = checkIns.length - lateArrivals;

        // Get unique dates
        const uniqueDates = new Set(
            checkIns.map(record =>
                new Date(record.timestamp).toISOString().split('T')[0]
            )
        );

        // Calculate date range for absence calculation
        const firstDate = new Date(checkIns[0].timestamp);
        const lastDate = new Date(checkIns[checkIns.length - 1].timestamp);
        const daysDiff = Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)) + 1;
        const presentDays = uniqueDates.size;
        const absentDays = Math.max(0, daysDiff - presentDays);

        res.json({
            success: true,
            data: {
                total_days: daysDiff,
                present_days: presentDays,
                absent_days: absentDays,
                late_arrivals: lateArrivals,
                on_time_arrivals: onTimeArrivals,
                attendance_rate: daysDiff > 0 ? ((presentDays / daysDiff) * 100).toFixed(1) : 0,
                first_record: firstDate.toISOString(),
                last_record: lastDate.toISOString(),
                total_check_ins: checkIns.length
            }
        });

    } catch (error) {
        console.error('Error fetching user stats:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
