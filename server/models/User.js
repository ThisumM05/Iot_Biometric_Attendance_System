import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    parentWhatsapp: {
        type: String,
        default: null,
        validate: {
            validator: function (v) {
                // Allow null or valid phone number format (basic validation)
                return v === null || v === '' || /^\+?[1-9]\d{1,14}$/.test(v.replace(/[\s-]/g, ''));
            },
            message: props => `${props.value} is not a valid phone number!`
        }
    },
    class: {
        type: String,
        default: null,
        trim: true
    },
    role: {
        type: String,
        enum: ['admin', 'employee', 'student'],
        default: 'student'
    },
    fingerprintId: {
        type: Number,
        unique: true,
        sparse: true // Allows multiple users to have null fingerprintId (not enrolled yet)
    },
    isEnrolled: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

export default mongoose.model('User', UserSchema);
