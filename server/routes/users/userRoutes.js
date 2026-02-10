import express from 'express';
import User from '../../models/User.js';
import registrationService from '../../services/pipelines/registrationService.js';

const router = express.Router();

/**
 * @route POST /api/users
 * @desc Create a new user (without fingerprint)
 */
router.post('/', async (req, res) => {
    try {
        const { username, email, role } = req.body;

        // Validation check
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }

        const newUser = new User({ username, email, role });
        await newUser.save();

        res.status(201).json({ success: true, data: newUser });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route GET /api/users
 * @desc Get all users
 */
router.get('/', async (req, res) => {
    try {
        const users = await User.find().select('-__v');
        res.json({ success: true, data: users });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route POST /api/users/enroll
 * @desc Trigger enrollment for a user
 * @body { userId, deviceId }
 */
router.post('/enroll', async (req, res) => {
    try {
        const { userId, deviceId } = req.body;

        if (!userId || !deviceId) {
            return res.status(400).json({ success: false, message: 'UserId and DeviceId are required' });
        }

        const result = await registrationService.initiateEnrollment(userId, deviceId);

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Enrollment Route Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route PUT /api/users/:id
 * @desc Update user details
 */
router.put('/:id', async (req, res) => {
    try {
        const { username, email, role } = req.body;
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { username, email, role },
            { new: true }
        );

        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        res.json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * @route DELETE /api/users/:id
 * @desc Delete user
 */
router.delete('/:id', async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        // TODO: Also send DELETE command to ESP32 to remove fingerprint if exists

        res.json({ success: true, message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
