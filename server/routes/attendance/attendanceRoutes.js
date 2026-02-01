import express from 'express';
import Attendance from '../../models/Attendance.js';

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

export default router;
