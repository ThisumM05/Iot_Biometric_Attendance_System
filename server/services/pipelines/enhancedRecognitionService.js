import recognitionService from './recognitionService.js';

class EnhancedRecognitionService {
    constructor() {
        // Extend the original recognition service
        this.originalService = recognitionService;
        
        // Override the processAttendance method with ML analytics
        this.originalProcessAttendance = recognitionService.processAttendance.bind(recognitionService);
        recognitionService.processAttendance = this.processAttendanceWithML.bind(this);
        
        console.log('Enhanced Recognition Service with ML Analytics initialized');
    }

    /**
     * Enhanced processAttendance with ML Analytics integration
     */
    async processAttendanceWithML(event) {
        try {
            // Call the original attendance processing
            await this.originalProcessAttendance(event);
            
            // Extract user info for ML processing
            const { payload, deviceId } = event;
            const fingerprintId = payload?.fingerprintId;
            
            if (!fingerprintId) return;
            
            // Find user for ML analytics
            const { default: User } = await import('../../models/User.js');
            const user = await User.findOne({ fingerprintId });
            
            if (!user) return;
            
            // Get latest attendance session
            const { default: DailyAttendance } = await import('../../models/DailyAttendance.js');
            const todayStr = new Date().toISOString().split('T')[0];
            const session = await DailyAttendance.findOne({
                user: user._id,
                date: todayStr
            });
            
            if (!session) return;
            
            // Process with ML Analytics (non-blocking)
            this.processMLAnalytics({
                user: user._id,
                username: user.username,
                fingerprintId,
                status: session.status,
                timestamp: new Date(),
                deviceId: deviceId || 'UNKNOWN',
                sessionData: session
            }).catch(error => {
                console.error('ML Analytics processing error:', error);
            });
            
        } catch (error) {
            console.error('Enhanced Recognition Service Error:', error);
            // Re-throw to maintain original error handling
            throw error;
        }
    }

    /**
     * Process attendance event with ML Analytics
     */
    async processMLAnalytics(attendanceData) {
        try {
            // Dynamic import to avoid circular dependencies
            const { default: mlAnalyticsService } = await import('../analytics-ml/mlAnalyticsService.js');
            
            console.log(`[ML Analytics] Processing attendance for user: ${attendanceData.username}`);
            
            // Process the attendance event with ML analytics
            const result = await mlAnalyticsService.processAttendanceEvent(attendanceData);
            
            if (result.success) {
                console.log(`[ML Analytics] Successfully processed for ${attendanceData.username}`);
                
                // Log any alerts generated
                if (result.alerts && result.alerts.length > 0) {
                    console.log(`[ML Analytics] Generated ${result.alerts.length} alerts for ${attendanceData.username}`);
                    result.alerts.forEach(alert => {
                        console.log(`  - ${alert.type}: ${alert.message} (${alert.severity})`);
                    });
                }
            }
            
        } catch (error) {
            // Fail silently to not break the main attendance flow
            console.error('ML Analytics processing failed:', error.message);
        }
    }
}

// Initialize the enhanced service
export default new EnhancedRecognitionService();