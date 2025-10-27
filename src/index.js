const express = require('express');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE - ORDER MATTERS!
// ============================================

// Stripe webhook needs RAW body - must come BEFORE express.json()
app.post('/api/webhooks/stripe', 
  express.raw({ type: 'application/json' }), 
  routes
);

// All other routes use JSON parsing
app.use(express.json());

// ============================================
// MOUNT ROUTES
// ============================================

app.use('/api', routes);

// ============================================
// HEALTH CHECK
// ============================================

app.get('/', (req, res) => {
  res.json({ 
    status: 'CallBird API Running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ============================================
// ERROR HANDLER
// ============================================

app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ Supabase: ${process.env.SUPABASE_URL ? 'Configured' : 'Missing'}`);
  console.log(`✅ VAPI: ${process.env.VAPI_API_KEY ? 'Configured' : 'Missing'}`);
  console.log(`✅ Stripe: ${process.env.STRIPE_SECRET_KEY ? 'Configured' : 'Missing'}`);
  console.log(`✅ Resend: ${process.env.RESEND_API_KEY ? 'Configured' : 'Missing'}`);
});

module.exports = app;