import mongoose from 'mongoose';
import dotenv from 'dotenv';
import RawEvent from '../models/RawEvent.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from the parent directory (server root)
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const verify = async () => {
    try {
        console.log('URI:', process.env.MONGODB_URI ? 'Defined' : 'Undefined');
        await mongoose.connect(process.env.MONGODB_URI);

        console.log('Connected to DB');

        const count = await RawEvent.countDocuments();
        console.log('Total Events:', count);

        const events = await RawEvent.find({});
        console.log('Events:', JSON.stringify(events, null, 2));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
};

verify();
