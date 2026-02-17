import express from 'express';
import whatsappService from '../../services/notification/whatsappService.js';
import User from '../../models/User.js';

const router = express.Router();

/**
 * POST /api/notifications/whatsapp
 * Send WhatsApp notification to parent
 */
router.post('/whatsapp', async (req, res) => {
    try {
        const { studentName, parentWhatsapp, message, type } = req.body;

        if (!studentName || !parentWhatsapp || !message) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: studentName, parentWhatsapp, message'
            });
        }

        console.log(`📱 Sending WhatsApp to ${parentWhatsapp} for student ${studentName}`);

        // Send WhatsApp message
        let result;
        
        if (type === 'check_in') {
            result = await whatsappService.sendCheckInNotification(
                studentName, 
                parentWhatsapp, 
                new Date()
            );
        } else if (type === 'anomaly') {
            const { anomalyDetails } = req.body;
            result = await whatsappService.sendAnomalyNotification(
                studentName,
                parentWhatsapp,
                anomalyDetails || {
                    type: 'Manual Alert',
                    severity: 'medium',
                    timestamp: new Date(),
                    details: message
                }
            );
        } else {
            // Generic message sending
            result = await whatsappService.sendCustomMessage(
                studentName,
                parentWhatsapp,
                message
            );
        }

        if (result.success) {
            console.log(`✅ WhatsApp sent successfully: ${result.messageId}`);
            res.json({
                success: true,
                messageId: result.messageId,
                student: studentName,
                recipient: parentWhatsapp,
                message: 'WhatsApp notification sent successfully'
            });
        } else {
            console.error(`❌ WhatsApp failed: ${result.reason}`);
            res.status(400).json({
                success: false,
                error: result.reason,
                student: studentName,
                recipient: parentWhatsapp
            });
        }

    } catch (error) {
        console.error('❌ WhatsApp notification error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error: ' + error.message
        });
    }
});

/**
 * POST /api/notifications/bulk-whatsapp
 * Send WhatsApp notifications to multiple parents
 */
router.post('/bulk-whatsapp', async (req, res) => {
    try {
        const { recipients, message, type } = req.body;

        if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Recipients array is required and must not be empty'
            });
        }

        if (!message) {
            return res.status(400).json({
                success: false,
                error: 'Message is required'
            });
        }

        console.log(`📱 Sending bulk WhatsApp to ${recipients.length} recipients`);

        const results = [];

        for (const recipient of recipients) {
            try {
                const result = await whatsappService.sendCustomMessage(
                    recipient.studentName,
                    recipient.parentWhatsapp,
                    message.replace(/{studentName}/g, recipient.studentName)
                );

                results.push({
                    student: recipient.studentName,
                    phone: recipient.parentWhatsapp,
                    success: result.success,
                    messageId: result.messageId,
                    error: result.reason
                });

            } catch (error) {
                results.push({
                    student: recipient.studentName,
                    phone: recipient.parentWhatsapp,
                    success: false,
                    error: error.message
                });
            }
        }

        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        console.log(`✅ Bulk WhatsApp completed: ${successful} successful, ${failed} failed`);

        res.json({
            success: true,
            total: recipients.length,
            successful,
            failed,
            results,
            message: `Bulk WhatsApp completed: ${successful} sent, ${failed} failed`
        });

    } catch (error) {
        console.error('❌ Bulk WhatsApp error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error: ' + error.message
        });
    }
});

/**
 * GET /api/notifications/test-whatsapp/:studentId
 * Send test WhatsApp notification to specific student
 */
router.get('/test-whatsapp/:studentId', async (req, res) => {
    try {
        const { studentId } = req.params;

        // Find student
        const student = await User.findById(studentId);
        if (!student) {
            return res.status(404).json({
                success: false,
                error: 'Student not found'
            });
        }

        if (!student.parentWhatsapp) {
            return res.status(400).json({
                success: false,
                error: 'Student does not have parent WhatsApp number'
            });
        }

        // Send test message
        const result = await whatsappService.sendCheckInNotification(
            student.username,
            student.parentWhatsapp,
            new Date()
        );

        if (result.success) {
            res.json({
                success: true,
                messageId: result.messageId,
                student: student.username,
                recipient: student.parentWhatsapp,
                message: 'Test WhatsApp notification sent successfully'
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.reason,
                student: student.username,
                recipient: student.parentWhatsapp
            });
        }

    } catch (error) {
        console.error('❌ Test WhatsApp error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error: ' + error.message
        });
    }
});

export default router;