const express = require('express');
const router = express.Router();

// Import handlers
const { handleGHLSignup } = require('./ghl-signup');
const { handleVapiWebhook } = require('./webhooks');  // ← FIXED: lowercase 'api'
const { handleStripeWebhook } = require('./routes/stripe-webhook');
const { handleGHLPaymentWebhook } = require('./routes/ghl-payment-webhook');
const { 
  createCheckoutSession, 
  createPortalSession,
  getSubscriptionStatus 
} = require('./routes/billing');

// ============================================
// WEBHOOK ENDPOINTS
// ============================================

// GHL Form Signup - Creates client + VAPI assistant
router.post('/webhooks/ghl-signup', handleGHLSignup);

// GHL Payment Webhook - Creates Stripe customer (called after ghl-signup)
router.post('/webhooks/ghl-payment', handleGHLPaymentWebhook);

// VAPI Call Completion - Saves call data + tracks usage
router.post('/vapi/webhook', handleVapiWebhook);  // ← FIXED: lowercase 'api'

// Stripe Webhook - Handles subscription events
router.post('/webhooks/stripe', express.raw({ type: 'application/json' }), handleStripeWebhook);

// ============================================
// BILLING ENDPOINTS
// ============================================

// Create checkout session (upgrade flow)
router.post('/billing/checkout', createCheckoutSession);

// Create customer portal session (manage subscription)
router.post('/billing/portal', createPortalSession);

// Get subscription status
router.get('/billing/status/:client_id', getSubscriptionStatus);

// ============================================
// HEALTH CHECK
// ============================================

router.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

module.exports = router;