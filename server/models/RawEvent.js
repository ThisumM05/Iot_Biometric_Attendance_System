import mongoose from 'mongoose';

const RawEventSchema = new mongoose.Schema({
    topic: {
        type: String,
        required: true,
        index: true
    },
    payload: {
        type: mongoose.Schema.Types.Mixed, // Stores any JSON/structure
        default: {}
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
});

export default mongoose.model('RawEvent', RawEventSchema);
