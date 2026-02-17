import express from 'express';
import User from '../../models/User.js';
import Attendance from '../../models/Attendance.js';

const router = express.Router();

/**
 * @route GET /api/analytics/summary
 * @desc Get behavior metrics per user
 */
router.get('/summary', async (req, res) => {
    try {
        console.log('🔍 Computing user behavior metrics...');

        const { days = 30 } = req.query;
        const daysBack = parseInt(days);

        // Calculate date range
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - (daysBack * 24 * 60 * 60 * 1000));

        // Get all students
        const users = await User.find({ role: 'student', isEnrolled: true });

        // Get attendance data within date range
        const attendanceData = await Attendance.find({
            timestamp: { $gte: startDate, $lte: endDate },
            type: 'CHECK_IN'
        }).populate('user', 'username email');

        // Filter out records with null users (deleted users)
        const validAttendanceData = attendanceData.filter(record => record.user !== null);

        // Compute metrics for each user
        const userMetrics = [];
        const late_threshold = 9; // 9:00 AM

        for (const user of users) {
            // Filter attendance records for this user
            const userAttendance = validAttendanceData.filter(
                record => record.user._id.toString() === user._id.toString()
            );

            // Calculate metrics
            let lateArrivals = 0;
            let onTimeArrivals = 0;
            let totalCheckInTime = 0;

            userAttendance.forEach(record => {
                const hour = record.timestamp.getHours();
                const minute = record.timestamp.getMinutes();
                const timeDecimal = hour + minute / 60;

                totalCheckInTime += timeDecimal;

                if (timeDecimal > late_threshold) {
                    lateArrivals++;
                } else {
                    onTimeArrivals++;
                }
            });

            const totalDays = userAttendance.length;
            const avgCheckInTime = totalDays > 0 ? totalCheckInTime / totalDays : 0;
            const punctualityScore = totalDays > 0 ? Math.round((onTimeArrivals / totalDays) * 100) : 0;

            // Format average check-in time
            const formatTime = (timeDecimal) => {
                const hours = Math.floor(timeDecimal);
                const minutes = Math.round((timeDecimal - hours) * 60);
                return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            };

            userMetrics.push({
                user_id: user._id,
                username: user.username,
                email: user.email,
                total_days: totalDays,
                late_arrivals: lateArrivals,
                on_time_arrivals: onTimeArrivals,
                avg_checkin_time: avgCheckInTime,
                avg_checkin_time_formatted: formatTime(avgCheckInTime),
                punctuality_score: punctualityScore,
                attendance_rate: totalDays // For the analysis period
            });
        }

        console.log(`✅ Computed metrics for ${userMetrics.length} users`);

        res.json({
            success: true,
            data: userMetrics,
            analysis_period: `${daysBack} days`,
            generated_at: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error computing user summary:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to compute user behavior summary',
            error: error.message
        });
    }
});

/**
 * @route GET /api/analytics/trends
 * @desc Get time-series trends of attendance patterns
 */
router.get('/trends', async (req, res) => {
    try {
        console.log('📈 Computing attendance trends...');

        const { days = 30 } = req.query;
        const daysBack = parseInt(days);

        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - (daysBack * 24 * 60 * 60 * 1000));

        // Get all check-in records
        const attendanceData = await Attendance.find({
            timestamp: { $gte: startDate, $lte: endDate },
            type: 'CHECK_IN'
        }).populate('user', 'username');

        // Group by date
        const dailyData = {};

        attendanceData.forEach(record => {
            const dateKey = record.timestamp.toISOString().split('T')[0]; // YYYY-MM-DD

            if (!dailyData[dateKey]) {
                dailyData[dateKey] = {
                    date: dateKey,
                    total_checkins: 0,
                    total_checkin_time: 0,
                    late_count: 0,
                    on_time_count: 0
                };
            }

            const hour = record.timestamp.getHours();
            const minute = record.timestamp.getMinutes();
            const timeDecimal = hour + minute / 60;

            dailyData[dateKey].total_checkins++;
            dailyData[dateKey].total_checkin_time += timeDecimal;

            if (timeDecimal > 9) {
                dailyData[dateKey].late_count++;
            } else {
                dailyData[dateKey].on_time_count++;
            }
        });

        // Convert to array and calculate averages
        const trendsData = Object.values(dailyData).map(day => ({
            date: day.date,
            total_attendance: day.total_checkins,
            avg_checkin_time: day.total_checkins > 0 ? day.total_checkin_time / day.total_checkins : 0,
            late_arrivals: day.late_count,
            on_time_arrivals: day.on_time_count,
            punctuality_rate: day.total_checkins > 0 ? Math.round((day.on_time_count / day.total_checkins) * 100) : 0
        })).sort((a, b) => a.date.localeCompare(b.date));

        console.log(`✅ Computed trends for ${trendsData.length} days`);

        res.json({
            success: true,
            data: trendsData,
            analysis_period: `${daysBack} days`
        });

    } catch (error) {
        console.error('Error computing trends:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to compute attendance trends',
            error: error.message
        });
    }
});

/**
 * @route GET /api/analytics/peak-hours
 * @desc Get peak check-in hours distribution
 */
router.get('/peak-hours', async (req, res) => {
    try {
        console.log('⏰ Computing peak hours...');

        const { days = 30 } = req.query;
        const daysBack = parseInt(days);

        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - (daysBack * 24 * 60 * 60 * 1000));

        const attendanceData = await Attendance.find({
            timestamp: { $gte: startDate, $lte: endDate },
            type: 'CHECK_IN'
        });

        // Count check-ins by hour
        const hourlyData = {};
        for (let hour = 0; hour < 24; hour++) {
            hourlyData[hour] = 0;
        }

        attendanceData.forEach(record => {
            const hour = record.timestamp.getHours();
            hourlyData[hour]++;
        });

        // Convert to array format for charts
        const peakHoursData = Object.entries(hourlyData).map(([hour, count]) => ({
            hour: `${hour.padStart(2, '0')}:00`,
            hour_24: parseInt(hour),
            count: count
        })).filter(data => data.count > 0); // Only include hours with activity

        console.log(`✅ Computed peak hours distribution`);

        res.json({
            success: true,
            data: peakHoursData,
            analysis_period: `${daysBack} days`
        });

    } catch (error) {
        console.error('Error computing peak hours:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to compute peak hours',
            error: error.message
        });
    }
});

/**
 * @route GET /api/analytics/department-summary
 * @desc Get aggregated department-level metrics
 */
router.get('/department-summary', async (req, res) => {
    try {
        console.log('🏢 Computing department summary...');

        const { days = 30 } = req.query;
        const daysBack = parseInt(days);

        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - (daysBack * 24 * 60 * 60 * 1000));

        // Get all employees
        const totalEmployees = await User.countDocuments({ role: 'employee', isEnrolled: true });

        // Get attendance data
        const attendanceData = await Attendance.find({
            timestamp: { $gte: startDate, $lte: endDate },
            type: 'CHECK_IN'
        }).populate('user', 'username');

        // Calculate aggregated metrics
        let totalLateArrivals = 0;
        let totalOnTimeArrivals = 0;
        let totalCheckInTime = 0;

        attendanceData.forEach(record => {
            const hour = record.timestamp.getHours();
            const minute = record.timestamp.getMinutes();
            const timeDecimal = hour + minute / 60;

            totalCheckInTime += timeDecimal;

            if (timeDecimal > 9) {
                totalLateArrivals++;
            } else {
                totalOnTimeArrivals++;
            }
        });

        const totalAttendance = totalLateArrivals + totalOnTimeArrivals;
        const overallPunctualityRate = totalAttendance > 0
            ? Math.round((totalOnTimeArrivals / totalAttendance) * 100)
            : 0;

        const departmentSummary = {
            total_employees: totalEmployees,
            total_attendance_records: totalAttendance,
            total_late_arrivals: totalLateArrivals,
            total_on_time_arrivals: totalOnTimeArrivals,
            overall_punctuality_rate: overallPunctualityRate,
            avg_daily_attendance: Math.round(totalAttendance / daysBack),
            analysis_period: `${daysBack} days`
        };

        console.log('✅ Computed department summary');

        res.json({
            success: true,
            data: departmentSummary
        });

    } catch (error) {
        console.error('Error computing department summary:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to compute department summary',
            error: error.message
        });
    }
});

/**
 * @route GET /api/analytics/heatmap
 * @desc Get attendance heat map data (day of week  hour of day)
 */
router.get('/heatmap', async (req, res) => {
    try {
        console.log(' Computing attendance heat map...');

        const { days = 30 } = req.query;
        const daysBack = parseInt(days);

        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - (daysBack * 24 * 60 * 60 * 1000));

        const attendanceData = await Attendance.find({
            timestamp: { $gte: startDate, $lte: endDate },
            type: 'CHECK_IN'
        });

        // Initialize heat map data structure
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const heatmapData = [];

        // Create a 2D array for day of week (0-6)  hour (0-23)
        for (let day = 0; day < 7; day++) {
            for (let hour = 0; hour < 24; hour++) {
                heatmapData.push({
                    day: dayNames[day],
                    dayIndex: day,
                    hour: hour,
                    hourFormatted: `${hour.toString().padStart(2, '0')}:00`,
                    count: 0
                });
            }
        }

        // Count attendance records by day of week and hour
        attendanceData.forEach(record => {
            const day = record.timestamp.getDay(); // 0-6 (Sunday-Saturday)
            const hour = record.timestamp.getHours(); // 0-23

            const index = day * 24 + hour;
            if (heatmapData[index]) {
                heatmapData[index].count++;
            }
        });

        // Find max count for normalization
        const maxCount = Math.max(...heatmapData.map(d => d.count), 1);

        // Add intensity percentage for color mapping
        heatmapData.forEach(item => {
            item.intensity = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
        });

        console.log(` Computed heat map with ${attendanceData.length} check-ins`);

        res.json({
            success: true,
            data: heatmapData,
            stats: {
                total_records: attendanceData.length,
                max_count: maxCount,
                analysis_period: `${daysBack} days`
            }
        });

    } catch (error) {
        console.error('Error computing heat map:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to compute heat map',
            error: error.message
        });
    }
});

export default router;
