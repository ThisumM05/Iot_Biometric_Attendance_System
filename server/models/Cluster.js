import mongoose from 'mongoose';

const clusterSchema = new mongoose.Schema({
    clusterID: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    clusterName: {
        type: String,
        required: true,
        trim: true
    },
    location: {
        type: String,
        default: '',
        trim: true
    },
    devices: [{
        deviceMAC: {
            type: String,
            required: true
        },
        role: {
            type: String,
            enum: ['ENTRY', 'EXIT'],
            required: true
        },
        scannerID: {
            type: String,
            required: true
        }
    }],
    doorControlDevice: {
        type: String, // MAC address of device with relay
        default: null
    },
    status: {
        type: String,
        enum: ['OPERATIONAL', 'DEGRADED', 'OFFLINE', 'MAINTENANCE'],
        default: 'OPERATIONAL'
    },
    unlockDuration: {
        type: Number,
        default: 5000 // Default 5 seconds
    },
    doorLockState: {
        type: String,
        enum: ['LOCKED', 'UNLOCKED', 'UNKNOWN'],
        default: 'UNKNOWN'
    },
    enabled: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Index for faster queries
clusterSchema.index({ status: 1 });
clusterSchema.index({ location: 1 });

// Method to get all device MACs in cluster
clusterSchema.methods.getDeviceMACs = function () {
    return this.devices.map(d => d.deviceMAC);
};

// Method to find device by role
clusterSchema.methods.getDeviceByRole = function (role) {
    return this.devices.find(d => d.role === role);
};

export default mongoose.model('Cluster', clusterSchema);
