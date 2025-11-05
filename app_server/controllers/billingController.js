const Customer = require('../models/customer');

// Lazy-init Stripe only when configured
let stripe = null;
function getStripe() {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return null;
    // eslint-disable-next-line global-require
    stripe = require('stripe')(key);
  }
  return stripe;
}

const APP_BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Map credits to Stripe Price IDs via env
function getPriceIdForCredits(credits) {
  const map = {
    20: process.env.STRIPE_PRICE_20,
    60: process.env.STRIPE_PRICE_60,
    150: process.env.STRIPE_PRICE_150
  };
  return map[credits];
}

// POST /api/billing/create-checkout-session
async function createCheckoutSession(req, res) {
  try {
    const stripeClient = getStripe();
    if (!stripeClient) {
      return res.status(501).json({ success: false, code: 'STRIPE_NOT_CONFIGURED', message: 'Stripe is not configured on the server' });
    }

    const { customerId, credits } = req.body;
    const allowed = [20, 60, 150];
    if (!customerId || !allowed.includes(Number(credits))) {
      return res.status(400).json({ success: false, message: 'Invalid request' });
    }

    // Ensure customer exists
    const customer = await Customer.findById(customerId).select('_id email');
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const priceId = getPriceIdForCredits(Number(credits));
    if (!priceId) {
      return res.status(501).json({ success: false, code: 'PRICE_NOT_CONFIGURED', message: 'Stripe price ID not configured for this pack' });
    }

    const session = await stripeClient.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${APP_BASE_URL}/buy-credits?status=success`,
      cancel_url: `${APP_BASE_URL}/buy-credits?status=cancel`,
      metadata: {
        customerId: customerId.toString(),
        credits: String(credits)
      }
    });

    return res.status(200).json({ success: true, url: session.url });
  } catch (err) {
    console.error('Stripe create session error:', err.message);
    return res.status(500).json({ success: false, message: 'Failed to create checkout session' });
  }
}

// POST /api/billing/webhooks/stripe (mounted with express.raw in app.js)
async function stripeWebhook(req, res) {
  try {
    const stripeClient = getStripe();
    if (!stripeClient) return res.status(501).send('Stripe not configured');

    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event;

    try {
      event = stripeClient.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error('Stripe webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.payment_status === 'paid') {
        const customerId = session.metadata?.customerId;
        const credits = parseInt(session.metadata?.credits || '0', 10) || 0;
        if (customerId && credits > 0) {
          try {
            const customer = await Customer.findById(customerId);
            if (customer) {
              await customer.addCredits(credits);
              console.log(`Credits added: +${credits} to customer ${customerId}`);
            } else {
              console.warn('Customer not found during webhook credit grant');
            }
          } catch (e) {
            console.error('Error granting credits from webhook:', e.message);
          }
        }
      }
    }

    res.status(200).send('ok');
  } catch (err) {
    console.error('Stripe webhook handler error:', err.message);
    res.status(500).send('server error');
  }
}

module.exports = {
  createCheckoutSession,
  stripeWebhook
};
