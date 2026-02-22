import EventEmitter from 'events';

class TailgatingDetectionService extends EventEmitter {
    constructor() {
        super();
        this.clusterSessions = new Map(); // clusterId -> session data
        this.SESSION_DURATION = 15000; // Increased to 15 seconds for multi-node crossing
        this.io = null; // Socket.IO instance for dashboard alerts
    }

    setSocketIo(io) {
        this.io = io;
    }

    /**
     * Find or create active session for a cluster
     */
    getOrCreateSession(clusterId) {
        let session = this.clusterSessions.get(clusterId);

        if (!session || Date.now() > session.endTime) {
            session = {
                clusterId,
                startTime: Date.now(),
                endTime: Date.now() + this.SESSION_DURATION,
                authorizedUsers: [], // Array of { userId, direction, state: 'WAITING' | 'CROSSING' | 'COMPLETED' }
                crossings: [], // History for auditing
                status: 'active'
            };
            this.clusterSessions.set(clusterId, session);

            // Auto-cleanup
            setTimeout(() => {
                this.evaluateAndCloseSession(clusterId);
            }, this.SESSION_DURATION);
        }

        return session;
    }

    /**
     * Record fingerprint scan (authorization)
     */
    addFingerprintScan(deviceId, userId, timestamp, clusterId, direction) {
        const targetClusterId = clusterId || deviceId; // Fallback to deviceId if no cluster
        const session = this.getOrCreateSession(targetClusterId);

        // Add user to authorized list for this cluster
        session.authorizedUsers.push({
            userId,
            direction, // 'ENTRY' or 'EXIT'
            state: 'WAITING',
            scanTime: timestamp
        });

        console.log(`[Tailgating] Authorized ${userId} for ${direction} in cluster ${targetClusterId}`);

        if (this.io) {
            this.io.emit('security:session-update', {
                clusterId: targetClusterId,
                authorizedCount: session.authorizedUsers.length,
                lastUser: userId
            });
        }

        return targetClusterId;
    }

    /**
     * Record IR beam crossing
     */
    recordBeamCrossing(deviceId, clusterId, nodeDirection, timestamp) {
        const targetClusterId = clusterId || deviceId;
        const session = this.clusterSessions.get(targetClusterId);

        if (!session) {
            return this.triggerUnauthorizedAlarm(deviceId, targetClusterId, nodeDirection, timestamp);
        }

        // Logic for Zero-False-Alarm:
        // 1. If someone is waiting for an IN sequence (Scan ENTRY node -> Cross ENTRY beam -> Cross EXIT beam)
        // 2. If someone is waiting for an OUT sequence (Scan EXIT node -> Cross EXIT beam -> Cross ENTRY beam)

        // Find a user whose sequence matches this crossing
        // Normalization: 
        // - IN scan (Entry side): Expect ENTRY beam then EXIT beam
        // - OUT scan (Exit side): Expect EXIT beam then ENTRY beam

        const candidate = session.authorizedUsers.find(user => {
            const isFirstNode = (user.direction === 'IN' && nodeDirection === 'ENTRY') ||
                (user.direction === 'OUT' && nodeDirection === 'EXIT') ||
                (user.direction === 'ENTRY' && nodeDirection === 'ENTRY') ||
                (user.direction === 'EXIT' && nodeDirection === 'EXIT');

            const isSecondNode = (user.direction === 'IN' && nodeDirection === 'EXIT') ||
                (user.direction === 'OUT' && nodeDirection === 'ENTRY') ||
                (user.direction === 'ENTRY' && nodeDirection === 'EXIT') ||
                (user.direction === 'EXIT' && nodeDirection === 'ENTRY');

            if (user.state === 'WAITING') return isFirstNode;
            if (user.state === 'CROSSING') return isSecondNode;
            return false;
        });

        if (candidate) {
            if (candidate.state === 'WAITING') {
                candidate.state = 'CROSSING';
                console.log(`[Tailgating] ${candidate.userId} half-way: ${nodeDirection} beam triggered`);
            } else {
                candidate.state = 'COMPLETED';
                console.log(`[Tailgating] ${candidate.userId} sequence COMPLETED: ${nodeDirection} beam triggered`);
            }

            session.crossings.push({ deviceId, nodeDirection, timestamp, userId: candidate.userId });
            return targetClusterId;
        }

        // If no candidate and we have active unauthorized entries, this might be a tailgater
        // Or if everyone who scaned is already completed/waiting for other things
        return this.triggerTailgatingAlarm(deviceId, targetClusterId, nodeDirection, timestamp, session);
    }

    triggerUnauthorizedAlarm(deviceId, clusterId, direction, timestamp) {
        console.log(`🚨 UNAUTHORIZED: Beam crossing without scan - Cluster ${clusterId}`);

        if (this.io) {
            this.io.emit('security:alarm', {
                type: 'UNAUTHORIZED_ENTRY',
                severity: 'critical',
                deviceId,
                clusterId,
                direction,
                timestamp: Date.now(),
                reason: 'No active authorization in this cluster'
            });
        }

        // Emit for master-buzzer orchestration
        this.emit('alarm', {
            clusterId,
            type: 'UNAUTHORIZED'
        });

        return null;
    }

    triggerTailgatingAlarm(deviceId, clusterId, direction, timestamp, session) {
        console.log(`🚨 TAILGATING: Extra person detected in cluster ${clusterId}`);

        if (this.io) {
            this.io.emit('security:alarm', {
                type: 'TAILGATING',
                severity: 'critical',
                deviceId,
                clusterId,
                direction,
                timestamp: Date.now(),
                authorized: session.authorizedUsers.length,
                reason: 'Extra person detected (crossing does not match any authorized sequence)'
            });
        }

        // Emit for master-buzzer orchestration
        this.emit('alarm', {
            clusterId,
            type: 'TAILGATING'
        });

        return null; // Return null to indicate alarm triggered
    }

    evaluateAndCloseSession(clusterId) {
        const session = this.clusterSessions.get(clusterId);
        if (!session) return;

        const now = Date.now();
        if (now < session.endTime) return;

        console.log(`[Tailgating] Closing session for cluster ${clusterId}. Total authorized: ${session.authorizedUsers.length}`);
        this.clusterSessions.delete(clusterId);
    }

    /**
     * Record face detection (supplementary)
     */
    recordFaceDetection(deviceId, faceCount, timestamp, clusterId) {
        // Log for record but don't interfere with IR logic
        if (faceCount > 0) {
            console.log(`[Camera] Cluster ${clusterId} device ${deviceId} saw ${faceCount} faces`);
        }
    }
}

export default new TailgatingDetectionService();
