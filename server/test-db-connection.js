import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('Testing MongoDB Connection...');
console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'Found in .env' : 'Missing from .env');

const testConnection = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            console.error('❌ MONGODB_URI not found in environment variables');
            process.exit(1);
        }

        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);

        console.log('✅ MongoDB Connected Successfully!');

        // Get database info
        const db = mongoose.connection.db;
        const dbName = db.databaseName;
        console.log(`📊 Database Name: ${dbName}`);

        // List all collections
        const collections = await db.listCollections().toArray();
        console.log(`📁 Total Collections: ${collections.length}`);

        if (collections.length > 0) {
            console.log('\n📋 Collections Found:');
            for (let i = 0; i < collections.length; i++) {
                const collection = collections[i];
                console.log(`   ${i + 1}. ${collection.name}`);

                // Get document count for each collection
                const count = await db.collection(collection.name).countDocuments();
                console.log(`      📄 Documents: ${count}`);
            }
        } else {
            console.log('📭 No collections found in the database');
        }

        // Test connection quality
        const stats = await db.stats();
        console.log(`\n💾 Database Size: ${(stats.dataSize / 1024 / 1024).toFixed(2)} MB`);

    } catch (error) {
        console.error('❌ MongoDB Connection Error:');
        console.error('   Error Type:', error.name);
        console.error('   Error Message:', error.message);

        if (error.message.includes('authentication failed')) {
            console.error('\n🔐 Authentication Help:');
            console.error('   - Check username and password in MONGODB_URI');
            console.error('   - Verify database user permissions');
        }

        if (error.message.includes('network')) {
            console.error('\n🌐 Network Help:');
            console.error('   - Check internet connection');
            console.error('   - Verify MongoDB Atlas firewall settings');
            console.error('   - Ensure your IP is whitelisted');
        }

    } finally {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
            console.log('\n🔌 Connection closed');
        }
        process.exit(0);
    }
};

testConnection();