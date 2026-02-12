/**
 * WhatsApp Notification Service
 * Sends notifications to parents via WhatsApp API
 * 
 * This uses Twilio's WhatsApp API - you'll need to:
 * 1. Sign up at https://www.twilio.com
 * 2. Set up WhatsApp sandbox or get approved sender
 * 3. Add credentials to .env file:
 *    - TWILIO_ACCOUNT_SID
 *    - TWILIO_AUTH_TOKEN
 *    - TWILIO_WHATSAPP_FROM (e.g., whatsapp:+14155238886)
 */

import twilio from 'twilio';

class WhatsAppService {
    constructor() {
        this.client = null;
        this.isEnabled = false;
        this.fromNumber = null;

        this.initialize();
    }

    initialize() {
        try {
            const accountSid = process.env.TWILIO_ACCOUNT_SID;
            const authToken = process.env.TWILIO_AUTH_TOKEN;
            this.fromNumber = process.env.TWILIO_WHATSAPP_FROM;

            if (accountSid && authToken && this.fromNumber) {
                this.client = twilio(accountSid, authToken);
                this.isEnabled = true;
                console.log('✅ WhatsApp Service initialized successfully');
            } else {
                console.log('⚠️  WhatsApp Service disabled: Missing Twilio credentials in .env');
                console.log('   To enable, add: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM');
            }
        } catch (error) {
            console.error('❌ WhatsApp Service initialization error:', error.message);
            this.isEnabled = false;
        }
    }

    /**
     * Format phone number for WhatsApp (ensure it has whatsapp: prefix)
     */
    formatWhatsAppNumber(phoneNumber) {
        if (!phoneNumber) return null;

        // Remove spaces and dashes
        let cleaned = phoneNumber.replace(/[\s-]/g, '');

        // Add + if not present
        if (!cleaned.startsWith('+')) {
            cleaned = '+' + cleaned;
        }

        // Add whatsapp: prefix if not present
        if (!cleaned.startsWith('whatsapp:')) {
            cleaned = 'whatsapp:' + cleaned;
        }

        return cleaned;
    }

    /**
     * Send check-in notification to parent
     */
    async sendCheckInNotification(studentName, parentWhatsapp, checkInTime) {
        if (!this.isEnabled) {
            console.log('📱 WhatsApp disabled - Would have sent check-in notification');
            return { success: false, reason: 'WhatsApp service not enabled' };
        }

        try {
            const formattedNumber = this.formatWhatsAppNumber(parentWhatsapp);
            if (!formattedNumber) {
                return { success: false, reason: 'Invalid phone number' };
            }

            const time = new Date(checkInTime).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });

            const message = `🎓 *Attendance Notification*\n\n` +
                `Your child *${studentName}* has checked in at the school.\n\n` +
                `⏰ Time: ${time}\n` +
                `📅 Date: ${new Date(checkInTime).toLocaleDateString()}\n\n` +
                `_IoT Biometric Attendance System_`;

            const result = await this.client.messages.create({
                body: message,
                from: this.fromNumber,
                to: formattedNumber
            });

            console.log(`✅ WhatsApp sent to ${parentWhatsapp}: Check-in notification for ${studentName}`);
            return { success: true, messageId: result.sid };

        } catch (error) {
            console.error('❌ WhatsApp send error:', error.message);
            return { success: false, reason: error.message };
        }
    }

    /**
     * Send anomaly notification to parent
     */
    async sendAnomalyNotification(studentName, parentWhatsapp, anomalyDetails) {
        if (!this.isEnabled) {
            console.log('📱 WhatsApp disabled - Would have sent anomaly notification');
            return { success: false, reason: 'WhatsApp service not enabled' };
        }

        try {
            const formattedNumber = this.formatWhatsAppNumber(parentWhatsapp);
            if (!formattedNumber) {
                return { success: false, reason: 'Invalid phone number' };
            }

            const { type, severity, timestamp, details } = anomalyDetails;

            const time = new Date(timestamp).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });

            let emoji = '⚠️';
            if (severity === 'high' || severity === 'critical') {
                emoji = '🚨';
            } else if (severity === 'medium') {
                emoji = '⚠️';
            } else {
                emoji = 'ℹ️';
            }

            let message = `${emoji} *Attendance Alert*\n\n` +
                `Unusual attendance pattern detected for *${studentName}*\n\n` +
                `⏰ Time: ${time}\n` +
                `📅 Date: ${new Date(timestamp).toLocaleDateString()}\n` +
                `🔍 Type: ${type || 'Anomaly detected'}\n` +
                `📊 Severity: ${severity?.toUpperCase() || 'UNKNOWN'}\n`;

            if (details) {
                message += `\nℹ️ Details: ${details}\n`;
            }

            message += `\n_Please contact the school if you have any concerns._\n` +
                `_IoT Biometric Attendance System_`;

            const result = await this.client.messages.create({
                body: message,
                from: this.fromNumber,
                to: formattedNumber
            });

            console.log(`✅ WhatsApp sent to ${parentWhatsapp}: Anomaly notification for ${studentName}`);
            return { success: true, messageId: result.sid };

        } catch (error) {
            console.error('❌ WhatsApp send error:', error.message);
            return { success: false, reason: error.message };
        }
    }

    /**
     * Send late arrival notification to parent
     */
    async sendLateArrivalNotification(studentName, parentWhatsapp, checkInTime, minutesLate) {
        if (!this.isEnabled) {
            console.log('📱 WhatsApp disabled - Would have sent late arrival notification');
            return { success: false, reason: 'WhatsApp service not enabled' };
        }

        try {
            const formattedNumber = this.formatWhatsAppNumber(parentWhatsapp);
            if (!formattedNumber) {
                return { success: false, reason: 'Invalid phone number' };
            }

            const time = new Date(checkInTime).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });

            const message = `⏰ *Late Arrival Notice*\n\n` +
                `Your child *${studentName}* arrived late to school.\n\n` +
                `🕐 Arrival Time: ${time}\n` +
                `⏱️ Late by: ${minutesLate} minutes\n` +
                `📅 Date: ${new Date(checkInTime).toLocaleDateString()}\n\n` +
                `_Please ensure timely arrival._\n` +
                `_IoT Biometric Attendance System_`;

            const result = await this.client.messages.create({
                body: message,
                from: this.fromNumber,
                to: formattedNumber
            });

            console.log(`✅ WhatsApp sent to ${parentWhatsapp}: Late arrival notification for ${studentName}`);
            return { success: true, messageId: result.sid };

        } catch (error) {
            console.error('❌ WhatsApp send error:', error.message);
            return { success: false, reason: error.message };
        }
    }

    /**
     * Test WhatsApp connection
     */
    async testConnection(testPhoneNumber) {
        if (!this.isEnabled) {
            return {
                success: false,
                message: 'WhatsApp service is not enabled. Check .env configuration.'
            };
        }

        try {
            const formattedNumber = this.formatWhatsAppNumber(testPhoneNumber);
            const result = await this.client.messages.create({
                body: '🧪 Test message from IoT Biometric Attendance System. WhatsApp integration is working!',
                from: this.fromNumber,
                to: formattedNumber
            });

            return {
                success: true,
                messageId: result.sid,
                message: 'Test message sent successfully!'
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }
}

export default new WhatsAppService();
