import express from 'express';
import occupancyController from '../../controllers/occupancyController.js';

const router = express.Router();

/**
 * Occupancy Tracking Routes
 * Base path: /api/occupancy
 */

// Update occupancy count (from IoT device/camera)
router.post('/update', occupancyController.updateOccupancy);

// Get occupancy logs with filtering
router.get('/logs', occupancyController.getOccupancyLogs);

// Get active (unresolved) alerts
router.get('/alerts/active', occupancyController.getActiveAlerts);

// Resolve an alert
router.put('/alerts/:id/resolve', occupancyController.resolveAlert);

// Get occupancy statistics
router.get('/statistics', occupancyController.getStatistics);

// Get current occupancy state
router.get('/current-state', occupancyController.getCurrentState);

// Reset occupancy for a device
router.post('/reset', occupancyController.resetOccupancy);

// Get configuration
router.get('/config', occupancyController.getConfiguration);

// Update configuration
router.put('/config', occupancyController.updateConfiguration);

export default router;
