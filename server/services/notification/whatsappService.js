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
     * Re-initialize the service (useful when environment variables change)
     */
    reinitialize() {
        this.initialize();
    }

    /**
     * Format phone number(s) for WhatsApp (ensure it has whatsapp: prefix)
     * Handles single strings, comma-separated strings, or arrays
     */
    formatWhatsAppNumbers(numbers) {
        if (!numbers) return [];

        let numberArray = [];
        if (Array.isArray(numbers)) {
            numberArray = numbers;
        } else if (typeof numbers === 'string') {
            numberArray = numbers.split(',').map(n => n.trim());
        } else {
            return [];
        }

        return numberArray
            .map(num => {
                let cleaned = num.replace(/[\s-]/g, '');
                if (!cleaned) return null;
                if (!cleaned.startsWith('+') && !cleaned.startsWith('whatsapp:')) {
                    cleaned = '+' + cleaned;
                }
                if (!cleaned.startsWith('whatsapp:')) {
                    cleaned = 'whatsapp:' + cleaned;
                }
                return cleaned;
            })
            .filter(num => num !== null);
    }

    /**
     * Internal method to send message to multiple recipients
     * @private
     */
    async _sendToMultiple(recipients, body) {
        if (!this.isEnabled) {
            console.log('📱 WhatsApp disabled - Would have sent:', body);
            return { success: false, reason: 'Service disabled' };
        }

        const formattedNumbers = this.formatWhatsAppNumbers(recipients);
        if (formattedNumbers.length === 0) {
            return { success: false, reason: 'No valid phone numbers' };
        }

        const results = await Promise.allSettled(
            formattedNumbers.map(to =>
                this.client.messages.create({
                    body: body,
                    from: this.fromNumber,
                    to: to
                })
            )
        );

        const successes = results.filter(r => r.status === 'fulfilled');
        const failures = results.filter(r => r.status === 'rejected');

        if (successes.length > 0) {
            console.log(`✅ WhatsApp sent to ${successes.length} numbers`);
        }
        if (failures.length > 0) {
            console.error(`❌ WhatsApp failed for ${failures.length} numbers:`, failures[0].reason?.message);
        }

        return {
            success: successes.length > 0,
            sentCount: successes.length,
            failedCount: failures.length,
            messageIds: successes.map(s => s.value.sid)
        };
    }

    /**
     * Send check-in notification to multiple recipients
     */
    async sendCheckInNotification(studentName, recipients, checkInTime) {
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

        return this._sendToMultiple(recipients, message);
    }


    /**
     * Send check-out notification to multiple recipients
     */
    async sendCheckOutNotification(studentName, recipients, checkOutTime) {
        const time = new Date(checkOutTime).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        const message = `🎓 *Attendance Notification*\n\n` +
            `Your child *${studentName}* has checked out from the school.\n\n` +
            `⏰ Time: ${time}\n` +
            `📅 Date: ${new Date(checkOutTime).toLocaleDateString()}\n\n` +
            `_IoT Biometric Attendance System_`;

        return this._sendToMultiple(recipients, message);
    }


    /**
     * Send anomaly notification to multiple recipients
     */
    async sendAnomalyNotification(studentName, recipients, anomalyDetails) {
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

        return this._sendToMultiple(recipients, message);
    }


    /**
     * Send late arrival notification to multiple recipients
     */
    async sendLateArrivalNotification(studentName, recipients, checkInTime, minutesLate) {
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

        return this._sendToMultiple(recipients, message);
    }


    /**
     * Send custom WhatsApp message to multiple recipients
     */
    async sendCustomMessage(studentName, recipients, customMessage) {
        const message = `${customMessage}\n\n_IoT Biometric Attendance System_`;
        return this._sendToMultiple(recipients, message);
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
