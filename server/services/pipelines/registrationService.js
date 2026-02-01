import User from '../../models/User.js';
import rabbitMQService from '../rabbitmq/rabbitMQService.js';

class RegistrationService {

    /**
     * Start the enrollment process for a specific user.
     * 1. Finds the user.
     * 2. Generates/Assigns a fingerprint ID.
     * 3. Sends ENROLL command to ESP32 via RabbitMQ.
     */
    async initiateEnrollment(userId, deviceId) {
        try {
            const user = await User.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Simple logic: Find max ID + 1, or use a specific slot management system
            // For now, let's assume we just increment. (Race conditions possible in high load)
            const usersWithId = await User.find({ fingerprintId: { $ne: null } }).sort({ fingerprintId: -1 }).limit(1);
            let nextId = 1;
            if (usersWithId.length > 0) {
                nextId = usersWithId[0].fingerprintId + 1;
            }

            // Assign this ID to the user (marked as pending enrollment ideally, but simplifying)
            user.fingerprintId = nextId;
            await user.save();

            // Send Command to Device
            const command = {
                action: 'ENROLL',
                id: nextId, // Fingerprint ID
                userId: userId, // Mongo User ID (for reference)
                deviceId: deviceId
            };

            await rabbitMQService.publishCommand(command);

            return { success: true, message: `Enrollment started for ID ${nextId}`, fingerprintId: nextId };

        } catch (error) {
            console.error('Enrollment Error:', error);
            throw error;
        }
    } // This closing brace now correctly closes the initiateEnrollment method.

    async handleEnrollmentSuccess(payload) {
        try {
            const { fingerprintId } = payload;
            if (!fingerprintId) return;

            // Confirm enrollment in DB
            await User.updateOne(
                { fingerprintId: fingerprintId },
                { isEnrolled: true }
            );
            console.log(`[Enrollment] Confirmed for Fingerprint ID: ${fingerprintId}`);
        } catch (error) {
            console.error('Error handling enrollment success:', error);
        }
    }
}

export default new RegistrationService();
