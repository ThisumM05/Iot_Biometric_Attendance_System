const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes Placeholder
app.get('/', (req, res) => {
    res.send('IoT Biometric Attendance System Server is running');
});

// Database Connection Placeholder
const connectDB = async () => {
    try {
        // await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB connection placeholder');
    } catch (error) {
        console.log(error);
    }
}
connectDB();

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
