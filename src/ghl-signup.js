const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
const { createKnowledgeBaseFromWebsite } = require('./website-scraper');

// Initialize Supabase with SERVICE KEY
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Industry template mapping
const INDUSTRY_TEMPLATES = {
  'plumbing': 'home_services',
  'hvac': 'home_services',
  'electrical': 'home_services',
  'roofing': 'home_services',
  'general_contractor': 'home_services',
  'medical': 'medical',
  'dental': 'medical',
  'retail': 'retail',
  'legal': 'professional_services',
  'accounting': 'professional_services',
  'restaurant': 'restaurants'
};

// Format phone to E.164
function formatPhoneE164(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`;
  return `+${digits}`;
}

// Create VAPI assistant with knowledge base
async function createVAPIAssistant(businessName, industry, websiteUrl) {
  try {
    console.log(`🤖 Creating VAPI assistant for ${businessName}...`);
    
    // Create knowledge base from website if provided
    let knowledgeBaseId = null;
    if (websiteUrl && websiteUrl.trim().length > 0) {
      console.log('🌐 Website URL provided, creating knowledge base...');
      knowledgeBaseId = await createKnowledgeBaseFromWebsite(
        websiteUrl,
        businessName,
        process.env.VAPI_API_KEY
      );
      
      if (knowledgeBaseId) {
        console.log(`✅ Knowledge base ready: ${knowledgeBaseId}`);
      } else {
        console.log('⚠️ Knowledge base creation failed, continuing without it');
      }
    }

    const templateType = INDUSTRY_TEMPLATES[industry?.toLowerCase()] || 'home_services';
    
    const systemPrompt = knowledgeBaseId 
      ? `You are a professional AI receptionist for ${businessName}. Answer calls politely and professionally. When customers ask about ${businessName}'s services, pricing, location, or company information, use the knowledge base to provide accurate details from their website. Extract the caller's name, phone number, and reason for calling. Be helpful, friendly, and efficient.`
      : `You are a professional AI receptionist for ${businessName}. Answer calls politely and professionally. Extract the caller's name, phone number, and reason for calling. Be helpful, friendly, and efficient.`;

    const assistantConfig = {
      name: `${businessName} Receptionist`,
      model: {
        provider: 'openai',
        model: 'gpt-4',
        temperature: 0.7,
        knowledgeBaseId: knowledgeBaseId,
        messages: [{ 
          role: 'system', 
          content: systemPrompt
        }]
      },
      voice: {
        provider: 'azure',
        voiceId: 'andrew'
      },
      firstMessage: `Thank you for calling ${businessName}. How can I help you today?`,
      endCallMessage: 'Thank you for calling. Have a great day!',
      endCallPhrases: ['goodbye', 'bye', 'hang up'],
      recordingEnabled: true,
      serverMessages: ['end-of-call-report', 'transcript'],
      serverUrl: `${process.env.BACKEND_URL}/api/webhooks/vapi`,
      analysisPlan: {
        structuredDataSchema: {
          type: 'object',
          properties: {
            customer_name: { type: 'string' },
            customer_phone: { type: 'string' },
            urgency: { 
              type: 'string',
              enum: ['low', 'medium', 'high', 'emergency']
            },
            service_type: { type: 'string' },
            issue_description: { type: 'string' }
          }
        }
      }
    };

    const response = await fetch('https://api.vapi.ai/assistant', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(assistantConfig)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`VAPI assistant creation failed: ${errorText}`);
    }

    const assistant = await response.json();
    console.log(`✅ Assistant created: ${assistant.id}`);
    
    return assistant;
  } catch (error) {
    console.error('❌ Error creating VAPI assistant:', error);
    throw error;
  }
}

// Provision phone number with fallback
async function provisionVAPIPhone(areaCode, assistantId) {
  try {
    console.log(`📞 Provisioning phone number with area code ${areaCode}...`);

    const response = await fetch('https://api.vapi.ai/phone-number', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        provider: 'vapi',
        areaCode: areaCode,
        assistantId: assistantId,
        name: `CallBird ${areaCode}`
      })
    });

    if (!response.ok) {
      const error = await response.json();
      
      // Try with VAPI-suggested area codes
      if (error.message && error.message.includes('not available')) {
        console.log('⚠️ Area code unavailable, trying fallback...');
        const fallbackCodes = ['404', '678', '770', '470'];
        
        for (const code of fallbackCodes) {
          try {
            const retryResponse = await fetch('https://api.vapi.ai/phone-number', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                provider: 'vapi',
                areaCode: code,
                assistantId: assistantId,
                name: `CallBird ${code}`
              })
            });

            if (retryResponse.ok) {
              const phoneData = await retryResponse.json();
              console.log(`✅ Phone provisioned with fallback ${code}: ${phoneData.number}`);
              return phoneData;
            }
          } catch (retryError) {
            continue;
          }
        }
      }
      
      throw new Error(`Failed to provision phone: ${JSON.stringify(error)}`);
    }

    const phoneData = await response.json();
    console.log(`✅ Phone number provisioned: ${phoneData.number}`);
    return phoneData;
  } catch (error) {
    console.error('❌ Phone provisioning error:', error);
    throw error;
  }
}

// Main GHL signup handler
async function handleGHLSignup(req, res) {
  try {
    console.log('📝 GHL Signup Webhook Received:', JSON.stringify(req.body, null, 2));

    // Handle BOTH camelCase (from GHL) and snake_case (legacy) field names
    const businessName = req.body.businessName || req.body.business_name;
    const websiteUrl = req.body.websiteUrl || req.body.business_website;
    const firstName = req.body.firstName || req.body.owner_name;
    const lastName = req.body.lastName || '';
    const ownerName = lastName ? `${firstName} ${lastName}`.trim() : firstName;
    const phone = req.body.phone || req.body.owner_phone;
    const email = req.body.email;
    const industry = req.body.industry;
    const areaCode = req.body.areaCode || req.body.preferred_area_code || '404';

    console.log('📋 Parsed fields:');
    console.log(`   Business: ${businessName}`);
    console.log(`   Owner: ${ownerName}`);
    console.log(`   Email: ${email}`);
    console.log(`   Phone: ${phone}`);
    console.log(`   Website: ${websiteUrl || 'none'}`);
    console.log(`   Industry: ${industry}`);
    console.log(`   Area Code: ${areaCode}`);

    // Validate required fields
    if (!businessName || !phone || !email) {
      console.error('❌ Missing required fields');
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['businessName (or business_name)', 'phone (or owner_phone)', 'email'],
        received: req.body
      });
    }

    // Check for duplicate
    const { data: existing, error: dupError } = await supabase
      .from('clients')
      .select('id, email')
      .eq('email', email)
      .single();

    if (existing) {
      console.log('⚠️ Duplicate signup attempt:', email);
      return res.status(409).json({ 
        error: 'Account already exists',
        client_id: existing.id 
      });
    }

    // Format phone numbers
    const formattedOwnerPhone = formatPhoneE164(phone);
    console.log(`📱 Formatted phone: ${formattedOwnerPhone}`);

    // Step 1: Create VAPI assistant with knowledge base
    const assistant = await createVAPIAssistant(businessName, industry, websiteUrl);

    // Step 2: Provision phone number
    const phoneNumber = await provisionVAPIPhone(areaCode, assistant.id);

    // Step 3: Create client record with TRIAL fields
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    
    const { data: newClient, error: clientError } = await supabase
      .from('clients')
      .insert({
        business_name: businessName,
        business_website: websiteUrl || null,
        phone_number: phoneNumber.number,
        owner_name: ownerName || null,
        owner_phone: formattedOwnerPhone,
        email,
        industry: industry || 'general',
        vapi_assistant_id: assistant.id,
        vapi_phone_number: phoneNumber.number,
        knowledge_base_id: assistant.model.knowledgeBaseId || null,
        
        // TRIAL FIELDS
        subscription_status: 'trial',
        trial_ends_at: trialEndsAt,
        status: 'active',
        plan_type: 'starter',
        monthly_call_limit: 100,
        calls_this_month: 0
      })
      .select()
      .single();

    if (clientError) {
      console.error('❌ Database error:', clientError);
      throw clientError;
    }

    console.log(`🎉 Client created successfully: ${newClient.business_name}`);
    console.log(`📞 Phone: ${phoneNumber.number}`);
    console.log(`🆔 Client ID: ${newClient.id}`);
    console.log(`⏰ Trial ends: ${newClient.trial_ends_at}`);

    // ============================================
    // Step 4: CREATE STRIPE CUSTOMER
    // ============================================
    console.log('💳 Creating Stripe customer...');

    try {
      const stripeResponse = await fetch(`${process.env.BACKEND_URL || 'https://dolphin-app-fohdg.ondigitalocean.app'}/api/webhooks/ghl-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email,
          contact_name: ownerName,
          business_name: businessName,
          phone: formattedOwnerPhone,
          client_id: newClient.id
        })
      });

      if (!stripeResponse.ok) {
        console.error('⚠️ Stripe customer creation failed (non-blocking):', await stripeResponse.text());
      } else {
        const stripeData = await stripeResponse.json();
        console.log('✅ Stripe customer created:', stripeData.stripe_customer_id);
        console.log('✅ Trial started, expires:', stripeData.trial_ends_at);
      }
    } catch (stripeError) {
      // Don't fail the entire signup if Stripe fails
      console.error('⚠️ Stripe customer creation error (non-blocking):', stripeError.message);
    }

    // Step 5: Send welcome email (using Resend)
    // TODO: Add email sending here if you want welcome emails

    console.log('🎉 Onboarding complete for:', businessName);

    res.status(200).json({
      success: true,
      message: 'Client provisioned successfully',
      client: {
        id: newClient.id,
        business_name: newClient.business_name,
        phone_number: phoneNumber.number,
        trial_ends_at: newClient.trial_ends_at,
        subscription_status: 'trial'
      }
    });

  } catch (error) {
    console.error('❌ GHL webhook error:', error);
    res.status(500).json({ 
      error: 'Signup failed', 
      details: error.message 
    });
  }
}

module.exports = { handleGHLSignup };