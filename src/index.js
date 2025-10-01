const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Import routes
const webhookRoutes = require('./webhooks');

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Make supabase available to all routes
app.use((req, res, next) => {
  req.supabase = supabase;
  next();
});

// Log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.get('/', (req, res) => {
  res.json({ 
    status: 'M1 Voice Dashboard API is Running!',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      webhook: 'POST /webhook/telnyx',
      health: 'GET /health',
      healthDetailed: 'GET /health/detailed',
      calls: 'GET /api/calls/:clientId',
      singleCall: 'GET /api/call/:callId'
    }
  });
});

// Simple health check - responds immediately for Railway
app.get('/health', (req, res) => {
  console.log('Health check - responding immediately');
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString()
  });
});

// Detailed health check with database connection test
app.get('/health/detailed', async (req, res) => {
  try {
    console.log('Detailed health check - testing database...');
    
    // Test database connection
    const { error } = await supabase.from('clients').select('count').limit(1);
    
    res.json({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: error ? 'error' : 'connected',
      error: error ? error.message : null
    });
  } catch (err) {
    console.error('Database health check failed:', err);
    res.status(500).json({
      status: 'unhealthy',
      database: 'error',
      error: err.message
    });
  }
});

// Webhook routes
app.use('/webhook', webhookRoutes);

// API Routes - Get all calls for a client
app.get('/api/calls/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    
    console.log(`Fetching calls for client: ${clientId}`);
    
    const { data, error } = await supabase
      .from('calls')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (error) throw error;
    
    res.json({ 
      success: true, 
      count: data.length,
      calls: data 
    });
    
  } catch (error) {
    console.error('Error fetching calls:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// API Routes - Get single call details
app.get('/api/call/:callId', async (req, res) => {
  try {
    const { callId } = req.params;
    
    console.log(`Fetching call: ${callId}`);
    
    const { data, error } = await supabase
      .from('calls')
      .select('*')
      .eq('id', callId)
      .single();
    
    if (error) throw error;
    
    res.json({ 
      success: true, 
      call: data 
    });
    
  } catch (error) {
    console.error('Error fetching call:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// API Routes - Get all clients
app.get('/api/clients', async (req, res) => {
  try {
    console.log('Fetching all clients');
    
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    res.json({ 
      success: true, 
      count: data.length,
      clients: data 
    });
    
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error',
    message: err.message 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Endpoint not found' 
  });
});

// CRITICAL: Start server with IPv6 binding for Railway
// Using '::' instead of '0.0.0.0' to support Railway's networking
app.listen(PORT, '::', () => {
  console.log('');
  console.log('========================================');
  console.log('M1 Voice Dashboard API');
  console.log('========================================');
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Binding: IPv6 (::) for Railway compatibility`);
  console.log(`Webhook: http://[::]:${PORT}/webhook/telnyx`);
  console.log(`Health: http://[::]:${PORT}/health`);
  console.log('========================================');
  console.log('');
});