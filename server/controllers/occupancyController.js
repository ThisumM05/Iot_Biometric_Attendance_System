import occupancyService from '../services/occupancy-state/occupancyService.js';

/**
 * Occupancy Controller
 * Handles HTTP requests for occupancy tracking and alert management
 */
class OccupancyController {
    /**
     * Update occupancy count
     * POST /api/occupancy/update
     */
    updateOccupancy = async (req, res) => {
        try {
            const {
                deviceId,
                personCount,
                location,
                fingerprintScanAttempt,
                userId,
                snapshotMetadata
            } = req.body;

            // Validation
            if (!deviceId || personCount === undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: deviceId, personCount'
                });
            }

            if (typeof personCount !== 'number' || personCount < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid personCount: must be a non-negative number'
                });
            }

            // Update occupancy
            const result = await occupancyService.updateOccupancy({
                deviceId,
                personCount,
                location,
                fingerprintScanAttempt: fingerprintScanAttempt || false,
                userId,
                snapshotMetadata
            });

            // Broadcast via WebSocket if alert triggered
            if (result.alert.triggered && req.app.get('io')) {
                const io = req.app.get('io');
                io.emit('occupancy:alert', {
                    deviceId,
                    personCount,
                    severity: result.alert.severity,
                    message: result.alert.message,
                    timestamp: new Date(),
                    logId: result.log._id
                });
            }

            // Also broadcast current state update
            if (req.app.get('io')) {
                const io = req.app.get('io');
                io.emit('occupancy:update', {
                    deviceId,
                    currentState: result.currentState,
                    event: result.event
                });
            }

            res.status(200).json(result);

        } catch (error) {
            console.error('Error in updateOccupancy:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    };

    /**
     * Get occupancy logs
     * GET /api/occupancy/logs
     */
    getOccupancyLogs = async (req, res) => {
        try {
            const filters = {
                deviceId: req.query.deviceId,
                startDate: req.query.startDate,
                endDate: req.query.endDate,
                eventType: req.query.eventType,
                alertTriggered: req.query.alertTriggered === 'true' ? true : req.query.alertTriggered === 'false' ? false : undefined,
                resolved: req.query.resolved === 'true' ? true : req.query.resolved === 'false' ? false : undefined,
                limit: parseInt(req.query.limit) || 100,
                skip: parseInt(req.query.skip) || 0
            };

            const result = await occupancyService.getOccupancyLogs(filters);

            res.status(200).json({
                success: true,
                data: result
            });

        } catch (error) {
            console.error('Error in getOccupancyLogs:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    };

    /**
     * Get active alerts
     * GET /api/occupancy/alerts/active
     */
    getActiveAlerts = async (req, res) => {
        try {
            const alerts = await occupancyService.getActiveAlerts();

            res.status(200).json({
                success: true,
                count: alerts.length,
                alerts
            });

        } catch (error) {
            console.error('Error in getActiveAlerts:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    };

    /**
     * Resolve an alert
     * PUT /api/occupancy/alerts/:id/resolve
     */
    resolveAlert = async (req, res) => {
        try {
            const { id } = req.params;
            const { resolvedBy, notes } = req.body;

            if (!resolvedBy) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required field: resolvedBy'
                });
            }

            const updatedLog = await occupancyService.resolveAlert(id, {
                resolvedBy,
                notes
            });

            // Broadcast resolution via WebSocket
            if (req.app.get('io')) {
                const io = req.app.get('io');
                io.emit('occupancy:alert:resolved', {
                    alertId: id,
                    resolvedBy,
                    resolvedAt: updatedLog.resolvedAt
                });
            }

            res.status(200).json({
                success: true,
                data: updatedLog
            });

        } catch (error) {
            console.error('Error in resolveAlert:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    };

    /**
     * Get occupancy statistics
     * GET /api/occupancy/statistics
     */
    getStatistics = async (req, res) => {
        try {
            const filters = {
                deviceId: req.query.deviceId,
                startDate: req.query.startDate,
                endDate: req.query.endDate
            };

            const stats = await occupancyService.getStatistics(filters);

            res.status(200).json({
                success: true,
                data: stats
            });

        } catch (error) {
            console.error('Error in getStatistics:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    };

    /**
     * Get current states of all devices
     * GET /api/occupancy/current-state
     */
    getCurrentState = async (req, res) => {
        try {
            const deviceId = req.query.deviceId;

            if (deviceId) {
                const state = occupancyService.getDeviceState(deviceId);
                res.status(200).json({
                    success: true,
                    deviceId,
                    state
                });
            } else {
                const states = occupancyService.getCurrentStatesSnapshot();
                res.status(200).json({
                    success: true,
                    states
                });
            }

        } catch (error) {
            console.error('Error in getCurrentState:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    };

    /**
     * Reset occupancy for a device
     * POST /api/occupancy/reset
     */
    resetOccupancy = async (req, res) => {
        try {
            const { deviceId } = req.body;

            if (!deviceId) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required field: deviceId'
                });
            }

            const result = occupancyService.resetOccupancy(deviceId);

            // Broadcast reset via WebSocket
            if (req.app.get('io')) {
                const io = req.app.get('io');
                io.emit('occupancy:reset', {
                    deviceId,
                    state: result.state
                });
            }

            res.status(200).json(result);

        } catch (error) {
            console.error('Error in resetOccupancy:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    };

    /**
     * Get configuration
     * GET /api/occupancy/config
     */
    getConfiguration = async (req, res) => {
        try {
            const config = occupancyService.getConfiguration();

            res.status(200).json({
                success: true,
                config
            });

        } catch (error) {
            console.error('Error in getConfiguration:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    };

    /**
     * Update configuration
     * PUT /api/occupancy/config
     */
    updateConfiguration = async (req, res) => {
        try {
            const { MAX_ALLOWED_PERSONS, COOLDOWN_PERIOD_MS } = req.body;

            const config = occupancyService.updateConfiguration({
                MAX_ALLOWED_PERSONS,
                COOLDOWN_PERIOD_MS
            });

            res.status(200).json({
                success: true,
                message: 'Configuration updated',
                config
            });

        } catch (error) {
            console.error('Error in updateConfiguration:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    };
}

export default new OccupancyController();
