import express from 'express';
import * as cameraController from '../../controllers/cameraController.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = express.Router();

/**
 * @route   GET /api/cameras
 * @desc    Get all active cameras
 * @access  Private
 */
router.get('/', authenticateToken, cameraController.getAllCameras);

/**
 * @route   GET /api/cameras/debug/connections
 * @desc    Get connected camera WebSockets (Debug)
 * @access  Private
 */
router.get('/debug/connections', authenticateToken, cameraController.getConnectedCameras);

/**
 * @route   GET /api/cameras/:id
 * @desc    Get camera by ID/MAC
 * @access  Private
 */
router.get('/:id', authenticateToken, cameraController.getCameraById);

/**
 * @route   GET /api/cameras/cluster/:clusterId
 * @desc    Get cameras by cluster
 * @access  Private
 */
router.get('/cluster/:clusterId', authenticateToken, cameraController.getCamerasByCluster);

/**
 * @route   PUT /api/cameras/:id
 * @desc    Update camera settings
 * @access  Private
 */
router.put('/:id', authenticateToken, cameraController.updateCamera);

/**
 * @route   POST /api/cameras/:deviceMAC/object-detection
 * @desc    Enable or disable object detection on a camera device
 * @body    { enabled: boolean }
 * @access  Private
 */
router.post('/:deviceMAC/object-detection', authenticateToken, cameraController.setObjectDetection);

export default router;
