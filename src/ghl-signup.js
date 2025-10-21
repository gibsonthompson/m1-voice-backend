const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

// Initialize Supabase with SERVICE KEY
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// VAPI Template IDs
const VAPI_TEMPLATES = {
  'home_services': '6f10579e-1a4d-4ad2-bbb0-8d4acb577569',
  'medical': '1c0ace33-8229-4af4-9be8-d2beb955fa82',
  'retail': '0b78f485-d860-401c-abc5-4283510fe19c',
  'professional_services': '8c6b9048-c6f8-40e0-879f-58e060780b7e',
  'restaurants': '360775b7-9573-45a7-9789-595b8acf25d9'
};

// Map GHL industry strings to keys
const INDUSTRY_MAP = {
  'Home Services (plumbing, HVAC, contractors)': 'home_services',
  'Medical/Dental': 'medical',
  'Retail/E-commerce': 'retail',
  'Professional Services (legal, accounting)': 'professional_services',
  'Restaurants/Food Service': 'restaurants'
};

// Format phone to E.164
function formatPhoneE164(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`;
  return `+${digits}`;
}

// Get VAPI template
async function getVAPITemplate(templateId) {
  const response = await fetch(`https://api.vapi.ai/assistant/${templateId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get VAPI template: ${response.statusText}`);
  }
  
  return await response.json();
}

// Create VAPI assistant
async function createVAPIAssistant(templateConfig, businessName) {
  const customizedPrompt = templateConfig.model.messages[0].content
    .replace('{{business_name}}', businessName)
    .replace('{{business_hours}}', 'Monday-Friday 9am-5pm');
  
  const newAssistant = {
    name: `${businessName} Assistant`,
    firstMessage: templateConfig.firstMessage,
    model: {
      ...templateConfig.model,
      messages: [{ role: 'system', content: customizedPrompt }]
    },
    voice: templateConfig.voice,
    transcriber: templateConfig.transcriber,
    serverUrl: process.env.VAPI_WEBHOOK_URL,
    serverUrlSecret: process.env.VAPI_WEBHOOK_SECRET
  };
  
  const response = await fetch('https://api.vapi.ai/assistant', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(newAssistant)
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create VAPI assistant: ${error}`);
  }
  
  return await response.json();
}

// Buy VAPI phone number
async function provisionVAPIPhone(assistantId) {
  const buyResponse = await fetch('https://api.vapi.ai/phone-number/buy', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      areaCode: '404',
      name: `Assistant Phone`,
      assistantId: assistantId
    })
  });
  
  if (!buyResponse.ok) {
    const error = await buyResponse.text();
    throw new Error(`Failed to buy phone number: ${error}`);
  }
  
  const phoneData = await buyResponse.json();
  return phoneData.number;
}

// Send welcome email
async function sendWelcomeEmail(email, firstName, businessName, vapiPhone) {
  console.log(`📧 Welcome email for ${email} - Phone: ${vapiPhone}`);
  // TODO: Add email service
}

// Main handler
async function handleGHLSignup(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  console.log('📥 GHL Webhook:', req.body);
  
  try {
    const { email, first_name, phone, business_name, industry } = req.body;
    
    if (!email || !first_name || !phone || !business_name || !industry) {
      return res.status(400).json({ error: 'Missing required fields', received: req.body });
    }
    
    const formattedPhone = formatPhoneE164(phone);
    const industryKey = INDUSTRY_MAP[industry];
    
    if (!industryKey) {
      return res.status(400).json({ error: 'Invalid industry', received: industry });
    }
    
    console.log('✅ Validated:', { email, first_name, formattedPhone, business_name, industryKey });
    
    // Check existing
    const { data: existing } = await supabase
      .from('clients')
      .select('id')
      .eq('email', email)
      .single();
    
    if (existing) {
      console.log('⚠️ User exists:', email);
      return res.status(200).json({ message: 'User exists', client_id: existing.id });
    }
    
    // Get template
    console.log('🤖 Getting VAPI template...');
    const templateId = VAPI_TEMPLATES[industryKey];
    const templateConfig = await getVAPITemplate(templateId);
    
    // Create assistant
    console.log('🛠️ Creating assistant...');
    const assistant = await createVAPIAssistant(templateConfig, business_name);
    console.log('✅ Assistant:', assistant.id);
    
    // Provision phone
    console.log('📞 Provisioning phone...');
    const vapiPhone = await provisionVAPIPhone(assistant.id);
    console.log('✅ Phone:', vapiPhone);
    
    // Create account
    console.log('💾 Creating Supabase account...');
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 7);
    
    const { data: newClient, error: dbError } = await supabase
      .from('clients')
      .insert({
        email,
        first_name,
        phone: formattedPhone,
        business_name,
        industry: industryKey,
        vapi_assistant_id: assistant.id,
        vapi_phone_number: vapiPhone,
        status: 'trial',
        trial_ends_at: trialEndsAt.toISOString()
      })
      .select()
      .single();
    
    if (dbError) {
      console.error('❌ DB Error:', dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }
    
    console.log('✅ Account created:', newClient.id);
    
    // Send email
    await sendWelcomeEmail(email, first_name, business_name, vapiPhone);
    
    console.log('🎉 Complete!');
    return res.status(200).json({
      success: true,
      client_id: newClient.id,
      vapi_phone: vapiPhone,
      trial_ends_at: trialEndsAt
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(500).json({ error: 'Internal error', message: error.message });
  }
}

module.exports = { handleGHLSignup };