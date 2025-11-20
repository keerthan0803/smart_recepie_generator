document.addEventListener('DOMContentLoaded', () => {
  const customerId = localStorage.getItem('customerId');
  if (!customerId) {
    alert('Please sign in to buy credits.');
    window.location.href = '/signin';
    return;
  }

  // If returning from payment success, sync latest credits
  (async function handlePaymentReturn() {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    const gateway = params.get('gateway');
    
    if (status === 'success') {
      try {
        const res = await fetch(`/api/customer/${customerId}`);
        const json = await res.json();
        if (res.ok && json.success) {
          const credits = (json.customer && json.customer.credits) || 0;
          localStorage.setItem('customerCredits', String(credits));
          const gatewayName = gateway === 'phonepe' ? 'PhonePe' : 'Stripe';
          alert(`Payment successful via ${gatewayName}! Your balance is now ${credits} credits.`);
          // Clean the URL
          const url = new URL(window.location.href);
          url.searchParams.delete('status');
          url.searchParams.delete('gateway');
          window.history.replaceState({}, '', url.toString());
        }
      } catch (e) {
        console.warn('Could not refresh credits after payment.');
      }
    } else if (status === 'pending') {
      alert('Payment is pending. Please wait for confirmation.');
    } else if (status === 'failed') {
      alert('Payment failed. Please try again.');
    }
  })();

  // Check available payment gateways
  let phonePeAvailable = false;
  let phonePePrices = {};

  (async function checkPaymentGateways() {
    try {
      const res = await fetch('/api/phonepe/config');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.available) {
          phonePeAvailable = true;
          phonePePrices = data.prices || {};
          console.log('PhonePe is available:', data);
        }
      }
    } catch (e) {
      console.log('PhonePe is not available');
    }
  })();

  async function buyWithStripe(amount) {
    try {
      const stripeRes = await fetch('/api/billing/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, credits: amount })
      });
      
      if (stripeRes.ok) {
        const stripeJson = await stripeRes.json();
        if (stripeJson.success && stripeJson.url) {
          // Redirect to Stripe-hosted checkout
          window.location.href = stripeJson.url;
          return true;
        }
      }
      return false;
    } catch (e) {
      console.error('Stripe error:', e);
      return false;
    }
  }

  async function buyWithPhonePe(amount) {
    try {
      const phonePeRes = await fetch('/api/phonepe/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, credits: amount })
      });
      
      if (phonePeRes.ok) {
        const phonePeJson = await phonePeRes.json();
        if (phonePeJson.success && phonePeJson.redirectUrl) {
          // Redirect to PhonePe payment page
          window.location.href = phonePeJson.redirectUrl;
          return true;
        }
      }
      return false;
    } catch (e) {
      console.error('PhonePe error:', e);
      return false;
    }
  }

  async function buyWithFallback(amount) {
    try {
      // Fallback to mock purchase endpoint if no payment gateway is configured
      const res = await fetch('/api/customer/buy-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, amount })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        localStorage.setItem('customerCredits', String(json.credits));
        alert(`Purchase successful! Your new balance is ${json.credits} credits.`);
        window.location.href = '/';
        return true;
      }
      return false;
    } catch (e) {
      console.error('Fallback error:', e);
      return false;
    }
  }

  async function buy(amount, preferredGateway = 'stripe') {
    try {
      // Try preferred gateway first
      if (preferredGateway === 'phonepe' && phonePeAvailable) {
        const success = await buyWithPhonePe(amount);
        if (success) return;
      }

      // Try Stripe
      const stripeSuccess = await buyWithStripe(amount);
      if (stripeSuccess) return;

      // Try PhonePe if not already tried
      if (preferredGateway !== 'phonepe' && phonePeAvailable) {
        const phonePeSuccess = await buyWithPhonePe(amount);
        if (phonePeSuccess) return;
      }

      // Fallback to mock purchase
      const fallbackSuccess = await buyWithFallback(amount);
      if (!fallbackSuccess) {
        alert('Purchase failed. Please try again later.');
      }
    } catch (e) {
      console.error(e);
      alert('Network error while purchasing credits.');
    }
  }

  // Add click handlers for buy buttons
  document.getElementById('buy20')?.addEventListener('click', () => buy(20));
  document.getElementById('buy60')?.addEventListener('click', () => buy(60));
  document.getElementById('buy150')?.addEventListener('click', () => buy(150));

  // Add handlers for PhonePe-specific buttons if they exist
  document.getElementById('buy20-phonepe')?.addEventListener('click', () => buy(20, 'phonepe'));
  document.getElementById('buy60-phonepe')?.addEventListener('click', () => buy(60, 'phonepe'));
  document.getElementById('buy150-phonepe')?.addEventListener('click', () => buy(150, 'phonepe'));
});
