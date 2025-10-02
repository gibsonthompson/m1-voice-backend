const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { handleVapiWebhook } = require('./webhooks');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Get single call details - FIXED LINE 95
app.get('/api/call/:callId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('calls')
      .select('*')
      .eq('i
