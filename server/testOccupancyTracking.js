import OccupancyLog from './models/OccupancyLog.js';
import occupancyService from './services/occupancy-state/occupancyService.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Test script for occupancy tracking system
 * Simulates various scenarios to demonstrate functionality
 */
async function testOccupancyTracking() {
    try {
        console.log('🚀 Starting Occupancy Tracking Test...\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Clear previous test data
        await OccupancyLog.deleteMany({ deviceId: /TEST_DEVICE/ });
        console.log('🗑️  Cleared previous test data\n');

        const deviceId = 'TEST_DEVICE_001';

        // Test 1: Normal entry (1 person)
        console.log('📍 Test 1: Normal Entry (1 person)');
        let result = await occupancyService.updateOccupancy({
            deviceId,
            personCount: 1,
            location: 'Main Entrance',
            fingerprintScanAttempt: true,
            userId: new mongoose.Types.ObjectId()
        });
        console.log('Event:', result.event.eventType);
        console.log('Alert Triggered:', result.alert.triggered);
        console.log('Current State:', result.currentState);
        console.log('---\n');

        // Wait to avoid cooldown
        await sleep(1000);

        // Test 2: Warning alert (2 persons)
        console.log('📍 Test 2: Warning Alert (2 persons)');
        result = await occupancyService.updateOccupancy({
            deviceId,
            personCount: 2,
            location: 'Main Entrance'
        });
        console.log('Event:', result.event.eventType);
        console.log('Alert Triggered:', result.alert.triggered);
        console.log('Alert Severity:', result.alert.severity);
        console.log('Alert Message:', result.alert.message);
        console.log('---\n');

        // Test 3: Cooldown test (should suppress alert)
        console.log('📍 Test 3: Cooldown Test (immediate repeat)');
        result = await occupancyService.updateOccupancy({
            deviceId,
            personCount: 3,
            location: 'Main Entrance'
        });
        console.log('Alert Triggered:', result.alert.triggered);
        console.log('In Cooldown:', result.alert.inCooldown);
        console.log('Message:', result.alert.message);
        console.log('---\n');

        // Wait for cooldown to expire
        console.log('⏳ Waiting 11 seconds for cooldown to expire...');
        await sleep(11000);

        // Test 4: Critical alert after cooldown (3+ persons)
        console.log('📍 Test 4: Critical Alert (3 persons after cooldown)');
        result = await occupancyService.updateOccupancy({
            deviceId,
            personCount: 3,
            location: 'Main Entrance'
        });
        console.log('Event:', result.event.eventType);
        console.log('Alert Triggered:', result.alert.triggered);
        console.log('Alert Severity:', result.alert.severity);
        console.log('Alert Message:', result.alert.message);
        console.log('---\n');

        await sleep(1000);

        // Test 5: Critical alert during fingerprint scan
        console.log('📍 Test 5: Critical Alert During Fingerprint Scan');
        result = await occupancyService.updateOccupancy({
            deviceId,
            personCount: 2,
            location: 'Main Entrance',
            fingerprintScanAttempt: true,
            userId: new mongoose.Types.ObjectId(),
            snapshotMetadata: {
                imageUrl: '/snapshots/test_001.jpg',
                confidence: 0.95,
                detectionBox: { x: 100, y: 150, width: 200, height: 250 }
            }
        });
        console.log('Alert Triggered:', result.alert.triggered);
        console.log('Alert Severity:', result.alert.severity);
        console.log('Alert Message:', result.alert.message);
        console.log('---\n');

        await sleep(1000);

        // Test 6: Exit event
        console.log('📍 Test 6: Exit Event (1 person leaves)');
        result = await occupancyService.updateOccupancy({
            deviceId,
            personCount: 1,
            location: 'Main Entrance'
        });
        console.log('Event:', result.event.eventType);
        console.log('Alert Triggered:', result.alert.triggered);
        console.log('Current Count:', result.currentState.personCount);
        console.log('---\n');

        // Test 7: All exit
        console.log('📍 Test 7: All Exit (0 persons)');
        result = await occupancyService.updateOccupancy({
            deviceId,
            personCount: 0,
            location: 'Main Entrance'
        });
        console.log('Event:', result.event.eventType);
        console.log('Current Count:', result.currentState.personCount);
        console.log('---\n');

        // Get statistics
        console.log('📊 Fetching Statistics...');
        const stats = await occupancyService.getStatistics({ deviceId });
        console.log('Total Logs:', stats.totalLogs);
        console.log('Entry Events:', stats.events.entries);
        console.log('Exit Events:', stats.events.exits);
        console.log('Total Alerts:', stats.alerts.total);
        console.log('Warning Alerts:', stats.alerts.warning);
        console.log('Critical Alerts:', stats.alerts.critical);
        console.log('Unresolved Alerts:', stats.alerts.unresolved);
        console.log('Peak Occupancy:', stats.occupancy.peak);
        console.log('---\n');

        // Get active alerts
        console.log('🚨 Active Alerts:');
        const activeAlerts = await occupancyService.getActiveAlerts(false); // Don't populate in test
        console.log('Count:', activeAlerts.length);
        activeAlerts.forEach((alert, index) => {
            console.log(`Alert ${index + 1}:`, {
                id: alert._id,
                severity: alert.alertSeverity,
                message: alert.alertMessage,
                timestamp: alert.timestamp
            });
        });
        console.log('---\n');

        // Test configuration
        console.log('⚙️  Current Configuration:');
        const config = occupancyService.getConfiguration();
        console.log(config);
        console.log('---\n');

        console.log('✅ All tests completed successfully!\n');

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Run tests
testOccupancyTracking();
