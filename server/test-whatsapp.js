import dotenv from 'dotenv';
import whatsappService from './services/notification/whatsappService.js';

// Load environment variables
dotenv.config();

// Re-initialize WhatsApp service with loaded environment variables
whatsappService.reinitialize();

/**
 * Test WhatsApp notification functionality
 * Using john.doe's parent number from seedTestData: +12125551001
 */
async function testWhatsAppIntegration() {
    console.log('🧪 Testing WhatsApp Integration with Twilio');
    console.log('==========================================\n');

    // Test data - using your provided number
    const testStudent = {
        name: 'John Doe',
        parentWhatsapp: '+94707176178',
        checkInTime: new Date()
    };

    console.log('📋 Test Configuration:');
    console.log(`   Student: ${testStudent.name}`);
    console.log(`   Parent WhatsApp: ${testStudent.parentWhatsapp}`);
    console.log(`   Test Time: ${testStudent.checkInTime.toLocaleString()}`);
    console.log('\n📡 Twilio Configuration:');
    console.log(`   Account SID: ${process.env.TWILIO_ACCOUNT_SID ? '✅ Set' : '❌ Missing'}`);
    console.log(`   Auth Token: ${process.env.TWILIO_AUTH_TOKEN ? '✅ Set' : '❌ Missing'}`);
    console.log(`   WhatsApp From: ${process.env.TWILIO_WHATSAPP_FROM || '❌ Missing'}`);
    
    console.log('\n⚠️  IMPORTANT: WhatsApp Sandbox Setup Required');
    console.log('   Before testing, you need to join the Twilio WhatsApp Sandbox:');
    console.log('   1. Send "join <sandbox-code>" to +1 415 523 8886 on WhatsApp');
    console.log('   2. Or visit: https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn');
    console.log('   3. Follow the sandbox setup instructions');
    console.log('');
    try {
        console.log('\n🚀 Sending test WhatsApp notification...');
        
        // Test check-in notification
        const result = await whatsappService.sendCheckInNotification(
            testStudent.name,
            testStudent.parentWhatsapp,
            testStudent.checkInTime
        );

        if (result.success) {
            console.log('✅ WhatsApp notification sent successfully!');
            console.log(`   Message ID: ${result.messageId}`);
            console.log(`   To: ${testStudent.parentWhatsapp}`);
            console.log('   Message: Check-in notification for John Doe');
            
            // Test anomaly notification
            console.log('\n🔍 Testing anomaly notification...');
            const anomalyResult = await whatsappService.sendAnomalyNotification(
                testStudent.name,
                testStudent.parentWhatsapp,
                {
                    type: 'Test Anomaly',
                    severity: 'high',
                    timestamp: new Date(),
                    details: 'This is a test anomaly notification from the IoT Biometric System'
                }
            );

            if (anomalyResult.success) {
                console.log('✅ Anomaly notification sent successfully!');
                console.log(`   Message ID: ${anomalyResult.messageId}`);
            } else {
                console.log('❌ Anomaly notification failed:', anomalyResult.reason);
            }
            
        } else {
            console.log('❌ WhatsApp notification failed:', result.reason);
        }

    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
    }

    console.log('\n🏁 WhatsApp integration test completed');
    console.log('==========================================');
}

// Run the test
testWhatsAppIntegration()
    .then(() => {
        console.log('\n✅ Test script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Test script failed:', error);
        process.exit(1);
    });