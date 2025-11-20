const express = require('express');
const router = express.Router();
const phonePeController = require('../controllers/phonePeController');

/**
 * PhonePe Payment Routes
 */

// Get PhonePe configuration and availability
router.get('/config', phonePeController.getConfig);

// Create a new payment transaction
router.post('/create-payment', phonePeController.createPayment);

// Callback endpoint (browser redirect after payment)
router.get('/callback', phonePeController.handleCallback);
router.post('/callback', phonePeController.handleCallback);

// Webhook endpoint (server-to-server notifications)
router.post('/webhook', phonePeController.handleWebhook);

// Manual status check
router.post('/check-status', phonePeController.checkPaymentStatus);

module.exports = router;
