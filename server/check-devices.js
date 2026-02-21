import mongoose from 'mongoose';
import Device from './models/Device.js';
import Cluster from './models/Cluster.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkDevices() {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/iot_biometric');
        console.log('✅ Connected to MongoDB\n');

        // Get all devices
        const devices = await Device.find({});
        console.log(`📱 Total Devices: ${devices.length}\n`);

        if (devices.length === 0) {
            console.log('❌ No devices found in database');
        } else {
            console.log('Device List:');
            console.log('─────────────────────────────────────────────────────────────');
            devices.forEach((device, index) => {
                console.log(`\n${index + 1}. Device MAC: ${device.deviceMAC}`);
                console.log(`   Type: ${device.deviceType}`);
                console.log(`   Status: ${device.status}`);
                console.log(`   Cluster: ${device.clusterID || 'Not assigned'}`);
                console.log(`   Role: ${device.deviceRole || 'Not assigned'}`);
                console.log(`   Scanner: ${device.scannerID || 'Not assigned'}`);
                console.log(`   Capabilities: ${device.capabilities?.join(', ') || 'None'}`);
                console.log(`   Registered: ${device.registeredAt}`);
                console.log(`   Last Heartbeat: ${device.lastHeartbeat || 'Never'}`);

                if (device.isOnline && typeof device.isOnline === 'function') {
                    console.log(`   Online: ${device.isOnline() ? '✅ Yes' : '❌ No'}`);
                }
            });
            console.log('\n─────────────────────────────────────────────────────────────');
        }

        // Get all clusters
        const clusters = await Cluster.find({});
        console.log(`\n🏢 Total Clusters: ${clusters.length}\n`);

        if (clusters.length === 0) {
            console.log('❌ No clusters found in database');
            console.log('\n💡 TIP: Create a cluster first using:');
            console.log('   POST http://localhost:5000/api/devices/clusters');
            console.log('   Body: { "clusterID": "DOOR_01", "clusterName": "Main Door", "location": "Building A" }');
        } else {
            console.log('Cluster List:');
            console.log('─────────────────────────────────────────────────────────────');
            clusters.forEach((cluster, index) => {
                console.log(`\n${index + 1}. Cluster ID: ${cluster.clusterID}`);
                console.log(`   Name: ${cluster.clusterName}`);
                console.log(`   Location: ${cluster.location}`);
                console.log(`   Status: ${cluster.status}`);
                console.log(`   Devices: ${cluster.devices?.length || 0}`);
                console.log(`   Door Control Device: ${cluster.doorControlDevice || 'Not set'}`);

                if (cluster.devices && cluster.devices.length > 0) {
                    console.log('   Device List:');
                    cluster.devices.forEach(d => {
                        console.log(`     - ${d.deviceMAC} (${d.role}) - Scanner: ${d.scannerID}`);
                    });
                }
            });
            console.log('\n─────────────────────────────────────────────────────────────');
        }

        // Check for pending devices
        const pendingDevices = devices.filter(d => d.status === 'PENDING');
        if (pendingDevices.length > 0) {
            console.log(`\n⏳ Pending Approval: ${pendingDevices.length} devices`);
            console.log('These should appear in dashboard at: http://localhost:5173/devices');
            console.log('Go to "Pending Approval" tab to approve them.\n');
        }

        // Check for active devices not in any cluster
        const activeWithoutCluster = devices.filter(d => d.status === 'ACTIVE' && !d.clusterID);
        if (activeWithoutCluster.length > 0) {
            console.log(`\n⚠️  Warning: ${activeWithoutCluster.length} ACTIVE devices without cluster assignment`);
            activeWithoutCluster.forEach(d => {
                console.log(`   - ${d.deviceMAC} (${d.deviceType})`);
            });
            console.log('These devices are active but not assigned to any cluster!\n');
        }

        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkDevices();
