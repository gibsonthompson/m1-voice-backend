const express = require('express');
const cors = require('cors');

// Import route handlers
const routes = require('./routes');
const vapiWebhook = require('./webhooks');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// CORS - Allow frontend access
// ============================================
app.use(cors({
  origin: ['https://app.callbirdai.com', 'http://localhost:3000'],
  credentials: true
}));

// ============================================
// CRITICAL WEBHOOKS - RAW BODY REQUIRED
// ============================================

// Stripe webhook - MUST come before express.json()
app.post('/api/webhooks/stripe', 
  express.raw({ type: 'application/json' }), 
  require('./routes/stripe-webhook').handleStripeWebhook
);

// ============================================
// STANDARD MIDDLEWARE
// ============================================

// JSON parsing for all other routes
app.use(express.json());

// ============================================
// VAPI WEBHOOK - CRITICAL FOR CALL HANDLING
// ============================================

app.post('/webhook/vapi', vapiWebhook.handleVapiWebhook);

// ============================================
// MOUNT ALL OTHER ROUTES
// ============================================

app.use('/api', routes);

// ============================================
// HEALTH CHECK
// ============================================

app.get('/', (req, res) => {
  res.json({ 
    status: 'CallBird API Running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    routes: {
      vapi: '/webhook/vapi',
      stripe: '/api/webhooks/stripe',
      api: '/api/*'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      supabase: !!process.env.SUPABASE_URL,
      vapi: !!process.env.VAPI_API_KEY,
      stripe: !!process.env.STRIPE_SECRET_KEY,
      resend: !!process.env.RESEND_API_KEY,
      ghl: !!process.env.GHL_API_KEY
    }
  });
});

// ============================================
// ERROR HANDLER
// ============================================

app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  console.log(`⚠️ 404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({ 
    error: 'Not found',
    path: req.path,
    method: req.method
  });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`\n✅ Service Status:`);
  console.log(`   Supabase: ${process.env.SUPABASE_URL ? '✓ Configured' : '✗ Missing'}`);
  console.log(`   VAPI: ${process.env.VAPI_API_KEY ? '✓ Configured' : '✗ Missing'}`);
  console.log(`   Stripe: ${process.env.STRIPE_SECRET_KEY ? '✓ Configured' : '✗ Missing'}`);
  console.log(`   Resend: ${process.env.RESEND_API_KEY ? '✓ Configured' : '✗ Missing'}`);
  console.log(`   GHL: ${process.env.GHL_API_KEY ? '✓ Configured' : '✗ Missing'}`);
  console.log(`\n📍 Critical Routes:`);
  console.log(`   POST /webhook/vapi - VAPI call webhooks`);
  console.log(`   POST /api/webhooks/stripe - Stripe payment webhooks`);
  console.log(`   POST /api/webhooks/ghl-signup - GoHighLevel signups`);
});

module.exports = app;