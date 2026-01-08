const express = require('express');
const cors = require('cors');

// ============================================
// 🆕 ADD RATE LIMITING
// ============================================
const { 
  apiLimiter, 
  authLimiter, 
  webhookLimiter, 
  signupLimiter 
} = require('./rate-limiter');

// Import route handlers
const routes = require('./routes');
const vapiWebhook = require('./webhooks');
const { runTrialManager } = require('./cron/trial-manager');
const { updateKnowledgeBase } = require('./knowledge-base'); // 🆕 ADD THIS

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// 🔧 TRUST PROXY - FIX RATE LIMITING ERROR
// ============================================
app.set('trust proxy', 1);

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
app.post('/api/webhooks/stripe', 
  express.raw({ type: 'application/json' }), 
  require('./routes/stripe-webhook').handleStripeWebhook
);

// ============================================
// STANDARD MIDDLEWARE
// ============================================
app.use(express.json());

// ============================================
// 🆕 RATE LIMITING - PROTECT API
// ============================================
app.use('/api/', apiLimiter);
app.use('/webhook/', webhookLimiter);
app.use('/api/webhooks/ghl-signup', signupLimiter);

// ============================================
// VAPI WEBHOOK - CRITICAL FOR CALL HANDLING
// ============================================
app.post('/webhook/vapi', vapiWebhook.handleVapiWebhook);

// ============================================
// 🆕 VAPI DEMO WEBHOOK - TRIAL SIGNUPS
// ============================================
const demoWebhook = require('./routes/demo-webhook');
app.use('/webhook/vapi', demoWebhook);

// ============================================
// 🆕 KNOWLEDGE BASE UPDATE ENDPOINT
// ============================================
app.post('/api/knowledge-base/update', updateKnowledgeBase);

// ============================================
// 🆕 CALENDAR BOOKING - VAPI TOOL
// ============================================
const calendarRoutes = require('./routes/calendar');
app.use('/api/calendar', calendarRoutes);

// ============================================
// CRON JOB ENDPOINTS - TRIAL MANAGEMENT
// ============================================
app.post('/api/cron/check-trials', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET || 'your-secret-key-here';
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.log('⚠️ Unauthorized cron attempt');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('⏰ Cron job triggered: Checking trial expirations');
    await runTrialManager();
    
    res.json({ 
      success: true, 
      message: 'Trial expiration check completed',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Cron job error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.post('/api/admin/trigger-trial-check', async (req, res) => {
  try {
    console.log('🔧 Manual trigger: Checking trial expirations');
    await runTrialManager();
    
    res.json({ 
      success: true, 
      message: 'Trial check completed manually',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Manual trigger error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

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
      vapiDemo: '/webhook/vapi/demo-trial-signup', // 🆕 ADDED
      stripe: '/api/webhooks/stripe',
      knowledgeBase: '/api/knowledge-base/update', // 🆕 ADD THIS
      cron: '/api/cron/check-trials',
      admin: '/api/admin/trigger-trial-check',
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
      ghl: !!process.env.GHL_API_KEY,
      cron: !!process.env.CRON_SECRET
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
  console.log(`   Cron Secret: ${process.env.CRON_SECRET ? '✓ Configured' : '✗ Missing'}`);
  console.log(`\n🔒 Rate Limiting: ENABLED`);
  console.log(`   API Routes: 100 req/15min per IP`);
  console.log(`   Webhooks: 1000 req/hour`);
  console.log(`   Signups: 3 req/hour per IP`);
  console.log(`\n📍 Critical Routes:`);
  console.log(`   POST /webhook/vapi - VAPI call webhooks`);
  console.log(`   POST /webhook/vapi/demo-trial-signup - Demo trial signups`); // 🆕 ADDED
  console.log(`   POST /api/webhooks/stripe - Stripe payment webhooks`);
  console.log(`   POST /api/webhooks/ghl-signup - GoHighLevel signups`);
  console.log(`   POST /api/knowledge-base/update - Knowledge base updates`); // 🆕 ADD THIS
  console.log(`   POST /api/cron/check-trials - Automated trial checks`);
  console.log(`   POST /api/admin/trigger-trial-check - Manual trial check`);
});

module.exports = app;
// ============================================
// 🆕 UPDATE ASSISTANT CALENDAR - Called when user connects/disconnects calendar
// ============================================
const { updateAssistantCalendar } = require('./vapi-assistant-config');

app.post('/api/assistant/update-calendar', async (req, res) => {
  try {
    const { assistantId, clientId, enabled } = req.body;
    
    if (!assistantId || !clientId) {
      return res.status(400).json({ error: 'Missing assistantId or clientId' });
    }

    const success = await updateAssistantCalendar(assistantId, clientId, enabled);
    
    if (success) {
      res.json({ success: true, message: `Calendar ${enabled ? 'enabled' : 'disabled'}` });
    } else {
      res.status(500).json({ error: 'Failed to update assistant' });
    }
  } catch (error) {
    console.error('Update calendar error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});
