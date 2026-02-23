import express from 'express';
import User from '../../models/User.js';
import Attendance from '../../models/Attendance.js';

const router = express.Router();

/**
 * @route GET /api/dashboard/stats
 * @desc Get dashboard statistics for today
 */
router.get('/stats', async (req, res) => {
    try {
        // Get today's date range
        const today = new Date();
        const startOfDay = new Date(today.setHours(0, 0, 0, 0));
        const endOfDay = new Date(today.setHours(23, 59, 59, 999));

        // Total enrolled users (students only)
        const totalUsers = await User.countDocuments({
            isEnrolled: true,
            role: 'student' // Only students, not admins
        });

        // Get today's check-ins
        const todayCheckIns = await Attendance.find({
            type: 'CHECK_IN',
            timestamp: { $gte: startOfDay, $lte: endOfDay }
        }).populate('user', 'username role');

        // Filter out records with null users (deleted users)
        const validCheckIns = todayCheckIns.filter(record => record.user !== null);

        // Users present today (unique users who checked in)
        const uniqueUserIds = [...new Set(validCheckIns.map(record => record.user._id.toString()))];
        const presentToday = uniqueUserIds.length;

        // Late arrivals (check-ins after 9:00 AM)
        const lateArrivalCutoff = new Date(today);
        lateArrivalCutoff.setHours(9, 0, 0, 0);

        const lateArrivals = validCheckIns.filter(record =>
            record.timestamp > lateArrivalCutoff &&
            record.user.role === 'student'
        ).length;

        // Absentees (enrolled employees who haven't checked in today)
        const absentees = totalUsers - presentToday;

        res.json({
            success: true,
            data: {
                totalStudents: totalUsers,
                presentToday: presentToday,
                lateArrivals: lateArrivals,
                absentees: absentees
            }
        });

    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route GET /api/dashboard/recent-activity
 * @desc Get recent attendance activity
 */
router.get('/recent-activity', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const recentActivity = await Attendance.find({})
            .populate('user', 'username email')
            .sort({ timestamp: -1 })
            .limit(limit);


        // Filter out records with null users and format the response
        const formattedActivity = recentActivity
            .filter(record => record.user !== null)
            .map(record => ({
                id: record._id,
                student: record.user.username,
                timestamp: record.timestamp, // Send raw Date object/ISO string
                status: record.type.toLowerCase().replace('_', ' '),
                device: record.deviceId

            }));

        res.json({
            success: true,
            data: formattedActivity
        });

    } catch (error) {
        console.error('Error fetching recent activity:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route GET /api/dashboard/today-summary
 * @desc Get detailed summary for today
 */
router.get('/today-summary', async (req, res) => {
    try {
        const today = new Date();
        const startOfDay = new Date(today.setHours(0, 0, 0, 0));
        const endOfDay = new Date(today.setHours(23, 59, 59, 999));

        // Get all today's attendance records
        const todayRecords = await Attendance.find({
            timestamp: { $gte: startOfDay, $lte: endOfDay }
        }).populate('user', 'username email role');

        // Group by user to get check-ins and check-outs
        const userActivity = {};
        todayRecords.forEach(record => {
            const userId = record.user._id.toString();
            if (!userActivity[userId]) {
                userActivity[userId] = {
                    user: record.user,
                    checkIn: null,
                    checkOut: null,
                    status: 'absent'
                };
            }

            if (record.type === 'CHECK_IN') {
                userActivity[userId].checkIn = record.timestamp;
                userActivity[userId].status = 'present';
            } else if (record.type === 'CHECK_OUT') {
                userActivity[userId].checkOut = record.timestamp;
            }
        });

        // Convert to array and add additional info
        const summary = Object.values(userActivity).map(activity => {
            let workingHours = 0;
            if (activity.checkIn && activity.checkOut) {
                workingHours = (activity.checkOut - activity.checkIn) / (1000 * 60 * 60); // hours
            }

            const isLate = activity.checkIn && activity.checkIn.getHours() >= 9;

            return {
                user: activity.user.username,
                email: activity.user.email,
                checkIn: activity.checkIn ? activity.checkIn.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit'
                }) : 'N/A',
                checkOut: activity.checkOut ? activity.checkOut.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit'
                }) : 'N/A',
                workingHours: workingHours.toFixed(2),
                status: activity.status,
                isLate: isLate
            };
        });

        res.json({
            success: true,
            data: summary
        });

    } catch (error) {
        console.error('Error fetching today summary:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;