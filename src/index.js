const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { handleVapiWebhook } = require('./webhooks');
const { handleGHLSignup } = require('./ghl-signup');

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'CallBird AI Backend',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      detailedHealth: '/health/detailed',
      vapiWebhook: '/api/vapi/webhook',
      ghlSignup: '/api/webhooks/ghl-signup',
      testGHL: '/api/test-ghl',
      testGHLSMS: '/api/test-ghl-sms',
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

// VAPI webhook endpoint
app.post('/api/vapi/webhook', handleVapiWebhook);

// GHL signup webhook endpoint
app.post('/api/webhooks/ghl-signup', handleGHLSignup);

// Test GHL Connection
app.get('/api/test-ghl', async (req, res) => {
  try {
    const axios = require('axios');
    
    console.log('🧪 Testing GHL connection...');
    console.log('   Location ID:', process.env.GHL_LOCATION_ID);
    console.log('   API Key exists:', !!process.env.GHL_API_KEY);
    
    const response = await axios.get(
      `https://services.leadconnectorhq.com/locations/${process.env.GHL_LOCATION_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
          'Version': '2021-07-28'
        }
      }
    );
    
    console.log('✅ GHL connection successful');
    
    res.json({ 
      success: true, 
      location: response.data.location.name,
      locationId: response.data.location.id,
      phone: response.data.location.phone
    });
  } catch (error) {
    console.error('❌ GHL connection failed:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      error: error.response?.data || error.message 
    });
  }
});

// Test GHL SMS
app.post('/api/test-ghl-sms', async (req, res) => {
  try {
    const { to, message } = req.body;
    
    console.log('🧪 Testing GHL SMS...');
    console.log('   To:', to);
    console.log('   Message:', message);
    
    if (!to) {
      return res.status(400).json({ success: false, error: 'Phone number required in body as "to"' });
    }
    
    // Import the SMS function from webhooks
    const axios = require('axios');
    
    // Format phone to E.164
    const digits = to.replace(/\D/g, '');
    let formattedPhone = to;
    if (digits.length === 10) {
      formattedPhone = `+1${digits}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      formattedPhone = `+${digits}`;
    }
    
    console.log('   Formatted phone:', formattedPhone);
    
    // Step 1: Search for contact
    console.log('🔍 Searching for contact...');
    let contactId = null;
    
    try {
      const searchResponse = await axios.get(
        `https://services.leadconnectorhq.com/contacts/search/duplicate`,
        {
          params: {
            locationId: process.env.GHL_LOCATION_ID,
            number: formattedPhone
          },
          headers: {
            'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
            'Version': '2021-07-28'
          }
        }
      );
      
      if (searchResponse.data && searchResponse.data.contact) {
        contactId = searchResponse.data.contact.id;
        console.log('✅ Contact found:', contactId);
      }
    } catch (searchError) {
      console.log('⚠️ Contact not found, will create');
    }
    
    // Step 2: Create contact if doesn't exist
    if (!contactId) {
      console.log('📝 Creating contact...');
      
      const createResponse = await axios.post(
        'https://services.leadconnectorhq.com/contacts/',
        {
          locationId: process.env.GHL_LOCATION_ID,
          phone: formattedPhone,
          firstName: 'Test',
          lastName: 'Contact',
          source: 'CallBird Test'
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
            'Content-Type': 'application/json',
            'Version': '2021-07-28'
          }
        }
      );
      
      contactId = createResponse.data.contact.id;
      console.log('✅ Contact created:', contactId);
    }
    
    // Step 3: Send SMS
    console.log('📤 Sending SMS...');
    
    const smsResponse = await axios.post(
      'https://services.leadconnectorhq.com/conversations/messages',
      {
        type: 'SMS',
        contactId: contactId,
        message: message || 'Test SMS from CallBird via GoHighLevel'
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        }
      }
    );
    
    console.log('✅ SMS sent successfully!');
    console.log('   Message ID:', smsResponse.data.messageId || smsResponse.data.id);
    
    res.json({ 
      success: true,
      contactId: contactId,
      messageId: smsResponse.data.messageId || smsResponse.data.id
    });
    
  } catch (error) {
    console.error('❌ Test SMS failed:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      error: error.response?.data || error.message 
    });
  }
});

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

// Get single call details
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

// 404 handler with logging
app.use((req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({ 
    error: 'Not found',
    path: req.path,
    method: req.method
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ CallBird Backend running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📍 Supabase: ${process.env.SUPABASE_URL ? '✓' : '✗'}`);
  console.log(`📍 VAPI Key: ${process.env.VAPI_API_KEY ? '✓' : '✗'}`);
  console.log(`📍 GHL Key: ${process.env.GHL_API_KEY ? '✓' : '✗'}`);
  console.log(`📍 GHL Location: ${process.env.GHL_LOCATION_ID ? '✓' : '✗'}`);
  console.log('');
  console.log('🔗 Webhook Endpoints:');
  console.log(`   → VAPI: http://localhost:${PORT}/api/vapi/webhook`);
  console.log(`   → GHL:  http://localhost:${PORT}/api/webhooks/ghl-signup`);
  console.log('');
  console.log('🧪 Test Endpoints:');
  console.log(`   → GHL Connection: http://localhost:${PORT}/api/test-ghl`);
  console.log(`   → GHL SMS Test:   http://localhost:${PORT}/api/test-ghl-sms`);
});