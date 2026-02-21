import OccupancyLog from '../../models/OccupancyLog.js';

/**
 * Occupancy Tracking Service
 * Manages real-time occupancy state, detects entry/exit events,
 * and triggers alerts based on configured thresholds
 */
class OccupancyService {
    constructor() {
        // Configuration
        this.MAX_ALLOWED_PERSONS = 1;
        this.COOLDOWN_PERIOD_MS = 10000; // 10 seconds

        // In-memory state management (per device)
        this.deviceStates = new Map();

        // Alert cooldown tracking (per device)
        this.lastAlertTime = new Map();

        // Initialize state from DB
        this.initialized = false;
    }

    /**
     * Initialize state from the latest logs in the database
     */
    async initialize() {
        try {
            console.log('[Occupancy Service] Initializing state from database...');

            // Find the latest log for each unique location (which acts as our shared tracking key for clusters)
            const latestLogs = await OccupancyLog.aggregate([
                { $sort: { timestamp: -1 } },
                {
                    $group: {
                        _id: "$location",
                        latestCount: { $first: "$personCount" },
                        latestTimestamp: { $first: "$timestamp" }
                    }
                }
            ]);

            for (const log of latestLogs) {
                if (log._id) {
                    this.deviceStates.set(log._id, {
                        personCount: log.latestCount,
                        lastUpdate: log.latestTimestamp,
                        location: log._id
                    });
                }
            }

            this.initialized = true;
            console.log(`[Occupancy Service] Initialized state for ${latestLogs.length} locations`);
        } catch (error) {
            console.error('[Occupancy Service] Initialization failed:', error);
        }
    }

    /**
     * Get current occupancy state for a device
     * @param {string} deviceId - Device identifier
     * @returns {Object} Current occupancy state
     */
    getDeviceState(deviceId) {
        if (!this.deviceStates.has(deviceId)) {
            this.deviceStates.set(deviceId, {
                personCount: 0,
                lastUpdate: new Date(),
                location: 'Main Office'
            });
        }
        return this.deviceStates.get(deviceId);
    }

    /**
     * Update occupancy count and detect events
     * @param {Object} data - Occupancy update data
     * @returns {Promise<Object>} Event details and alert status
     */
    async updateOccupancy(data) {
        const {
            deviceId,
            trackingKey,
            personCount,
            location = 'Main Office',
            fingerprintScanAttempt = false,
            userId = null,
            snapshotMetadata = null,
            forceEventType = null,
            eventMessage = null
        } = data;

        // Use trackingKey (e.g. clusterID) as shared state key so entry+exit
        // devices in the same location share one occupancy counter
        const stateKey = trackingKey || deviceId;

        try {
            // Get current state using shared key
            const currentState = this.getDeviceState(stateKey);
            const previousCount = currentState.personCount;

            // Detect event type (or use forced type)
            const eventType = forceEventType || this.detectEventType(previousCount, personCount);

            // Determine alert status
            const alertInfo = this.evaluateAlert(
                personCount,
                fingerprintScanAttempt,
                deviceId
            );

            // If no alert but we have a descriptive message, use it
            if (!alertInfo.triggered && eventMessage) {
                alertInfo.message = eventMessage;
            }

            // Update in-memory state using shared key
            currentState.personCount = personCount;
            currentState.lastUpdate = new Date();
            currentState.location = location;

            // Create occupancy log
            const occupancyLog = await OccupancyLog.create({
                timestamp: new Date(),
                personCount,
                previousCount,
                eventType,
                deviceId,
                location,
                alertTriggered: alertInfo.triggered,
                alertSeverity: alertInfo.severity,
                alertMessage: alertInfo.message,
                fingerprintScanAttempt,
                userId,
                snapshotMetadata
            });

            // Update last alert time if alert was triggered
            if (alertInfo.triggered) {
                this.lastAlertTime.set(deviceId, Date.now());
            }

            return {
                success: true,
                event: {
                    eventType,
                    personCount,
                    previousCount,
                    change: personCount - previousCount
                },
                alert: alertInfo,
                log: occupancyLog,
                currentState: {
                    personCount: currentState.personCount,
                    lastUpdate: currentState.lastUpdate,
                    location: currentState.location
                }
            };

        } catch (error) {
            console.error('Error updating occupancy:', error);
            throw new Error(`Occupancy update failed: ${error.message}`);
        }
    }

    /**
     * Detect event type based on count change
     * @param {number} previousCount - Previous person count
     * @param {number} newCount - New person count
     * @returns {string} Event type
     */
    detectEventType(previousCount, newCount) {
        if (newCount > previousCount) {
            return 'ENTRY';
        } else if (newCount < previousCount) {
            return 'EXIT';
        }
        return 'NO_CHANGE';
    }

    /**
     * Evaluate if alert should be triggered
     * @param {number} personCount - Current person count
     * @param {boolean} fingerprintScanAttempt - Whether fingerprint scan is happening
     * @param {string} deviceId - Device identifier
     * @returns {Object} Alert information
     */
    evaluateAlert(personCount, fingerprintScanAttempt, deviceId) {
        const alertInfo = {
            triggered: false,
            severity: 'NONE',
            message: '',
            inCooldown: false
        };

        // Check if count exceeds allowed limit
        if (personCount > this.MAX_ALLOWED_PERSONS) {
            // Check cooldown period
            const lastAlert = this.lastAlertTime.get(deviceId);
            const now = Date.now();

            if (lastAlert && (now - lastAlert) < this.COOLDOWN_PERIOD_MS) {
                alertInfo.inCooldown = true;
                alertInfo.message = `Alert suppressed (cooldown: ${Math.ceil((this.COOLDOWN_PERIOD_MS - (now - lastAlert)) / 1000)}s remaining)`;
                return alertInfo;
            }

            // Determine severity
            if (personCount === 2) {
                alertInfo.severity = 'WARNING';
                alertInfo.message = `WARNING: 2 persons detected at ${deviceId}`;
            } else if (personCount >= 3) {
                alertInfo.severity = 'CRITICAL';
                alertInfo.message = `CRITICAL: ${personCount} persons detected at ${deviceId}`;
            }

            // Additional alert if during fingerprint scan
            if (fingerprintScanAttempt) {
                alertInfo.message += ` during fingerprint authentication attempt!`;
                alertInfo.severity = 'CRITICAL'; // Escalate to critical
            }

            alertInfo.triggered = true;
        }

        return alertInfo;
    }

    /**
     * Get occupancy logs with filtering
     * @param {Object} filters - Query filters
     * @returns {Promise<Array>} Occupancy logs
     */
    async getOccupancyLogs(filters = {}) {
        try {
            const {
                deviceId,
                startDate,
                endDate,
                eventType,
                alertTriggered,
                resolved,
                limit = 100,
                skip = 0
            } = filters;

            const query = {};

            if (deviceId) query.deviceId = deviceId;
            if (eventType) query.eventType = eventType;
            if (alertTriggered !== undefined) query.alertTriggered = alertTriggered;
            if (resolved !== undefined) query.resolved = resolved;

            if (startDate || endDate) {
                query.timestamp = {};
                if (startDate) query.timestamp.$gte = new Date(startDate);
                if (endDate) query.timestamp.$lte = new Date(endDate);
            }

            const logs = await OccupancyLog.find(query)
                .populate('userId', 'username email')
                .populate('resolvedBy', 'username email')
                .sort({ timestamp: -1 })
                .limit(limit)
                .skip(skip)
                .lean();

            const total = await OccupancyLog.countDocuments(query);

            return {
                logs,
                total,
                limit,
                skip
            };

        } catch (error) {
            console.error('Error fetching occupancy logs:', error);
            throw new Error(`Failed to fetch occupancy logs: ${error.message}`);
        }
    }

    /**
     * Get active alerts (unresolved)
     * @param {boolean} populate - Whether to populate user references
     * @returns {Promise<Array>} Active alerts
     */
    async getActiveAlerts(populate = true) {
        try {
            const query = OccupancyLog.find({
                alertTriggered: true,
                resolved: false
            });

            if (populate) {
                query.populate('userId', 'username email')
                    .populate('resolvedBy', 'username email');
            }

            const alerts = await query
                .sort({ timestamp: -1 })
                .lean();

            return alerts;

        } catch (error) {
            console.error('Error fetching active alerts:', error);
            throw new Error(`Failed to fetch active alerts: ${error.message}`);
        }
    }

    /**
     * Resolve an alert
     * @param {string} alertId - Alert/Log ID
     * @param {Object} data - Resolution data
     * @returns {Promise<Object>} Updated log
     */
    async resolveAlert(alertId, data) {
        try {
            const { resolvedBy, notes } = data;

            const updatedLog = await OccupancyLog.findByIdAndUpdate(
                alertId,
                {
                    resolved: true,
                    resolvedAt: new Date(),
                    resolvedBy,
                    notes
                },
                { new: true }
            ).populate('userId resolvedBy', 'username email');

            if (!updatedLog) {
                throw new Error('Alert not found');
            }

            return updatedLog;

        } catch (error) {
            console.error('Error resolving alert:', error);
            throw new Error(`Failed to resolve alert: ${error.message}`);
        }
    }

    /**
     * Get occupancy statistics
     * @param {Object} filters - Query filters
     * @returns {Promise<Object>} Statistics
     */
    async getStatistics(filters = {}) {
        try {
            const { deviceId, startDate, endDate } = filters;

            const query = {};
            if (deviceId) query.deviceId = deviceId;
            if (startDate || endDate) {
                query.timestamp = {};
                if (startDate) query.timestamp.$gte = new Date(startDate);
                if (endDate) query.timestamp.$lte = new Date(endDate);
            }

            const [
                totalLogs,
                entryEvents,
                exitEvents,
                totalAlerts,
                warningAlerts,
                criticalAlerts,
                unresolvedAlerts,
                avgOccupancy,
                peakOccupancy
            ] = await Promise.all([
                OccupancyLog.countDocuments(query),
                OccupancyLog.countDocuments({ ...query, eventType: 'ENTRY' }),
                OccupancyLog.countDocuments({ ...query, eventType: 'EXIT' }),
                OccupancyLog.countDocuments({ ...query, alertTriggered: true }),
                OccupancyLog.countDocuments({ ...query, alertSeverity: 'WARNING' }),
                OccupancyLog.countDocuments({ ...query, alertSeverity: 'CRITICAL' }),
                OccupancyLog.countDocuments({ ...query, alertTriggered: true, resolved: false }),
                OccupancyLog.aggregate([
                    { $match: query },
                    { $group: { _id: null, avgCount: { $avg: '$personCount' } } }
                ]),
                OccupancyLog.aggregate([
                    { $match: query },
                    { $group: { _id: null, maxCount: { $max: '$personCount' } } }
                ])
            ]);

            return {
                totalLogs,
                events: {
                    entries: entryEvents,
                    exits: exitEvents,
                    noChange: totalLogs - entryEvents - exitEvents
                },
                alerts: {
                    total: totalAlerts,
                    warning: warningAlerts,
                    critical: criticalAlerts,
                    unresolved: unresolvedAlerts,
                    resolved: totalAlerts - unresolvedAlerts
                },
                occupancy: {
                    average: avgOccupancy[0]?.avgCount || 0,
                    peak: peakOccupancy[0]?.maxCount || 0
                },
                currentStates: this.getCurrentStatesSnapshot()
            };

        } catch (error) {
            console.error('Error fetching statistics:', error);
            throw new Error(`Failed to fetch statistics: ${error.message}`);
        }
    }

    /**
     * Get snapshot of all current device states
     * @returns {Array} Current states for all devices
     */
    getCurrentStatesSnapshot() {
        const states = [];
        for (const [deviceId, state] of this.deviceStates.entries()) {
            states.push({
                deviceId,
                ...state
            });
        }
        return states;
    }

    /**
     * Reset occupancy for a device (manual override)
     * @param {string} deviceId - Device identifier
     * @returns {Object} Updated state
     */
    resetOccupancy(deviceId) {
        const state = this.getDeviceState(deviceId);
        state.personCount = 0;
        state.lastUpdate = new Date();

        return {
            success: true,
            deviceId,
            state
        };
    }

    /**
     * Reset occupancy for all devices/locations
     */
    async resetAllOccupancy() {
        const locations = Array.from(this.deviceStates.keys());

        for (const loc of locations) {
            const state = this.deviceStates.get(loc);

            // Create a "RESET" log for each location
            await OccupancyLog.create({
                timestamp: new Date(),
                personCount: 0,
                previousCount: state.personCount,
                eventType: 'NO_CHANGE',
                deviceId: 'SYSTEM_RESET',
                location: loc,
                alertTriggered: false,
                alertMessage: 'Occupancy manually reset to 0'
            });
        }

        this.deviceStates.clear();
        return {
            success: true,
            message: `Reset occupancy for ${locations.length} locations to 0`
        };
    }

    /**
     * Update configuration
     * @param {Object} config - New configuration
     */
    updateConfiguration(config) {
        if (config.MAX_ALLOWED_PERSONS !== undefined) {
            this.MAX_ALLOWED_PERSONS = config.MAX_ALLOWED_PERSONS;
        }
        if (config.COOLDOWN_PERIOD_MS !== undefined) {
            this.COOLDOWN_PERIOD_MS = config.COOLDOWN_PERIOD_MS;
        }

        return {
            MAX_ALLOWED_PERSONS: this.MAX_ALLOWED_PERSONS,
            COOLDOWN_PERIOD_MS: this.COOLDOWN_PERIOD_MS
        };
    }

    /**
     * Get current configuration
     * @returns {Object} Current configuration
     */
    getConfiguration() {
        return {
            MAX_ALLOWED_PERSONS: this.MAX_ALLOWED_PERSONS,
            COOLDOWN_PERIOD_MS: this.COOLDOWN_PERIOD_MS,
            COOLDOWN_PERIOD_SECONDS: this.COOLDOWN_PERIOD_MS / 1000
        };
    }
}

// Export singleton instance
export default new OccupancyService();
