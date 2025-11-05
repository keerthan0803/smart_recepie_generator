// Test MongoDB connection with detailed diagnostics
const mongoose = require('mongoose');
require('dotenv').config();

const mongoURI = process.env.MONGODB_URI || process.env.MONGODB_LOCAL || 'mongodb://localhost:27017/smart-recipe-generator';

console.log('🔍 Testing MongoDB Connection...\n');
console.log('Connection String (sanitized):', mongoURI.replace(/:[^:@]+@/, ':****@'));
console.log('');

async function testConnection() {
    try {
        console.log('Attempting to connect...');
        
        // Test with explicit options
        await mongoose.connect(mongoURI, {
            serverSelectionTimeoutMS: 10000, // 10 second timeout
            socketTimeoutMS: 45000,
        });
        
        console.log('✅ Successfully connected to MongoDB!');
        console.log('   Database:', mongoose.connection.name);
        console.log('   Host:', mongoose.connection.host);
        console.log('   Port:', mongoose.connection.port);
        
        // Test a simple operation
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('\n📦 Collections in database:');
        if (collections.length === 0) {
            console.log('   (No collections yet - this is normal for a new database)');
        } else {
            collections.forEach(col => console.log('   -', col.name));
        }
        
        await mongoose.connection.close();
        console.log('\n✅ Connection test passed! Your database is ready.');
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ Connection failed!');
        console.error('\nError type:', error.name);
        console.error('Error message:', error.message);
        
        // Provide specific guidance based on error
        if (error.message.includes('IP') && error.message.includes('whitelist')) {
            console.log('\n💡 SOLUTION:');
            console.log('   1. Go to MongoDB Atlas: https://cloud.mongodb.com/');
            console.log('   2. Select your cluster');
            console.log('   3. Click "Network Access" in the left sidebar');
            console.log('   4. Click "Add IP Address"');
            console.log('   5. Click "Allow Access from Anywhere" (0.0.0.0/0)');
            console.log('   6. Click "Confirm"');
            console.log('   7. Wait 1-2 minutes for changes to apply');
            console.log('   8. Try again');
        } else if (error.message.includes('authentication failed')) {
            console.log('\n💡 SOLUTION:');
            console.log('   1. Check your MongoDB username and password');
            console.log('   2. Make sure special characters in password are URL-encoded');
            console.log('   3. Example: p@ssword should be p%40ssword');
        } else if (error.message.includes('ECONNREFUSED')) {
            console.log('\n💡 SOLUTION:');
            console.log('   Local MongoDB is not running. Either:');
            console.log('   1. Start local MongoDB: net start MongoDB (Windows)');
            console.log('   2. Or use MongoDB Atlas (cloud) instead');
        } else if (error.message.includes('SSL') || error.message.includes('TLS')) {
            console.log('\n💡 SOLUTION:');
            console.log('   SSL/TLS error. Try adding these to your connection string:');
            console.log('   ?retryWrites=true&w=majority&ssl=true');
        }
        
        console.log('\n📝 Your connection string should look like:');
        console.log('   mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority');
        
        process.exit(1);
    }
}

testConnection();
