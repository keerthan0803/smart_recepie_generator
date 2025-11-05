// Test script to debug login issues
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

const Customer = require('./app_server/models/customer');

const mongoURI = process.env.MONGODB_URI || process.env.MONGODB_LOCAL || 'mongodb://localhost:27017/smart-recipe-generator';

async function testLogin() {
    try {
        // Connect to MongoDB
        await mongoose.connect(mongoURI);
        console.log('✓ Connected to MongoDB');

        // Test email (change this to your test email)
        const testEmail = 'test@example.com'; // CHANGE THIS
        
        // Find customer
        const customer = await Customer.findByEmail(testEmail);
        
        if (!customer) {
            console.log('✗ Customer not found with email:', testEmail);
            console.log('\nPlease sign up first or check the email address.');
            process.exit(1);
        }
        
        console.log('✓ Customer found:', customer.firstName, customer.lastName);
        console.log('  - Email:', customer.email);
        console.log('  - Email Verified:', customer.isEmailVerified);
        console.log('  - Credits:', customer.credits);
        console.log('  - Account Status:', customer.accountStatus);
        
        if (!customer.isEmailVerified) {
            console.log('\n⚠ Email not verified!');
            console.log('  This is likely the issue. Check your email for verification link.');
            console.log('  Token:', customer.emailVerificationToken ? 'Present' : 'None');
            console.log('  Expires:', customer.emailVerificationExpires);
        }
        
        // Test password (change this to your test password)
        const testPassword = 'YourPassword123'; // CHANGE THIS
        const isPasswordValid = await bcrypt.compare(testPassword, customer.password);
        
        if (isPasswordValid) {
            console.log('✓ Password is correct');
        } else {
            console.log('✗ Password is incorrect');
        }
        
        await mongoose.connection.close();
        console.log('\n✓ Test complete');
        
    } catch (error) {
        console.error('✗ Error:', error.message);
        await mongoose.connection.close();
        process.exit(1);
    }
}

testLogin();
