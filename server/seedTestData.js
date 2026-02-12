import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Attendance from './models/Attendance.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/iot_attendance';

// Sample data configuration
const SAMPLE_USERS = [
    { username: 'john.doe', email: 'john@example.com', parentWhatsapp: '+12125551001', class: '11-A', fingerprintId: 1, isEnrolled: true, role: 'student' },
    { username: 'jane.smith', email: 'jane@example.com', parentWhatsapp: '+12125551002', class: '11-B', fingerprintId: 2, isEnrolled: true, role: 'student' },
    { username: 'bob.johnson', email: 'bob@example.com', parentWhatsapp: '+12125551003', class: '12-A', fingerprintId: 3, isEnrolled: true, role: 'student' },
    { username: 'alice.williams', email: 'alice@example.com', parentWhatsapp: '+12125551004', class: '12-B', fingerprintId: 4, isEnrolled: true, role: 'student' },
    { username: 'charlie.brown', email: 'charlie@example.com', parentWhatsapp: '+12125551005', class: '11-A', fingerprintId: 5, isEnrolled: true, role: 'student' },
];

// Helper to generate time in minutes from hours
const timeInMinutes = (hours, minutes = 0) => hours * 60 + minutes;

// Helper to create date with specific time
const createDateTime = (daysAgo, hours, minutes = 0) => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    date.setHours(hours, minutes, 0, 0);
    return date;
};

async function seedData() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Clear existing data
        console.log('🗑️  Clearing existing test data...');
        const testUsernames = SAMPLE_USERS.map(u => u.username);
        const testUsers = await User.find({ username: { $in: testUsernames } });
        const testUserIds = testUsers.map(u => u._id);
        await Attendance.deleteMany({ user: { $in: testUserIds } });
        console.log('✅ Cleared attendance data');

        // Create users if they don't exist
        console.log('👥 Creating sample users...');
        const createdUsers = {};
        for (const userData of SAMPLE_USERS) {
            const user = await User.findOneAndUpdate(
                { username: userData.username },
                userData,
                { upsert: true, new: true }
            );
            createdUsers[userData.username] = user;
        }
        console.log('✅ Created/Updated users');

        // Generate attendance data
        console.log('📊 Generating attendance data...');
        const attendanceRecords = [];

        // User 1 (john.doe) - REGULAR PATTERN (Early Bird - Good Attendance)
        // Consistently arrives between 8:00-8:30 AM
        for (let day = 30; day >= 1; day--) {
            if (day % 7 === 0 || day % 7 === 6) continue; // Skip weekends
            const arrivalTime = 8 + Math.random() * 0.5; // 8:00 - 8:30
            attendanceRecords.push({
                user: createdUsers['john.doe']._id,
                fingerprintId: 1,
                timestamp: createDateTime(day, Math.floor(arrivalTime), (arrivalTime % 1) * 60),
                deviceId: 'DEVICE_001',
                type: 'CHECK_IN'
            });
        }

        // User 2 (jane.smith) - OFTEN LATE PATTERN (Late Arrival - Consistent but Late)
        // Consistently arrives between 9:30-10:00 AM (work starts at 9:00)
        for (let day = 30; day >= 1; day--) {
            if (day % 7 === 0 || day % 7 === 6) continue;
            const arrivalTime = 9.5 + Math.random() * 0.5; // 9:30 - 10:00
            attendanceRecords.push({
                user: createdUsers['jane.smith']._id,
                fingerprintId: 2,
                timestamp: createDateTime(day, Math.floor(arrivalTime), (arrivalTime % 1) * 60),
                deviceId: 'DEVICE_001',
                type: 'CHECK_IN'
            });
        }

        // User 3 (bob.johnson) - POOR ATTENDANCE (Many Absences)
        // Only comes 2 days per week
        for (let day = 30; day >= 1; day--) {
            if (day % 7 === 0 || day % 7 === 6) continue;
            if (Math.random() > 0.4) continue; // 40% attendance
            const arrivalTime = 8.5 + Math.random() * 1; // 8:30 - 9:30
            attendanceRecords.push({
                user: createdUsers['bob.johnson']._id,
                fingerprintId: 3,
                timestamp: createDateTime(day, Math.floor(arrivalTime), (arrivalTime % 1) * 60),
                deviceId: 'DEVICE_001',
                type: 'CHECK_IN'
            });
        }

        // User 4 (alice.williams) - INCONSISTENT PATTERN (Variable Arrival)
        // Highly variable arrival times between 7:00 AM - 11:00 AM
        for (let day = 30; day >= 1; day--) {
            if (day % 7 === 0 || day % 7 === 6) continue;
            if (Math.random() > 0.85) continue; // Sometimes absent
            const arrivalTime = 7 + Math.random() * 4; // 7:00 - 11:00
            attendanceRecords.push({
                user: createdUsers['alice.williams']._id,
                fingerprintId: 4,
                timestamp: createDateTime(day, Math.floor(arrivalTime), (arrivalTime % 1) * 60),
                deviceId: Math.random() > 0.7 ? 'DEVICE_002' : 'DEVICE_001', // Sometimes different device
                type: 'CHECK_IN'
            });
        }

        // User 5 (charlie.brown) - AVERAGE PATTERN (Normal Behavior)
        // Arrives between 8:30-9:15 AM most days
        for (let day = 30; day >= 1; day--) {
            if (day % 7 === 0 || day % 7 === 6) continue;
            if (Math.random() > 0.9) continue; // Rarely absent
            const arrivalTime = 8.5 + Math.random() * 0.75; // 8:30 - 9:15
            attendanceRecords.push({
                user: createdUsers['charlie.brown']._id,
                fingerprintId: 5,
                timestamp: createDateTime(day, Math.floor(arrivalTime), (arrivalTime % 1) * 60),
                deviceId: 'DEVICE_001',
                type: 'CHECK_IN'
            });
        }

        // ADD ANOMALIES for demonstration
        console.log('🚨 Adding anomaly examples...');

        // ANOMALY 1: Very Late Arrival for john.doe (usually punctual)
        attendanceRecords.push({
            user: createdUsers['john.doe']._id,
            fingerprintId: 1,
            timestamp: createDateTime(2, 11, 30), // 11:30 AM - very late
            deviceId: 'DEVICE_001',
            type: 'CHECK_IN'
        });

        // ANOMALY 2: Weekend Attendance for jane.smith (unusual)
        const weekendDate = new Date();
        weekendDate.setDate(weekendDate.getDate() - 3); // Assuming 3 days ago was weekend
        weekendDate.setHours(9, 0, 0, 0);
        if (weekendDate.getDay() === 0 || weekendDate.getDay() === 6) {
            attendanceRecords.push({
                user: createdUsers['jane.smith']._id,
                fingerprintId: 2,
                timestamp: weekendDate,
                deviceId: 'DEVICE_001',
                type: 'CHECK_IN'
            });
        }

        // ANOMALY 3: Different Device for john.doe (always uses DEVICE_001)
        attendanceRecords.push({
            user: createdUsers['john.doe']._id,
            fingerprintId: 1,
            timestamp: createDateTime(1, 8, 15),
            deviceId: 'DEVICE_003', // Different device
            type: 'CHECK_IN'
        });

        // ANOMALY 4: Very Early Arrival for bob.johnson (unusual pattern)
        attendanceRecords.push({
            user: createdUsers['bob.johnson']._id,
            fingerprintId: 3,
            timestamp: createDateTime(1, 6, 0), // 6:00 AM - very early
            deviceId: 'DEVICE_001',
            type: 'CHECK_IN'
        });

        // ANOMALY 5: Multiple Entries Same Day for charlie.brown
        attendanceRecords.push({
            user: createdUsers['charlie.brown']._id,
            fingerprintId: 5,
            timestamp: createDateTime(1, 8, 30),
            deviceId: 'DEVICE_001',
            type: 'CHECK_IN'
        });
        attendanceRecords.push({
            user: createdUsers['charlie.brown']._id,
            fingerprintId: 5,
            timestamp: createDateTime(1, 14, 30), // Second entry same day
            deviceId: 'DEVICE_002',
            type: 'CHECK_IN'
        });

        // ANOMALY 6: Night Time Entry (highly unusual)
        attendanceRecords.push({
            user: createdUsers['jane.smith']._id,
            fingerprintId: 2,
            timestamp: createDateTime(3, 23, 45), // 11:45 PM
            deviceId: 'DEVICE_001',
            type: 'CHECK_IN'
        });

        // Insert all attendance records
        console.log(`📝 Inserting ${attendanceRecords.length} attendance records...`);
        await Attendance.insertMany(attendanceRecords);
        console.log('✅ Attendance data inserted');

        // Summary
        console.log('\n📊 DATA SEED SUMMARY');
        console.log('='.repeat(50));
        console.log(`✅ Users created: ${SAMPLE_USERS.length}`);
        console.log(`✅ Attendance records: ${attendanceRecords.length}`);
        console.log('\n👥 USER PATTERNS:');
        console.log('  john.doe: Early Bird (Consistent 8:00-8:30 AM)');
        console.log('  jane.smith: Often Late (Consistent 9:30-10:00 AM)');
        console.log('  bob.johnson: Poor Attendance (40% attendance rate)');
        console.log('  alice.williams: Inconsistent (Variable 7:00-11:00 AM)');
        console.log('  charlie.brown: Average (Normal 8:30-9:15 AM)');
        console.log('\n🚨 ANOMALIES INCLUDED:');
        console.log('  ⏰ Very late arrival (john.doe at 11:30 AM)');
        console.log('  📅 Weekend attendance (jane.smith)');
        console.log('  🔧 Different device (john.doe using DEVICE_003)');
        console.log('  🌅 Very early arrival (bob.johnson at 6:00 AM)');
        console.log('  🔄 Multiple entries same day (charlie.brown)');
        console.log('  🌙 Night time entry (jane.smith at 11:45 PM)');
        console.log('\n🎯 EXPECTED CLUSTERS:');
        console.log('  Cluster 1: Regular/Punctual (john.doe, charlie.brown)');
        console.log('  Cluster 2: Late/Inconsistent (jane.smith, alice.williams)');
        console.log('  Cluster 3: Poor Attendance (bob.johnson)');
        console.log('='.repeat(50));
        console.log('\n✨ Next steps:');
        console.log('  1. Train anomaly model: POST /api/attendance/anomaly-train');
        console.log('  2. Detect anomalies: POST /api/attendance/anomaly-detect');
        console.log('  3. View clusters: GET /api/attendance/clusters');
        console.log('  4. View anomalies: GET /api/attendance/anomalies');
        console.log('\n✅ Seed completed successfully!\n');

    } catch (error) {
        console.error('❌ Error seeding data:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

// Run the seed function
seedData();
