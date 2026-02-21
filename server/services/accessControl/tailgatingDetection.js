/**
 * Tailgating Detection Service
 *
 * PRIMARY signal: IR beam sensor (sole alarm trigger)
 * SUPPLEMENTARY signal: Camera face count (informational only — never triggers alarm)
 *
 * Flow:
 * 1. Fingerprint scan opens a 10-second session.
 * 2. IR beam crossing within the session increments actualPassed.
 *    - actualPassed > authorized → TAILGATING alarm.
 *    - Beam crossing with NO session → UNAUTHORIZED_ENTRY alarm.
 * 3. Camera face count is recorded for logging/dashboard display ONLY.
 *    - Camera seeing 2 faces does NOT trigger any alarm.
 */

import EventEmitter from 'events';

class TailgatingDetectionService extends EventEmitter {
    constructor() {
        super();
        this.sessions = new Map(); // deviceId -> session data
        this.SESSION_DURATION = 10000; // 10 seconds
        this.FACE_PERSISTENCE_THRESHOLD = 3000; // 3 seconds - warn if extra faces persist
        this.io = null; // Socket.IO instance for dashboard alerts
    }

    setSocketIo(io) {
        this.io = io;
    }

    /**
     * Start a detection session when fingerprint is scanned
     */
    startSession(deviceId, userId, scanTimestamp) {
        const sessionId = `${deviceId}_${scanTimestamp}`;

        const session = {
            sessionId,
            deviceId,
            startTime: scanTimestamp,
            endTime: scanTimestamp + this.SESSION_DURATION,
            events: {
                fingerprints: [{ userId, timestamp: scanTimestamp }],
                faceDetections: [], // { count, timestamp, frameId }
                beamCrossings: [], // { direction: 'IN'|'OUT', timestamp }
            },
            status: 'active', // active | completed | alarmed
            authorized: 1, // Number of authorized entries (fingerprint scans)
            actualPassed: 0, // Number who actually passed through (beam crossings)
        };

        this.sessions.set(sessionId, session);

        // Auto-close session after duration
        setTimeout(() => {
            this.evaluateAndCloseSession(sessionId);
        }, this.SESSION_DURATION);

        console.log(`🟢 Session started: ${sessionId} | User: ${userId}`);
        this.emit('sessionStarted', session);

        return sessionId;
    }

    /**
     * Find or create active session for a device
     */
    getActiveSession(deviceId) {
        const now = Date.now();

        // Find active session for this device
        for (const [sessionId, session] of this.sessions.entries()) {
            if (session.deviceId === deviceId &&
                session.status === 'active' &&
                now < session.endTime) {
                return session;
            }
        }

        return null;
    }

    /**
     * Record additional fingerprint scan within existing session
     */
    addFingerprintScan(deviceId, userId, timestamp) {
        const session = this.getActiveSession(deviceId);

        if (session) {
            session.events.fingerprints.push({ userId, timestamp });
            session.authorized++;
            console.log(`👆 Additional scan in session ${session.sessionId}: ${userId} (Total: ${session.authorized})`);
            this.emit('additionalScan', session);
            return session.sessionId;
        }

        // No active session - start new one
        return this.startSession(deviceId, userId, timestamp);
    }

    /**
     * Record face detection from camera (SUPPLEMENTARY — informational only)
     * Camera data is logged and forwarded to the dashboard but NEVER triggers an alarm.
     * Only IR beam crossings determine whether tailgating occurred.
     */
    recordFaceDetection(deviceId, faceCount, timestamp, frameId) {
        const session = this.getActiveSession(deviceId);

        if (!session) {
            // No active session — log but do not alarm (IR beam is the authority for unauthorized entry)
            if (faceCount > 0) {
                console.log(`📷 [Camera] Face(s) detected outside session: Device ${deviceId}, Count: ${faceCount} (informational only)`);
            }
            return null;
        }

        // Record face detection for logging/dashboard display
        session.events.faceDetections.push({
            count: faceCount,
            timestamp,
            frameId
        });

        // Emit informational event to dashboard (NOT an alarm)
        if (faceCount > session.authorized && this.io) {
            this.io.emit('camera:extra-faces', {
                sessionId: session.sessionId,
                deviceId,
                faceCount,
                authorized: session.authorized,
                timestamp,
                note: 'Camera sees extra faces — waiting for IR beam confirmation'
            });
        }

        return session.sessionId;
    }

    /**
     * Record IR beam crossing
     * direction: 'ENTRY' or 'EXIT' — indicates which side's sensor was triggered
     * Any beam break within an active session counts as a person passing through
     */
    recordBeamCrossing(deviceId, clusterId, direction, timestamp) {
        const session = this.getActiveSession(deviceId);

        if (!session) {
            // Beam crossing without scan = UNAUTHORIZED ENTRY
            console.log(`🚨 UNAUTHORIZED: Beam crossing without scan - Device ${deviceId}`);
            const alert = {
                deviceId,
                clusterId,
                direction,
                timestamp,
                reason: 'No active fingerprint session',
                type: 'UNAUTHORIZED_ENTRY'
            };
            this.emit('unauthorizedEntry', alert);

            // Emit to dashboard
            if (this.io) {
                this.io.emit('security:alarm', {
                    type: 'UNAUTHORIZED_ENTRY',
                    severity: 'critical',
                    deviceId,
                    clusterId,
                    direction,
                    timestamp: Date.now(),
                    reason: 'Beam crossing without active fingerprint session'
                });
            }
            return null;
        }

        // Record beam crossing — both ENTRY and EXIT side sensors count
        session.events.beamCrossings.push({ direction, timestamp });
        session.actualPassed++;

        console.log(`🚶 Beam crossing: ${direction} | Session: ${session.sessionId} (Passed: ${session.actualPassed}, Authorized: ${session.authorized})`);

        // CRITICAL CHECK: More people passed than authorized = TAILGATING
        if (session.actualPassed > session.authorized) {
            this.triggerTailgatingAlarm(session, clusterId, timestamp);
        }

        return session.sessionId;
    }

    /**
     * Trigger tailgating alarm
     */
    triggerTailgatingAlarm(session, clusterId, timestamp) {
        session.status = 'alarmed';

        const alarm = {
            sessionId: session.sessionId,
            deviceId: session.deviceId,
            clusterId,
            timestamp,
            authorized: session.authorized,
            actualPassed: session.actualPassed,
            tailgaters: session.actualPassed - session.authorized,
            reason: `${session.actualPassed} people passed, only ${session.authorized} authorized`,
            type: 'TAILGATING',
            events: session.events
        };

        console.log(`🚨🚨🚨 TAILGATING ALARM: ${alarm.reason}`);

        this.emit('tailgatingDetected', alarm);

        // Emit to dashboard via Socket.IO
        if (this.io) {
            this.io.emit('security:alarm', {
                type: 'TAILGATING',
                severity: 'critical',
                sessionId: session.sessionId,
                deviceId: session.deviceId,
                clusterId,
                authorized: session.authorized,
                actualPassed: session.actualPassed,
                tailgaters: session.actualPassed - session.authorized,
                reason: alarm.reason,
                timestamp: Date.now()
            });
        }

        return alarm;
    }

    /**
     * Calculate how long extra faces have been present
     */
    getExtraFacesDuration(session) {
        const extraFaceDetections = session.events.faceDetections.filter(
            d => d.count > session.authorized
        );

        if (extraFaceDetections.length === 0) return 0;

        const firstExtraFace = extraFaceDetections[0].timestamp;
        const lastExtraFace = extraFaceDetections[extraFaceDetections.length - 1].timestamp;

        return lastExtraFace - firstExtraFace;
    }

    /**
     * Evaluate session and close it
     */
    evaluateAndCloseSession(sessionId) {
        const session = this.sessions.get(sessionId);

        if (!session || session.status !== 'active') return;

        // Final evaluation
        const summary = {
            sessionId,
            deviceId: session.deviceId,
            duration: Date.now() - session.startTime,
            authorized: session.authorized,
            actualPassed: session.actualPassed,
            facesDetected: session.events.faceDetections.length > 0
                ? Math.max(...session.events.faceDetections.map(d => d.count))
                : 0,
            status: session.status
        };

        // Check if tailgating occurred but wasn't caught (edge case)
        if (summary.actualPassed > summary.authorized && session.status === 'active') {
            console.log(`🚨 LATE DETECTION: Tailgating found during session close`);
            this.triggerTailgatingAlarm(session, Date.now());
        } else {
            session.status = 'completed';
        }

        console.log(`🔵 Session closed: ${sessionId}`, summary);
        this.emit('sessionClosed', summary);

        // Clean up old session after 1 minute (keep for logging)
        setTimeout(() => {
            this.sessions.delete(sessionId);
        }, 60000);
    }

    /**
     * Get session details (for debugging/monitoring)
     */
    getSessionDetails(sessionId) {
        return this.sessions.get(sessionId);
    }

    /**
     * Get all active sessions
     */
    getActiveSessions() {
        const now = Date.now();
        return Array.from(this.sessions.values()).filter(
            s => s.status === 'active' && now < s.endTime
        );
    }

    /**
     * Manual session abort (for testing or admin control)
     */
    abortSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.status = 'aborted';
            console.log(`❌ Session aborted: ${sessionId}`);
            this.emit('sessionAborted', session);
        }
    }
}

export default new TailgatingDetectionService();
