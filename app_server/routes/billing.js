const express = require('express');
const router = express.Router();
const billing = require('../controllers/billingController');

// Create Stripe Checkout Session
router.post('/create-checkout-session', billing.createCheckoutSession);

module.exports = router;
