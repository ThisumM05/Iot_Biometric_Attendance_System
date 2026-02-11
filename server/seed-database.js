import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './models/User.js';
import Attendance from './models/Attendance.js';

// Load environment variables
dotenv.config();

const seedDatabase = async () => {
    try {
        console.log('🌱 Starting database seeding...');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Clear existing data
        await User.deleteMany({});
        await Attendance.deleteMany({});
        console.log('🧹 Cleared existing data');

        // Create 10 users (5 original + 5 new)
        const users = await User.insertMany([
            {
                username: 'john_doe',
                email: 'john.doe@company.com',
                role: 'employee',
                fingerprintId: 101,
                isEnrolled: true
            },
            {
                username: 'sarah_smith',
                email: 'sarah.smith@company.com',
                role: 'employee',
                fingerprintId: 102,
                isEnrolled: true
            },
            {
                username: 'mike_wilson',
                email: 'mike.wilson@company.com',
                role: 'employee',
                fingerprintId: 103,
                isEnrolled: true
            },
            {
                username: 'emily_brown',
                email: 'emily.brown@company.com',
                role: 'employee',
                fingerprintId: 104,
                isEnrolled: true
            },
            {
                username: 'admin_user',
                email: 'admin@company.com',
                role: 'admin',
                fingerprintId: 105,
                isEnrolled: true
            },
            // 5 Additional Students
            {
                username: 'alex_johnson',
                email: 'alex.johnson@company.com',
                role: 'employee',
                fingerprintId: 106,
                isEnrolled: true
            },
            {
                username: 'jessica_davis',
                email: 'jessica.davis@company.com',
                role: 'employee',
                fingerprintId: 107,
                isEnrolled: true
            },
            {
                username: 'ryan_martinez',
                email: 'ryan.martinez@company.com',
                role: 'employee',
                fingerprintId: 108,
                isEnrolled: true
            },
            {
                username: 'sophia_garcia',
                email: 'sophia.garcia@company.com',
                role: 'employee',
                fingerprintId: 109,
                isEnrolled: true
            },
            {
                username: 'ethan_rodriguez',
                email: 'ethan.rodriguez@company.com',
                role: 'employee',
                fingerprintId: 110,
                isEnrolled: true
            }
        ]);

        console.log(`👥 Created ${users.length} users`);

        // Create attendance records for AI/ML analysis
        const attendanceRecords = [];
        const deviceIds = ['DEVICE_001', 'DEVICE_002', 'DEVICE_003']; // Multiple devices

        // Helper function to create a date
        const createDate = (daysAgo, hour, minute = 0) => {
            const date = new Date();
            date.setDate(date.getDate() - daysAgo);
            date.setHours(hour, minute, 0, 0);
            return date;
        };

        // Helper function to get random device
        const getRandomDevice = () => deviceIds[Math.floor(Math.random() * deviceIds.length)];

        // Define user personas for AI/ML patterns
        const userPersonas = {
            'john_doe': { type: 'punctual', checkInRange: [8.0, 8.3], checkOutRange: [17.0, 17.5], absenceRate: 0.05 },
            'sarah_smith': { type: 'early_bird', checkInRange: [7.5, 8.0], checkOutRange: [16.5, 17.0], absenceRate: 0.02 },
            'mike_wilson': { type: 'late_regular', checkInRange: [8.5, 9.2], checkOutRange: [17.5, 18.5], absenceRate: 0.08 },
            'emily_brown': { type: 'irregular', checkInRange: [7.8, 9.5], checkOutRange: [16.0, 19.0], absenceRate: 0.12 },
            'admin_user': { type: 'admin', checkInRange: [7.0, 8.5], checkOutRange: [18.0, 20.0], absenceRate: 0.03 },
            'alex_johnson': { type: 'consistent', checkInRange: [8.2, 8.4], checkOutRange: [17.2, 17.4], absenceRate: 0.04 },
            'jessica_davis': { type: 'overtime', checkInRange: [8.0, 8.5], checkOutRange: [18.0, 20.0], absenceRate: 0.06 },
            'ryan_martinez': { type: 'flexible', checkInRange: [8.0, 10.0], checkOutRange: [17.0, 19.0], absenceRate: 0.10 },
            'sophia_garcia': { type: 'part_time', checkInRange: [9.0, 9.5], checkOutRange: [15.0, 16.0], absenceRate: 0.15 },
            'ethan_rodriguez': { type: 'weekend_worker', checkInRange: [8.5, 9.0], checkOutRange: [17.0, 17.5], absenceRate: 0.07 }
        };

        // Generate comprehensive attendance data for past 60 days
        for (let day = 59; day >= 0; day--) {
            const currentDate = createDate(day, 0);
            const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            for (const user of users) {
                const persona = userPersonas[user.username];
                if (!persona) continue;

                // Determine if user should be absent
                const shouldBeAbsent = Math.random() < persona.absenceRate;

                // Weekend work logic
                let shouldWorkWeekend = false;
                if (isWeekend) {
                    if (persona.type === 'weekend_worker') shouldWorkWeekend = Math.random() < 0.3;
                    else if (persona.type === 'admin' || persona.type === 'overtime') shouldWorkWeekend = Math.random() < 0.15;
                    else shouldWorkWeekend = Math.random() < 0.05;
                }

                // Skip if absent or weekend (unless should work weekend)
                if (shouldBeAbsent || (isWeekend && !shouldWorkWeekend)) continue;

                // Generate check-in time based on persona
                const checkInHour = persona.checkInRange[0] +
                    Math.random() * (persona.checkInRange[1] - persona.checkInRange[0]);
                const checkInMinute = Math.random() * 60;

                const checkInTime = createDate(day, Math.floor(checkInHour), Math.floor(checkInMinute));

                // Add some anomalies for AI detection
                let isAnomalous = Math.random() < 0.02; // 2% anomaly rate
                if (isAnomalous) {
                    // Create unusual patterns
                    if (Math.random() < 0.5) {
                        // Very early or very late check-in
                        checkInTime.setHours(Math.random() < 0.5 ? 5 : 12, Math.random() * 60);
                    }
                }

                attendanceRecords.push({
                    user: user._id,
                    fingerprintId: user.fingerprintId,
                    deviceId: getRandomDevice(),
                    timestamp: checkInTime,
                    type: 'CHECK_IN'
                });

                // Generate check-out time (80% of check-ins have check-outs)
                if (Math.random() < 0.8) {
                    const checkOutHour = persona.checkOutRange[0] +
                        Math.random() * (persona.checkOutRange[1] - persona.checkOutRange[0]);
                    const checkOutMinute = Math.random() * 60;

                    let checkOutTime = createDate(day, Math.floor(checkOutHour), Math.floor(checkOutMinute));

                    // Ensure check-out is after check-in
                    if (checkOutTime <= checkInTime) {
                        checkOutTime = new Date(checkInTime.getTime() + (4 * 60 * 60 * 1000)); // Add 4 hours minimum
                    }

                    // Add anomalies to check-out too
                    if (isAnomalous && Math.random() < 0.3) {
                        checkOutTime.setHours(Math.random() < 0.5 ? 14 : 23, Math.random() * 60);
                    }

                    attendanceRecords.push({
                        user: user._id,
                        fingerprintId: user.fingerprintId,
                        deviceId: getRandomDevice(),
                        timestamp: checkOutTime,
                        type: 'CHECK_OUT'
                    });
                }

                // Add lunch breaks for some users (10% chance)
                if (Math.random() < 0.1 && !isWeekend) {
                    const lunchOutTime = createDate(day, 12, 15 + Math.random() * 30);
                    const lunchInTime = createDate(day, 13, Math.random() * 30);

                    if (lunchOutTime > checkInTime) {
                        attendanceRecords.push({
                            user: user._id,
                            fingerprintId: user.fingerprintId,
                            deviceId: getRandomDevice(),
                            timestamp: lunchOutTime,
                            type: 'CHECK_OUT'
                        });

                        attendanceRecords.push({
                            user: user._id,
                            fingerprintId: user.fingerprintId,
                            deviceId: getRandomDevice(),
                            timestamp: lunchInTime,
                            type: 'CHECK_IN'
                        });
                    }
                }
            }
        }

        // Add today's partial records for real-time feel
        const today = new Date();
        const todayHour = today.getHours();

        if (todayHour >= 7) {
            // Add morning arrivals
            for (let i = 0; i < users.length; i++) {
                const user = users[i];
                const persona = userPersonas[user.username];

                if (Math.random() < 0.85) { // 85% show up today
                    const expectedCheckIn = persona.checkInRange[0] +
                        Math.random() * (persona.checkInRange[1] - persona.checkInRange[0]);

                    if (todayHour > expectedCheckIn || (todayHour === Math.floor(expectedCheckIn) && today.getMinutes() > (expectedCheckIn % 1) * 60)) {
                        attendanceRecords.push({
                            user: user._id,
                            fingerprintId: user.fingerprintId,
                            deviceId: getRandomDevice(),
                            timestamp: createDate(0, Math.floor(expectedCheckIn), (expectedCheckIn % 1) * 60),
                            type: 'CHECK_IN'
                        });
                    }
                }
            }
        }

        await Attendance.insertMany(attendanceRecords);
        console.log(`📊 Created ${attendanceRecords.length} attendance records`);

        // Show comprehensive summary
        console.log('\n📈 AI/ML Database Summary:');
        console.log(`👥 Users: ${await User.countDocuments()}`);
        console.log(`📊 Attendance Records: ${await Attendance.countDocuments()}`);
        console.log(`📅 Data Period: 60 days of historical data`);
        console.log(`🏢 Multiple Devices: ${['DEVICE_001', 'DEVICE_002', 'DEVICE_003'].length} biometric devices`);

        // Analyze data patterns for AI/ML insights
        const totalCheckIns = await Attendance.countDocuments({ type: 'CHECK_IN' });
        const totalCheckOuts = await Attendance.countDocuments({ type: 'CHECK_OUT' });
        const uniqueDays = await Attendance.aggregate([
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } } } },
            { $count: "uniqueDays" }
        ]);

        console.log(`\n🤖 AI/ML Data Insights:`);
        console.log(`   📥 Check-ins: ${totalCheckIns}`);
        console.log(`   📤 Check-outs: ${totalCheckOuts}`);
        console.log(`   📅 Active Days: ${uniqueDays[0]?.uniqueDays || 0}`);
        console.log(`   🎯 Anomaly Rate: ~2% (for detection training)`);
        console.log(`   📊 User Personas: 10 different behavioral patterns`);
        console.log(`   🏃‍♂️ Behavior Types: punctual, early_bird, late_regular, irregular, overtime, etc.`);

        console.log('\n👥 Created Users with Personas:');
        const allUsers = await User.find({}).select('username email role fingerprintId isEnrolled');
        const personaDescriptions = {
            'john_doe': 'Punctual (8:00-8:20 AM)',
            'sarah_smith': 'Early Bird (7:30-8:00 AM)',
            'mike_wilson': 'Late Regular (8:30-9:10 AM)',
            'emily_brown': 'Irregular (7:50-9:30 AM)',
            'admin_user': 'Admin (7:00-8:30 AM, long hours)',
            'alex_johnson': 'Consistent (8:10-8:25 AM)',
            'jessica_davis': 'Overtime Worker (8:00-8:30 AM, stays late)',
            'ryan_martinez': 'Flexible Hours (8:00-10:00 AM)',
            'sophia_garcia': 'Part-time (9:00-9:30 AM, leaves early)',
            'ethan_rodriguez': 'Weekend Worker (8:30-9:00 AM)'
        };

        allUsers.forEach((user, index) => {
            const persona = personaDescriptions[user.username] || 'Standard';
            console.log(`   ${index + 1}. ${user.username} - ${persona} - FP ID: ${user.fingerprintId}`);
        });

        console.log('\n📊 Recent Attendance Patterns (Last 15 records):');
        const recentAttendance = await Attendance.find({})
            .populate('user', 'username')
            .sort({ timestamp: -1 })
            .limit(15);

        recentAttendance.forEach((record, index) => {
            const date = record.timestamp.toLocaleDateString();
            const time = record.timestamp.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            const device = record.deviceId.replace('DEVICE_00', 'D');
            console.log(`   ${index + 1}. ${record.user.username} - ${record.type} - ${date} ${time} [${device}]`);
        });

        console.log('\n🎯 AI/ML Ready Features:');
        console.log('   ✅ 60 days of historical data');
        console.log('   ✅ 10 distinct user behavior patterns');
        console.log('   ✅ Multiple device tracking');
        console.log('   ✅ Weekend work patterns');
        console.log('   ✅ Scheduled anomalies for detection training');
        console.log('   ✅ Variable absence rates per user');
        console.log('   ✅ Lunch break tracking');
        console.log('   ✅ Overtime patterns');
        console.log('   ✅ Part-time vs full-time patterns');

        console.log('\n✅ Database seeding completed successfully!');

    } catch (error) {
        console.error('❌ Error seeding database:', error);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Database connection closed');
    }
};

// Run the seeding
seedDatabase();