import mongoose from 'mongoose';

const DailyAttendanceSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    date: {
        type: String, // YYYY-MM-DD format for easy querying
        required: true,
        index: true
    },
    clockIn: {
        type: Date,
        required: true
    },
    clockOut: {
        type: Date
    },
    duration: {
        type: Number, // In minutes
        default: 0
    },
    status: {
        type: String,
        enum: ['PRESENT', 'LATE', 'ABSENT', 'LEFT_EARLY'],
        default: 'PRESENT'
    },
    events: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Attendance' // Reference to raw logs for audit trail
    }]
}, { timestamps: true });

// Compound index to ensure one record per user per day
DailyAttendanceSchema.index({ user: 1, date: 1 }, { unique: true });

export default mongoose.model('DailyAttendance', DailyAttendanceSchema);
