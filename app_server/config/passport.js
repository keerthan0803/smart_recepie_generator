require('dotenv').config();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const Customer = require('../models/customer');

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await Customer.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

// Only configure Google OAuth if credentials are provided
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    // Google OAuth Strategy
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.BASE_URL}/api/customer/auth/google/callback`
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            // Check if user already exists
            let customer = await Customer.findOne({ email: profile.emails[0].value.toLowerCase() });

            if (customer) {
                // User exists, check if Google ID needs to be added
                if (!customer.googleId) {
                    customer.googleId = profile.id;
                    customer.isEmailVerified = true; // Google accounts are pre-verified
                    await customer.save();
                }
                return done(null, customer);
            }

            // Create new customer from Google profile
            const newCustomer = new Customer({
                googleId: profile.id,
                firstName: profile.name.givenName || profile.displayName.split(' ')[0],
                lastName: profile.name.familyName || profile.displayName.split(' ').slice(1).join(' ') || '',
                email: profile.emails[0].value.toLowerCase(),
                isEmailVerified: true, // Google emails are verified
                credits: 10, // Welcome credits
                skillLevel: 'beginner',
                // No password needed for OAuth users
                password: 'OAUTH_USER_' + Math.random().toString(36).substring(2, 15)
            });

            await newCustomer.save();
            return done(null, newCustomer);

        } catch (error) {
            console.error('Google OAuth Error:', error);
            return done(error, null);
        }
    }));
    
    console.log('✓ Google OAuth configured successfully');
} else {
    console.warn('⚠ Google OAuth credentials not found. Google Sign-In will be disabled.');
}

module.exports = passport;
