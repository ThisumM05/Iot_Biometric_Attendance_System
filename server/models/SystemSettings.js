import mongoose from 'mongoose';

const SystemSettingsSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true
    },
    value: {
        type: mongoose.Schema.Types.Mixed, // Can be string, number, object
        required: true
    },
    description: {
        type: String
    }
});

export default mongoose.model('SystemSettings', SystemSettingsSchema);
