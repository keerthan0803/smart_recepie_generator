const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const passport = require('../config/passport');

// Customer registration (Sign Up)
router.post('/signup', customerController.createCustomer);

// Customer login (Sign In)
router.post('/login', customerController.loginCustomer);

// Email verification (place BEFORE parameterized routes)
router.get('/verify-email', customerController.verifyEmail);
router.post('/resend-verification', customerController.resendVerificationEmail);

// Forgot Password & Reset Password
router.post('/forgot-password', customerController.forgotPassword);
router.post('/reset-password', customerController.resetPassword);

// Google OAuth Routes
router.get('/auth/google', passport.authenticate('google', { 
    scope: ['profile', 'email'] 
}));

router.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/signin' }),
    customerController.googleAuthCallback
);

// Get customer profile
router.get('/:customerId', customerController.getCustomerProfile);

// Check profile completion
router.get('/:customerId/profile/check', customerController.checkProfileCompletion);

// Update customer profile
router.put('/:customerId', customerController.updateCustomerProfile);

// Chat Session Routes
// Create new chat session
router.post('/:customerId/sessions', customerController.createChatSession);

// Get all chat sessions
router.get('/:customerId/sessions', customerController.getChatSessions);

// Search chat sessions
router.get('/:customerId/sessions/search', customerController.searchChatSessions);

// Add message to specific session
router.post('/:customerId/sessions/:sessionId/messages', customerController.addMessageToSession);

// Get messages from specific session
router.get('/:customerId/sessions/:sessionId/messages', customerController.getSessionMessages);

// Update session title
router.put('/:customerId/sessions/:sessionId', customerController.updateSessionTitle);

// Delete chat session
router.delete('/:customerId/sessions/:sessionId', customerController.deleteChatSession);

// Legacy chat routes (for backward compatibility)
// Add chat message
router.post('/:customerId/chat', customerController.addChatMessage);

// Get chat history
router.get('/:customerId/chat', customerController.getChatHistory);

// Billing: buy credits
router.post('/buy-credits', async (req, res) => {
	try {
		const { customerId, amount } = req.body;
		if (!customerId || !amount || amount <= 0) {
			return res.status(400).json({ success: false, message: 'Invalid purchase request' });
		}
		const customer = await require('../models/customer').findById(customerId);
		if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
		await customer.addCredits(amount);
		return res.status(200).json({ success: true, credits: customer.credits });
	} catch (e) {
		console.error('Buy credits error:', e);
		return res.status(500).json({ success: false, message: 'Server error processing purchase' });
	}
});

module.exports = router;
