// Script to manually verify an email (for testing purposes)
const mongoose = require('mongoose');
require('dotenv').config();

const Customer = require('./app_server/models/customer');

const mongoURI = process.env.MONGODB_URI || process.env.MONGODB_LOCAL || 'mongodb://localhost:27017/smart-recipe-generator';

async function verifyEmail() {
    try {
        const args = process.argv.slice(2);
        if (args.length === 0) {
            console.log('Usage: node verify-email-manually.js <email>');
            console.log('Example: node verify-email-manually.js test@example.com');
            process.exit(1);
        }

        const email = args[0];
        
        await mongoose.connect(mongoURI);
        console.log('Connected to MongoDB');

        const customer = await Customer.findByEmail(email);
        
        if (!customer) {
            console.log('✗ Customer not found with email:', email);
            process.exit(1);
        }

        if (customer.isEmailVerified) {
            console.log('✓ Email is already verified for:', customer.firstName, customer.lastName);
        } else {
            customer.isEmailVerified = true;
            customer.emailVerificationToken = null;
            customer.emailVerificationExpires = null;
            await customer.save();
            console.log('✓ Email verified successfully for:', customer.firstName, customer.lastName);
            console.log('  You can now log in at http://localhost:3000/sign_in');
        }

        await mongoose.connection.close();
        
    } catch (error) {
        console.error('✗ Error:', error.message);
        await mongoose.connection.close();
        process.exit(1);
    }
}

verifyEmail();
