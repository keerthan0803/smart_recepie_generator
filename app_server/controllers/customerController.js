const Customer = require('../models/customer');
const ChatSession = require('../models/chatSession');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { sendMail } = require('../utils/mailer');

const APP_BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Create a new customer (Sign Up)
const createCustomer = async (req, res) => {
    try {
        const { firstName, lastName, email, password, skillLevel } = req.body;

        // Check if customer already exists
        const existingCustomer = await Customer.findByEmail(email);
        if (existingCustomer) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }

        // Hash password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create new customer
        const newCustomer = new Customer({
            firstName,
            lastName,
            email,
            password: hashedPassword,
            skillLevel: skillLevel || 'beginner'
        });

        // Generate email verification token
        const token = crypto.randomBytes(32).toString('hex');
        newCustomer.emailVerificationToken = token;
        // Token valid for 24 hours
        newCustomer.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await newCustomer.save();

        // Send verification email (non-blocking but await for better UX)
        const verifyLink = `${APP_BASE_URL}/api/customer/verify-email?token=${token}&email=${encodeURIComponent(newCustomer.email)}`;
        try {
            await sendMail({
                to: newCustomer.email,
                subject: 'Verify your email - Smart Recipe Generator',
                html: `
                    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:auto;line-height:1.6;">
                      <h2>Welcome, ${newCustomer.firstName}! 👋</h2>
                      <p>Thanks for signing up for Smart Recipe Generator. Please verify your email to activate your account.</p>
                      <p>
                        <a href="${verifyLink}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;">Verify Email</a>
                      </p>
                      <p>Or copy and paste this link into your browser:</p>
                      <p><a href="${verifyLink}">${verifyLink}</a></p>
                      <p style="color:#6b7280;font-size:12px;">This link expires in 24 hours.</p>
                    </div>
                `
            });
        } catch (mailErr) {
            console.error('Failed to send verification email:', mailErr.message);
        }

        res.status(201).json({
            success: true,
            message: 'Customer created successfully. Please verify your email to sign in.',
            customer: {
                id: newCustomer._id,
                firstName: newCustomer.firstName,
                lastName: newCustomer.lastName,
                email: newCustomer.email,
                skillLevel: newCustomer.skillLevel,
                isEmailVerified: newCustomer.isEmailVerified
            }
        });
    } catch (error) {
        console.error('Error creating customer:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating customer',
            error: error.message
        });
    }
};

// Customer login
const loginCustomer = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find customer by email
        const customer = await Customer.findByEmail(email);
        if (!customer) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, customer.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Enforce email verification
        if (!customer.isEmailVerified) {
            return res.status(403).json({
                success: false,
                message: 'Please verify your email before signing in.'
            });
        }

        // Initialize credits for legacy users
        if (customer.credits == null) {
            customer.credits = 10;
            await customer.save();
        }

        // Update last login
        await customer.updateLastLogin();

        res.status(200).json({
            success: true,
            message: 'Login successful',
            customer: {
                id: customer._id,
                firstName: customer.firstName,
                lastName: customer.lastName,
                email: customer.email,
                skillLevel: customer.skillLevel,
                credits: customer.credits || 0
            }
        });
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({
            success: false,
            message: 'Error logging in',
            error: error.message
        });
    }
};

// Get customer profile
const getCustomerProfile = async (req, res) => {
    try {
        const { customerId } = req.params;

        const customer = await Customer.findById(customerId)
            .select('-password')
            .populate('savedRecipes')
            .populate('favoriteRecipes');

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        res.status(200).json({
            success: true,
            customer
        });
    } catch (error) {
        console.error('Error fetching customer profile:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching customer profile',
            error: error.message
        });
    }
};

// Create a new chat session
const createChatSession = async (req, res) => {
    try {
        const { customerId } = req.params;

        // Verify customer exists
        const customer = await Customer.findById(customerId);
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        // Create new chat session document
        const newSession = new ChatSession({
            customerId,
            sessionId: new Date().getTime().toString() + Math.random().toString(36).substr(2, 9),
            title: 'New Chat',
            keywords: [],
            foodNames: [],
            messages: []
        });

        await newSession.save();

        res.status(201).json({
            success: true,
            message: 'Chat session created successfully',
            sessionId: newSession.sessionId
        });
    } catch (error) {
        console.error('Error creating chat session:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating chat session',
            error: error.message
        });
    }
};

// Get all chat sessions for a customer
const getChatSessions = async (req, res) => {
    try {
        const { customerId } = req.params;
        const limit = parseInt(req.query.limit) || 50;

        // Verify customer exists
        const customer = await Customer.findById(customerId);
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        // Find all sessions for this customer
        const sessions = await ChatSession.findByCustomer(customerId, limit);

        // Format sessions for response
        const formattedSessions = sessions.map(session => ({
            sessionId: session.sessionId,
            title: session.title,
            keywords: session.keywords,
            foodNames: session.foodNames,
            messageCount: session.messageCount,
            createdAt: session.createdAt,
            lastMessageAt: session.lastMessageAt,
            preview: session.messages.length > 0 
                ? session.messages[session.messages.length - 1].message.substring(0, 100)
                : ''
        }));

        res.status(200).json({
            success: true,
            sessions: formattedSessions
        });
    } catch (error) {
        console.error('Error fetching chat sessions:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching chat sessions',
            error: error.message
        });
    }
};

// Add message to chat session
const addMessageToSession = async (req, res) => {
    try {
        const { customerId, sessionId } = req.params;
        const { message, sender, recipeGenerated, recipeId } = req.body;

        // Verify customer exists
        const customer = await Customer.findById(customerId);
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        // Find the chat session
        const session = await ChatSession.findOne({ sessionId, customerId });
        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Chat session not found'
            });
        }

        // Add message to session
        await session.addMessage(message, sender, recipeGenerated, recipeId);

        res.status(200).json({
            success: true,
            message: 'Message added to session successfully'
        });
    } catch (error) {
        console.error('Error adding message to session:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error adding message to session',
            error: error.message
        });
    }
};

// Get messages from a specific session
const getSessionMessages = async (req, res) => {
    try {
        const { customerId, sessionId } = req.params;
        const limit = parseInt(req.query.limit) || 100;
        const skip = parseInt(req.query.skip) || 0;

        // Verify customer exists
        const customer = await Customer.findById(customerId);
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        // Find the chat session
        const session = await ChatSession.findOne({ sessionId, customerId });
        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Chat session not found'
            });
        }

        // Get messages with pagination
        const messages = session.messages
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(skip, skip + limit);

        res.status(200).json({
            success: true,
            messages
        });
    } catch (error) {
        console.error('Error fetching session messages:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error fetching session messages',
            error: error.message
        });
    }
};

// Update session title
const updateSessionTitle = async (req, res) => {
    try {
        const { customerId, sessionId } = req.params;
        const { title } = req.body;

        // Verify customer exists
        const customer = await Customer.findById(customerId);
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        // Find and update the session
        const session = await ChatSession.findOne({ sessionId, customerId });
        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Chat session not found'
            });
        }

        session.title = title;
        await session.save();

        res.status(200).json({
            success: true,
            message: 'Session title updated successfully'
        });
    } catch (error) {
        console.error('Error updating session title:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error updating session title',
            error: error.message
        });
    }
};

// Delete chat session
const deleteChatSession = async (req, res) => {
    try {
        const { customerId, sessionId } = req.params;

        // Verify customer exists
        const customer = await Customer.findById(customerId);
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        // Find and delete the session
        const result = await ChatSession.findOneAndDelete({ sessionId, customerId });
        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Chat session not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Chat session deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting chat session:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error deleting chat session',
            error: error.message
        });
    }
};

// Search chat sessions by keywords or food names
const searchChatSessions = async (req, res) => {
    try {
        const { customerId } = req.params;
        const { query } = req.query;

        if (!query) {
            return res.status(400).json({
                success: false,
                message: 'Search query is required'
            });
        }

        // Verify customer exists
        const customer = await Customer.findById(customerId);
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        // Search sessions
        const sessions = await ChatSession.searchSessions(customerId, query);

        // Format sessions for response
        const formattedSessions = sessions.map(session => ({
            sessionId: session.sessionId,
            title: session.title,
            keywords: session.keywords,
            foodNames: session.foodNames,
            messageCount: session.messageCount,
            createdAt: session.createdAt,
            lastMessageAt: session.lastMessageAt,
            preview: session.messages.length > 0 
                ? session.messages[session.messages.length - 1].message.substring(0, 100)
                : ''
        }));

        res.status(200).json({
            success: true,
            sessions: formattedSessions
        });
    } catch (error) {
        console.error('Error searching chat sessions:', error);
        res.status(500).json({
            success: false,
            message: 'Error searching chat sessions',
            error: error.message
        });
    }
};

// Add chat message (legacy - for backward compatibility)
const addChatMessage = async (req, res) => {
    try {
        const { customerId } = req.params;
        const { message, sender, recipeGenerated, recipeId } = req.body;

        const customer = await Customer.findById(customerId);
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        await customer.addChatMessage(message, sender, recipeGenerated, recipeId);

        res.status(200).json({
            success: true,
            message: 'Chat message added successfully'
        });
    } catch (error) {
        console.error('Error adding chat message:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding chat message',
            error: error.message
        });
    }
};

// Get chat history (legacy - for backward compatibility)
const getChatHistory = async (req, res) => {
    try {
        const { customerId } = req.params;
        const limit = parseInt(req.query.limit) || 50;

        const customer = await Customer.findById(customerId);
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        const chatHistory = customer.getRecentChats(limit);

        res.status(200).json({
            success: true,
            chatHistory
        });
    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching chat history',
            error: error.message
        });
    }
};

// Update customer profile
const updateCustomerProfile = async (req, res) => {
    try {
        const { customerId } = req.params;
        const updates = req.body;

        // Don't allow password update through this endpoint
        delete updates.password;
        delete updates.email;

        const customer = await Customer.findByIdAndUpdate(
            customerId,
            { $set: updates },
            { new: true, runValidators: true }
        ).select('-password');

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            customer
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating profile',
            error: error.message
        });
    }
};

// Verify email using token
const verifyEmail = async (req, res) => {
    try {
        const { token, email } = req.query;
        if (!token || !email) {
            return res.status(400).render('verify_email', { title: 'Email Verification', success: false, message: 'Invalid verification link' });
        }

        const customer = await Customer.findOne({ email: email.toLowerCase(), emailVerificationToken: token });
        if (!customer) {
            return res.status(400).render('verify_email', { title: 'Email Verification', success: false, message: 'Invalid or already used verification link' });
        }

        if (customer.emailVerificationExpires && customer.emailVerificationExpires < new Date()) {
            return res.status(400).render('verify_email', { title: 'Email Verification', success: false, message: 'Verification link has expired. Please request a new one.' });
        }

        customer.isEmailVerified = true;
        customer.emailVerificationToken = null;
        customer.emailVerificationExpires = null;
        await customer.save();

        return res.status(200).render('verify_email', { title: 'Email Verification', success: true, message: 'Your email has been verified. You can now sign in.' });
    } catch (error) {
        console.error('Error verifying email:', error);
        return res.status(500).render('verify_email', { title: 'Email Verification', success: false, message: 'Server error verifying email' });
    }
};

// Resend verification email
const resendVerificationEmail = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }

        const customer = await Customer.findByEmail(email);
        if (!customer) {
            return res.status(404).json({ success: false, message: 'Account not found' });
        }

        if (customer.isEmailVerified) {
            return res.status(200).json({ success: true, message: 'Email already verified' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        customer.emailVerificationToken = token;
        customer.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await customer.save();

        const verifyLink = `${APP_BASE_URL}/api/customer/verify-email?token=${token}&email=${encodeURIComponent(customer.email)}`;
        await sendMail({
            to: customer.email,
            subject: 'Verify your email - Smart Recipe Generator',
            html: `
                <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:auto;line-height:1.6;">
                  <h2>Hello, ${customer.firstName}!</h2>
                  <p>Click the button below to verify your email address.</p>
                  <p>
                    <a href="${verifyLink}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;">Verify Email</a>
                  </p>
                  <p>Or copy and paste this link into your browser:</p>
                  <p><a href="${verifyLink}">${verifyLink}</a></p>
                </div>
            `
        });

                return res.status(200).json({ success: true, message: 'Verification email sent' });
    } catch (error) {
                console.error('Error resending verification email:', error);
                // Surface a clearer message for Gmail auth issues
                const msg = error && error.response && error.response.includes('530')
                    ? 'Email provider rejected authentication. For Gmail, use an App Password (no spaces) and enable 2‑Step Verification.'
                    : (error.message || 'Error sending verification email');
                return res.status(500).json({ success: false, message: msg });
    }
};

module.exports = {
    createCustomer,
    loginCustomer,
    getCustomerProfile,
    createChatSession,
    getChatSessions,
    addMessageToSession,
    getSessionMessages,
    updateSessionTitle,
    deleteChatSession,
    searchChatSessions,
    addChatMessage,
    getChatHistory,
    updateCustomerProfile,
    verifyEmail,
    resendVerificationEmail
};
