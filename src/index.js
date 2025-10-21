const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { handleVapiWebhook } = require('./webhooks');
const { handleGHLSignup } = require('./ghl-signup'); // ← NEW: Import GHL webhook handler

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'M1 Voice AI Backend',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      detailedHealth: '/health/detailed',
      vapiWebhook: '/webhook/vapi',
      ghlSignup: '/api/webhooks/ghl-signup', // ← NEW: Added to endpoint list
      calls: '/api/calls/:clientId',
      singleCall: '/api/call/:callId',
      clients: '/api/clients'
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Detailed health check with database
app.get('/health/detailed', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('count')
      .limit(1);

    if (error) throw error;

    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Vapi webhook endpoint
app.post('/webhook/vapi', handleVapiWebhook);

// GHL signup webhook endpoint - ← NEW: Added GHL webhook route
app.post('/api/webhooks/ghl-signup', handleGHLSignup);

// Get all calls for a client
app.get('/api/calls/:clientId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('calls')
      .select('*')
      .eq('client_id', req.params.clientId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, calls: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single call details - FIXED: changed 'call_id' to 'id'
app.get('/api/call/:callId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('calls')
      .select('*')
      .eq('id', req.params.callId)
      .single();

    if (error) throw error;

    res.json({ success: true, call: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all clients
app.get('/api/clients', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, clients: data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ M1 Voice Backend running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Supabase URL: ${process.env.SUPABASE_URL ? 'Configured' : 'Missing'}`);
  console.log(`Telnyx API Key: ${process.env.TELNYX_API_KEY ? 'Configured' : 'Missing'}`);
  console.log(`VAPI API Key: ${process.env.VAPI_API_KEY ? 'Configured' : 'Missing'}`); // ← NEW: Added VAPI key check
});