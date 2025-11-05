document.addEventListener('DOMContentLoaded', () => {
  const customerId = localStorage.getItem('customerId');
  if (!customerId) {
    alert('Please sign in to buy credits.');
    window.location.href = '/signin';
    return;
  }

  // If returning from Stripe success, sync latest credits
  (async function handleStripeReturn() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('status') === 'success') {
      try {
        const res = await fetch(`/api/customer/${customerId}`);
        const json = await res.json();
        if (res.ok && json.success) {
          const credits = (json.customer && json.customer.credits) || 0;
          localStorage.setItem('customerCredits', String(credits));
          alert(`Payment successful! Your balance is now ${credits} credits.`);
          // Clean the URL
          const url = new URL(window.location.href);
          url.searchParams.delete('status');
          window.history.replaceState({}, '', url.toString());
        }
      } catch (e) {
        console.warn('Could not refresh credits after payment.');
      }
    }
  })();

  async function buy(amount) {
    try {
      // Try Stripe Checkout first
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
          return;
        }
      }

      // Fallback to mock purchase endpoint if Stripe isn't configured
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
      } else {
        alert(json.message || 'Purchase failed');
      }
    } catch (e) {
      console.error(e);
      alert('Network error while purchasing credits.');
    }
  }

  document.getElementById('buy20').addEventListener('click', () => buy(20));
  document.getElementById('buy60').addEventListener('click', () => buy(60));
  document.getElementById('buy150').addEventListener('click', () => buy(150));
});
