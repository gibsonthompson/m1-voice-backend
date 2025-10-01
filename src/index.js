const express = require('express');
const { handleTelnyxWebhook } = require('./webhooks');
const { processConversation } = require('./conversations');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic routes
app.get('/', (req, res) => {
  res.json({
    name: 'M1 Voice AI Backend',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      detailedHealth: '/health/detailed',
      webhook: '/webhook/telnyx',
      processConversation: '/api/process-conversation/:conversationId',
      calls: '/api/calls/:clientId',
      singleCall: '/api/call/:callId',
      clients: '/api/clients'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/health/detailed', async (req, res) => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
    
    // Test database connection
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

// Telnyx webhook endpoint
app.post('/webhook/telnyx', handleTelnyxWebhook);

// Process conversation endpoint - fetch from Telnyx API and update database
app.post('/api/process-conversation/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    console.log('Processing conversation:', conversationId);
    
    const result = await processConversation(conversationId);
    
    res.json({ 
      success: true, 
      call: result,
      message: 'Conversation processed and SMS sent'
    });
  } catch (error) {
    console.error('Error processing conversation:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get all calls for a client
app.get('/api/calls/:clientId', async (req, res) => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
    
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

// Get single call details
app.get('/api/call/:callId', async (req, res) => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
    
    const { data, error } = await supabase
      .from('calls')
      .select('*')
      .eq('call_id', req.params.callId)
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
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
    
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
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ M1 Voice Backend running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Supabase URL: ${process.env.SUPABASE_URL ? 'Configured' : 'Missing'}`);
  console.log(`Telnyx API Key: ${process.env.TELNYX_API_KEY ? 'Configured' : 'Missing'}`);
});
