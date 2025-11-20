const axios = require('axios');
const crypto = require('crypto');

/**
 * PhonePe Payment Gateway Service
 * Supports both Sandbox (preprod) and Production environments
 * Documentation: https://developer.phonepe.com/
 */

class PhonePeService {
  constructor() {
    this.merchantId = process.env.PHONEPE_MERCHANT_ID;
    this.saltKey = process.env.PHONEPE_SALT_KEY;
    this.saltIndex = process.env.PHONEPE_SALT_INDEX || '1';
    this.env = process.env.PHONEPE_ENV || 'sandbox';
    
    // Determine API endpoints based on environment
    this.apiEndpoint = this.env === 'production'
      ? 'https://api.phonepe.com/apis/hermes'
      : 'https://api-preprod.phonepe.com/apis/pg-sandbox';
  }

  /**
   * Check if PhonePe is configured
   */
  isConfigured() {
    return !!(this.merchantId && this.saltKey);
  }

  /**
   * Generate X-VERIFY header for PhonePe API requests
   * Format: SHA256(base64Body + apiEndpoint + saltKey) + ### + saltIndex
   */
  generateXVerify(base64Body, endpoint) {
    const stringToHash = base64Body + endpoint + this.saltKey;
    const sha256Hash = crypto.createHash('sha256').update(stringToHash).digest('hex');
    return `${sha256Hash}###${this.saltIndex}`;
  }

  /**
   * Verify webhook signature from PhonePe
   */
  verifyWebhookSignature(base64Body, receivedSignature) {
    const endpoint = '/pg/v1/notify';
    const expectedSignature = this.generateXVerify(base64Body, endpoint);
    return expectedSignature === receivedSignature;
  }

  /**
   * Create a payment request (Standard Checkout)
   * @param {Object} paymentData - Payment details
   * @param {string} paymentData.transactionId - Unique transaction ID
   * @param {number} paymentData.amount - Amount in rupees (will be converted to paise)
   * @param {string} paymentData.userId - User/Customer ID
   * @param {string} paymentData.userName - User name
   * @param {string} paymentData.userPhone - User phone number (optional)
   * @param {string} paymentData.userEmail - User email (optional)
   * @returns {Promise<Object>} Payment response with redirect URL
   */
  async createPayment(paymentData) {
    if (!this.isConfigured()) {
      throw new Error('PhonePe is not configured. Please check environment variables.');
    }

    const {
      transactionId,
      amount,
      userId,
      userName,
      userPhone,
      userEmail
    } = paymentData;

    // Amount in paise (₹1 = 100 paise)
    const amountInPaise = Math.round(amount * 100);

    // Base URL for callbacks
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

    // Build payment request payload
    const payload = {
      merchantId: this.merchantId,
      merchantTransactionId: transactionId,
      merchantUserId: userId,
      amount: amountInPaise,
      redirectUrl: `${baseUrl}/api/phonepe/callback`,
      redirectMode: 'REDIRECT',
      callbackUrl: `${baseUrl}/api/phonepe/webhook`,
      mobileNumber: userPhone || undefined,
      paymentInstrument: {
        type: 'PAY_PAGE'
      }
    };

    // Convert payload to base64
    const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');

    // Generate X-VERIFY header
    const endpoint = '/pg/v1/pay';
    const xVerify = this.generateXVerify(base64Payload, endpoint);

    try {
      const response = await axios.post(
        `${this.apiEndpoint}${endpoint}`,
        {
          request: base64Payload
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-VERIFY': xVerify
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('PhonePe create payment error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to create PhonePe payment');
    }
  }

  /**
   * Check payment status
   * @param {string} transactionId - Merchant transaction ID
   * @returns {Promise<Object>} Payment status
   */
  async checkPaymentStatus(transactionId) {
    if (!this.isConfigured()) {
      throw new Error('PhonePe is not configured');
    }

    const endpoint = `/pg/v1/status/${this.merchantId}/${transactionId}`;
    
    // For status check, X-VERIFY = SHA256(endpoint + saltKey) + ### + saltIndex
    const stringToHash = endpoint + this.saltKey;
    const sha256Hash = crypto.createHash('sha256').update(stringToHash).digest('hex');
    const xVerify = `${sha256Hash}###${this.saltIndex}`;

    try {
      const response = await axios.get(
        `${this.apiEndpoint}${endpoint}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-VERIFY': xVerify
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('PhonePe status check error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to check payment status');
    }
  }

  /**
   * Parse and decode PhonePe webhook/callback data
   * @param {string} base64Response - Base64 encoded response
   * @returns {Object} Decoded response object
   */
  decodeResponse(base64Response) {
    try {
      const decodedString = Buffer.from(base64Response, 'base64').toString('utf-8');
      return JSON.parse(decodedString);
    } catch (error) {
      console.error('Failed to decode PhonePe response:', error.message);
      throw new Error('Invalid response format');
    }
  }

  /**
   * Get price for credit pack (in INR)
   */
  getPriceForCredits(credits) {
    const prices = {
      20: parseInt(process.env.PHONEPE_PRICE_20 || '99', 10),
      60: parseInt(process.env.PHONEPE_PRICE_60 || '249', 10),
      150: parseInt(process.env.PHONEPE_PRICE_150 || '499', 10)
    };
    return prices[credits] || null;
  }
}

// Export singleton instance
module.exports = new PhonePeService();
