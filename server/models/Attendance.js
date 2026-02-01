import mongoose from 'mongoose';

const AttendanceSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    fingerprintId: {
        type: Number,
        required: true
    },
    deviceId: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    type: {
        type: String,
        enum: ['CHECK_IN', 'CHECK_OUT', 'UNKNOWN'],
        default: 'CHECK_IN'
    }
});

export default mongoose.model('Attendance', AttendanceSchema);
