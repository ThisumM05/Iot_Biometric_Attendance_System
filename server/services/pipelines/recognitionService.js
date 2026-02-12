import User from '../../models/User.js';
import Attendance from '../../models/Attendance.js';
import whatsappService from '../notification/whatsappService.js';

class RecognitionService {

    /**
     * Process an attendance event from the device.
     * @param {Object} payload - { type: 'ATTENDANCE', id: 5, deviceId: 'DEV01' }
     */
    async processAttendance(event) {
        try {
            console.log('[Recognition] Processing Event:', JSON.stringify(event));

            // Event structure: { type: 'ATTENDANCE', payload: { fingerprintId: 1 }, deviceId: '...' }
            const { payload, deviceId } = event;
            const id = payload?.fingerprintId;

            if (!id) {
                console.warn('RecognitionService: Received payload without ID');
                return;
            }

            // 1. Find User by Fingerprint ID
            const user = await User.findOne({ fingerprintId: id });
            if (!user) {
                console.warn(`RecognitionService: Unknown Fingerprint ID ${id}`);
                return;
            }
            console.log(`[Recognition] Identified User: ${user.username}`);

            // 2. Load System Settings (Defaults if not set)
            const SystemSettings = (await import('../../models/SystemSettings.js')).default;
            const settingsList = await SystemSettings.find({});
            const settings = {
                shiftStart: "08:00",
                classEnd: "10:30",
                lateThreshold: 15, // minutes
            };

            settingsList.forEach(s => {
                if (s.key === 'SHIFT_START_TIME') settings.shiftStart = s.value;
                if (s.key === 'CLASS_END_TIME') settings.classEnd = s.value;
                if (s.key === 'LATE_THRESHOLD') settings.lateThreshold = s.value;
            });

            // 3. Save Raw Log (Audit Trail)
            const Attendance = (await import('../../models/Attendance.js')).default;
            const rawLog = new Attendance({
                user: user._id,
                fingerprintId: id,
                deviceId: deviceId || 'UNKNOWN',
                type: 'CHECK_IN' // We'll refine this but keeping basic for now
            });
            await rawLog.save();

            // 4. Process Daily Session
            const DailyAttendance = (await import('../../models/DailyAttendance.js')).default;
            const todayStr = new Date().toISOString().split('T')[0];

            let session = await DailyAttendance.findOne({
                user: user._id,
                date: todayStr
            });

            const now = new Date();

            if (!session) {
                // --- First Scan (Clock In) ---
                console.log(`[Attendance] New Session (Clock In) for ${user.username}`);

                // Determine Status (Present vs Late)
                const [startHour, startMin] = settings.shiftStart.split(':').map(Number);
                const shiftStartTime = new Date(now);
                shiftStartTime.setHours(startHour, startMin, 0, 0);

                // Add late buffer
                const lateLimit = new Date(shiftStartTime.getTime() + settings.lateThreshold * 60000);

                let status = 'PRESENT';
                if (now > lateLimit) {
                    status = 'LATE';
                }

                session = new DailyAttendance({
                    user: user._id,
                    date: todayStr,
                    clockIn: now,
                    clockOut: now, // Initially same as clock in
                    status: status,
                    events: [rawLog._id]
                });
            } else {
                // --- Subsequent Scan (Update Clock Out) ---
                // Debounce: Ignore identical scans within 60s
                const lastEventId = session.events[session.events.length - 1];
                const lastLog = await Attendance.findById(lastEventId);

                if (lastLog && (now - lastLog.timestamp) < 60000) {
                    console.log(`[Attendance] Debounced rapid scan for ${user.username}`);
                    return;
                }

                console.log(`[Attendance] Updating Session (Clock Out) for ${user.username}`);
                session.clockOut = now;
                session.events.push(rawLog._id);

                // Recalculate Duration (Minutes)
                const diffMs = session.clockOut - session.clockIn;
                session.duration = Math.floor(diffMs / 60000);

                // Check for LEFT_EARLY status
                if (session.status === 'PRESENT' || session.status === 'LEFT_EARLY') {
                    const [endHour, endMin] = settings.classEnd.split(':').map(Number);
                    const classEndTime = new Date(now);
                    classEndTime.setHours(endHour, endMin, 0, 0);

                    if (session.clockOut < classEndTime) {
                        session.status = 'LEFT_EARLY';
                    } else {
                        // If they exit AFTER end time, revert LEFT_EARLY to PRESENT (if it was their only issue)
                        session.status = 'PRESENT';
                    }
                }
            }

            await session.save();
            console.log(`[Attendance] Saved DailyAttendance for ${user.username}. Status: ${session.status}, Duration: ${session.duration}m`);

            // 5. Send WhatsApp notification to parent
            if (user.parentWhatsapp && session.clockIn.getTime() === now.getTime()) {
                // Only send notification on first check-in (not on check-out updates)
                console.log(`[WhatsApp] Sending check-in notification for ${user.username}`);

                whatsappService.sendCheckInNotification(
                    user.username,
                    user.parentWhatsapp,
                    session.clockIn
                ).catch(err => console.error('WhatsApp notification failed:', err));

                // If student is late, send additional late notification
                if (session.status === 'LATE') {
                    const [startHour, startMin] = settings.shiftStart.split(':').map(Number);
                    const shiftStartTime = new Date(now);
                    shiftStartTime.setHours(startHour, startMin, 0, 0);
                    const minutesLate = Math.floor((now - shiftStartTime) / 60000);

                    whatsappService.sendLateArrivalNotification(
                        user.username,
                        user.parentWhatsapp,
                        session.clockIn,
                        minutesLate
                    ).catch(err => console.error('WhatsApp late notification failed:', err));
                }
            }

        } catch (error) {
            console.error('RecognitionService Error:', error);
        }
    }
}

export default new RecognitionService();
