const express = require('express');
const router = express.Router();

// Import handlers
const { handleGHLSignup } = require('./ghl-signup');
const { handleNativeSignup } = require('./native-signup'); // NEW: Native form handler
const { handleVapiWebhook } = require('./webhooks');
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

// NEW: Native Form Signup - Direct from callbirdai.com (no GHL dependency)
router.post('/signup', handleNativeSignup);

// LEGACY: GHL Form Signup - Creates client + VAPI assistant (keep for backwards compatibility)
router.post('/webhooks/ghl-signup', handleGHLSignup);

// GHL Payment Webhook - Creates Stripe customer (called after signup)
router.post('/webhooks/ghl-payment', handleGHLPaymentWebhook);

// VAPI Call Completion - Saves call data + tracks usage
router.post('/vapi/webhook', handleVapiWebhook);
router.post('/webhook/vapi', handleVapiWebhook); // Alias

// Stripe Webhook - Handles subscription events
router.post('/webhooks/stripe', express.raw({ type: 'application/json' }), handleStripeWebhook);

// ============================================
// BILLING ENDPOINTS
// ============================================

// Create checkout session (upgrade flow)
router.post('/billing/checkout', createCheckoutSession);
router.post('/api/billing/checkout', createCheckoutSession); // Alias

// Create customer portal session (manage subscription)
router.post('/billing/portal', createPortalSession);
router.post('/api/billing/portal', createPortalSession); // Alias

// Get subscription status
router.get('/billing/status/:client_id', getSubscriptionStatus);
router.get('/api/billing/status/:client_id', getSubscriptionStatus); // Alias

// ============================================
// HEALTH CHECK
// ============================================

router.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    features: {
      nativeSignup: true,
      telnyxSMS: true,
      ghlLegacy: true
    }
  });
});

router.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

module.exports = router;