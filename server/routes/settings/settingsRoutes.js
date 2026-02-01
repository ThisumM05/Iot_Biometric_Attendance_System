import express from 'express';
import SystemSettings from '../../models/SystemSettings.js';

const router = express.Router();

/**
 * @route GET /api/settings
 * @desc Get all system settings
 */
router.get('/', async (req, res) => {
    try {
        const settings = await SystemSettings.find({});
        // Convert array to object for easier frontend consumption
        const settingsMap = {};
        settings.forEach(s => {
            settingsMap[s.key] = s.value;
        });

        // Return defaults if not set
        if (!settingsMap['SHIFT_START_TIME']) settingsMap['SHIFT_START_TIME'] = '08:00';
        if (!settingsMap['CLASS_END_TIME']) settingsMap['CLASS_END_TIME'] = '10:30'; // Default Class End
        if (!settingsMap['LATE_THRESHOLD']) settingsMap['LATE_THRESHOLD'] = 15;

        res.json({ success: true, data: settingsMap });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route PUT /api/settings
 * @desc Update system settings
 */
router.put('/', async (req, res) => {
    try {
        const { shiftStart, classEnd, lateThreshold } = req.body;

        if (shiftStart) {
            await SystemSettings.findOneAndUpdate(
                { key: 'SHIFT_START_TIME' },
                { value: shiftStart, description: 'Class Start Time (HH:MM)' },
                { upsert: true, new: true }
            );
        }

        if (classEnd) {
            await SystemSettings.findOneAndUpdate(
                { key: 'CLASS_END_TIME' },
                { value: classEnd, description: 'Class End Time (HH:MM)' },
                { upsert: true, new: true }
            );
        }

        if (lateThreshold !== undefined) {
            await SystemSettings.findOneAndUpdate(
                { key: 'LATE_THRESHOLD' },
                { value: lateThreshold, description: 'Late Threshold in Minutes' },
                { upsert: true, new: true }
            );
        }

        res.json({ success: true, message: 'Settings updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
