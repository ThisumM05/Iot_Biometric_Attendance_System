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
    // Global fingerprint ID (unique across all system)
    globalFingerprintId: {
        type: Number,
        unique: true,
        sparse: true
    },

    // Stored fingerprint template (base64 or binary)
    fingerprintTemplate: {
        type: String, // Base64 encoded template data
        default: null
    },

    // Template metadata
    templateMetadata: {
        quality: { type: Number, default: 0 },
        templateSize: { type: Number, default: 0 },
        enrollmentDevice: { type: String, default: null }, // MAC of device used for enrollment
        templateFormat: { type: String, default: 'R308' }, // Sensor type/format
        createdAt: { type: Date, default: null }
    },

    isEnrolled: {
        type: Boolean,
        default: false
    },

    // Legacy field for backward compatibility
    fingerprintId: {
        type: Number,
        sparse: true
    },

    // Device synchronization tracking
    syncedDevices: [{
        deviceMAC: { type: String, required: true },
        scannerID: { type: String, required: true },
        localFingerprintId: { type: Number, required: true }, // Local ID on that device
        clusterID: { type: String, required: true },
        syncedAt: { type: Date, default: Date.now },
        syncStatus: {
            type: String,
            enum: ['pending', 'synced', 'failed', 'outdated'],
            default: 'pending'
        }
    }],

    // Legacy enrollments array - kept for backward compatibility
    enrollments: [{
        scannerID: {
            type: String,
            required: true
        },
        deviceMAC: {
            type: String,
            required: true
        },
        fingerprintId: {
            type: Number,
            required: true
        },
        clusterID: {
            type: String,
            default: null
        },
        enrolledAt: {
            type: Date,
            default: Date.now
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

export default mongoose.model('User', UserSchema);
