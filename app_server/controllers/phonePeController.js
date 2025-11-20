const Customer = require('../models/customer');
const phonePeService = require('../utils/phonePeService');
const crypto = require('crypto');

/**
 * PhonePe Payment Controller
 * Handles payment creation, callbacks, webhooks, and status checks
 */

/**
 * POST /api/phonepe/create-payment
 * Create a new PhonePe payment transaction
 */
async function createPayment(req, res) {
  try {
    // Check if PhonePe is configured
    if (!phonePeService.isConfigured()) {
      return res.status(501).json({
        success: false,
        code: 'PHONEPE_NOT_CONFIGURED',
        message: 'PhonePe payment gateway is not configured on the server'
      });
    }

    const { customerId, credits } = req.body;

    // Validate input
    const allowedCredits = [20, 60, 150];
    if (!customerId || !allowedCredits.includes(Number(credits))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request. Please provide valid customerId and credits (20, 60, or 150)'
      });
    }

    // Verify customer exists
    const customer = await Customer.findById(customerId).select('_id email name phoneNumber');
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Get price for the credit pack
    const amount = phonePeService.getPriceForCredits(Number(credits));
    if (!amount) {
      return res.status(400).json({
        success: false,
        message: 'Price not configured for this credit pack'
      });
    }

    // Generate unique transaction ID
    const transactionId = `TXN_${customerId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Prepare payment data
    const paymentData = {
      transactionId,
      amount,
      userId: customerId.toString(),
      userName: customer.name || 'Customer',
      userPhone: customer.phoneNumber,
      userEmail: customer.email
    };

    // Create payment with PhonePe
    const paymentResponse = await phonePeService.createPayment(paymentData);

    // Check if payment creation was successful
    if (paymentResponse.success && paymentResponse.data?.instrumentResponse?.redirectInfo?.url) {
      // Store transaction details in customer record for reference
      await Customer.findByIdAndUpdate(customerId, {
        $push: {
          pendingTransactions: {
            transactionId,
            credits: Number(credits),
            amount,
            status: 'PENDING',
            createdAt: new Date(),
            gateway: 'phonepe'
          }
        }
      });

      return res.status(200).json({
        success: true,
        transactionId,
        redirectUrl: paymentResponse.data.instrumentResponse.redirectInfo.url,
        message: 'Payment initiated successfully'
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Failed to create payment',
        details: paymentResponse.message || 'Unknown error'
      });
    }
  } catch (error) {
    console.error('PhonePe create payment error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to create payment',
      error: error.message
    });
  }
}

/**
 * GET /api/phonepe/callback
 * Handle redirect callback from PhonePe after payment
 * User is redirected here after completing/canceling payment
 */
async function handleCallback(req, res) {
  try {
    // PhonePe sends transaction status in query params or response body
    const transactionId = req.query.transactionId || req.body.transactionId;

    if (!transactionId) {
      return res.redirect('/buy-credits?status=error&message=Invalid callback');
    }

    // Always verify payment status server-side (don't trust query params)
    try {
      const statusResponse = await phonePeService.checkPaymentStatus(transactionId);

      if (statusResponse.success && statusResponse.code === 'PAYMENT_SUCCESS') {
        // Payment successful - redirect to success page
        return res.redirect('/buy-credits?status=success&gateway=phonepe');
      } else if (statusResponse.code === 'PAYMENT_PENDING') {
        // Payment pending
        return res.redirect('/buy-credits?status=pending&gateway=phonepe');
      } else {
        // Payment failed or other status
        return res.redirect('/buy-credits?status=failed&gateway=phonepe');
      }
    } catch (error) {
      console.error('Status check failed in callback:', error.message);
      return res.redirect('/buy-credits?status=error&message=Verification failed');
    }
  } catch (error) {
    console.error('PhonePe callback error:', error.message);
    return res.redirect('/buy-credits?status=error');
  }
}

/**
 * POST /api/phonepe/webhook
 * Handle server-to-server webhook notifications from PhonePe
 * This is where we actually process and credit the coins
 */
async function handleWebhook(req, res) {
  try {
    if (!phonePeService.isConfigured()) {
      return res.status(501).send('PhonePe not configured');
    }

    // PhonePe sends webhook data in base64 encoded format
    const base64Response = req.body.response;
    const xVerify = req.headers['x-verify'];

    if (!base64Response) {
      console.error('PhonePe webhook: Missing response data');
      return res.status(400).send('Invalid webhook data');
    }

    // Verify webhook signature
    if (xVerify) {
      const isValid = phonePeService.verifyWebhookSignature(base64Response, xVerify);
      if (!isValid) {
        console.error('PhonePe webhook: Invalid signature');
        return res.status(400).send('Invalid signature');
      }
    }

    // Decode the response
    const decodedData = phonePeService.decodeResponse(base64Response);
    console.log('PhonePe webhook received:', JSON.stringify(decodedData, null, 2));

    // Process the webhook based on transaction status
    if (decodedData.success && decodedData.code === 'PAYMENT_SUCCESS') {
      const transactionId = decodedData.data?.merchantTransactionId;
      const amount = decodedData.data?.amount; // in paise
      const userId = decodedData.data?.merchantUserId;

      if (!transactionId || !userId) {
        console.error('PhonePe webhook: Missing transaction data');
        return res.status(400).send('Missing transaction data');
      }

      // Find customer and their pending transaction
      const customer = await Customer.findById(userId);
      if (!customer) {
        console.error('PhonePe webhook: Customer not found', userId);
        return res.status(404).send('Customer not found');
      }

      // Find the pending transaction
      const pendingTxn = customer.pendingTransactions?.find(
        txn => txn.transactionId === transactionId && txn.status === 'PENDING'
      );

      if (!pendingTxn) {
        console.error('PhonePe webhook: Transaction not found or already processed', transactionId);
        // Return 200 to avoid retries for already processed transactions
        return res.status(200).send('Transaction already processed');
      }

      // Credit the coins to customer
      const creditsToAdd = pendingTxn.credits;
      await customer.addCredits(creditsToAdd);

      // Update transaction status
      await Customer.findOneAndUpdate(
        {
          _id: userId,
          'pendingTransactions.transactionId': transactionId
        },
        {
          $set: {
            'pendingTransactions.$.status': 'COMPLETED',
            'pendingTransactions.$.completedAt': new Date(),
            'pendingTransactions.$.phonePeTransactionId': decodedData.data.transactionId
          }
        }
      );

      console.log(`PhonePe: Credited ${creditsToAdd} credits to customer ${userId} for transaction ${transactionId}`);
      return res.status(200).send('OK');
    } else {
      // Payment failed or other status
      const transactionId = decodedData.data?.merchantTransactionId;
      const userId = decodedData.data?.merchantUserId;
      const status = decodedData.code || 'FAILED';

      if (transactionId && userId) {
        // Update transaction status to failed
        await Customer.findOneAndUpdate(
          {
            _id: userId,
            'pendingTransactions.transactionId': transactionId
          },
          {
            $set: {
              'pendingTransactions.$.status': status,
              'pendingTransactions.$.completedAt': new Date()
            }
          }
        );
      }

      console.log(`PhonePe webhook: Payment ${status} for transaction ${transactionId}`);
      return res.status(200).send('OK');
    }
  } catch (error) {
    console.error('PhonePe webhook handler error:', error.message);
    return res.status(500).send('Server error');
  }
}

/**
 * POST /api/phonepe/check-status
 * Manually check payment status (for frontend polling or verification)
 */
async function checkPaymentStatus(req, res) {
  try {
    if (!phonePeService.isConfigured()) {
      return res.status(501).json({
        success: false,
        code: 'PHONEPE_NOT_CONFIGURED',
        message: 'PhonePe is not configured'
      });
    }

    const { transactionId } = req.body;

    if (!transactionId) {
      return res.status(400).json({
        success: false,
        message: 'Transaction ID is required'
      });
    }

    // Check status with PhonePe
    const statusResponse = await phonePeService.checkPaymentStatus(transactionId);

    return res.status(200).json(statusResponse);
  } catch (error) {
    console.error('PhonePe status check error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to check payment status',
      error: error.message
    });
  }
}

/**
 * GET /api/phonepe/config
 * Check if PhonePe is available and configured
 */
function getConfig(req, res) {
  const isConfigured = phonePeService.isConfigured();
  const environment = process.env.PHONEPE_ENV || 'sandbox';

  return res.status(200).json({
    success: true,
    available: isConfigured,
    environment,
    supportedCredits: [20, 60, 150],
    prices: {
      20: phonePeService.getPriceForCredits(20),
      60: phonePeService.getPriceForCredits(60),
      150: phonePeService.getPriceForCredits(150)
    }
  });
}

module.exports = {
  createPayment,
  handleCallback,
  handleWebhook,
  checkPaymentStatus,
  getConfig
};
