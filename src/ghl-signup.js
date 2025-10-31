const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
const crypto = require('crypto');
const { createKnowledgeBaseFromWebsite } = require('./website-scraper');
const { provisionLocalPhone } = require('./phone-provisioning');
const { Resend } = require('resend');

// ============================================
// 🆕 IMPORT INDUSTRY VAPI CONFIG
// ============================================
const { createIndustryAssistant } = require('./vapi-assistant-config');

// Initialize services
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

// ============================================
// 🗑️ REMOVED OLD INDUSTRY_TEMPLATES
// Now handled by vapi-assistant-config.js
// ============================================

// Format phone to E.164
function formatPhoneE164(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`;
  return `+${digits}`;
}

// Generate secure password token
function generatePasswordToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Create password setup token
async function createPasswordToken(userId, email) {
  const token = generatePasswordToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);
  
  const { data, error } = await supabase
    .from('password_reset_tokens')
    .insert({
      user_id: userId,
      email: email,
      token: token,
      expires_at: expiresAt.toISOString(),
      used: false
    })
    .select()
    .single();
  
  if (error) {
    console.error('❌ Error creating password token:', error);
    throw new Error('Failed to create password token');
  }
  
  return token;
}

// ============================================
// 🗑️ REMOVED OLD createVAPIAssistant function
// Now using createIndustryAssistant from vapi-assistant-config.js
// ============================================

// Configure phone number webhook
async function configurePhoneWebhook(phoneId, assistantId) {
  try {
    console.log(`🔗 Configuring webhook for phone ${phoneId}...`);
    
    const response = await fetch(`https://api.vapi.ai/phone-number/${phoneId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        assistantId: assistantId,
        serverUrl: process.env.BACKEND_URL + '/webhook/vapi'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('⚠️ Phone webhook config failed:', errorText);
      return false;
    }

    console.log(`✅ Phone webhook configured`);
    return true;
  } catch (error) {
    console.error('⚠️ Error configuring phone webhook:', error);
    return false;
  }
}

// Main GHL signup handler
async function handleGHLSignup(req, res) {
  try {
    console.log('📝 GHL Signup Webhook Received:', JSON.stringify(req.body, null, 2));

    const businessName = req.body.businessName || req.body.business_name;
    let websiteUrl = req.body.websiteUrl || req.body.business_website;
    
    if (websiteUrl && !websiteUrl.startsWith('http://') && !websiteUrl.startsWith('https://')) {
      websiteUrl = `https://${websiteUrl}`;
      console.log(`🔗 Auto-fixed website URL: ${websiteUrl}`);
    }
    
    const firstName = req.body.firstName || req.body.owner_name;
    const lastName = req.body.lastName || '';
    const ownerName = lastName ? `${firstName} ${lastName}`.trim() : firstName;
    const phone = req.body.phone || req.body.owner_phone;
    const email = req.body.email;
    const industry = req.body.industry;
    const businessCity = req.body.businessCity || req.body.business_city;
    const businessState = req.body.businessState || req.body.business_state;

    console.log('📋 Parsed fields:');
    console.log(`   Business: ${businessName}`);
    console.log(`   Owner: ${ownerName}`);
    console.log(`   Email: ${email}`);
    console.log(`   Phone: ${phone}`);
    console.log(`   Website: ${websiteUrl || 'none'}`);
    console.log(`   Industry: ${industry}`);
    console.log(`   City: ${businessCity}`);
    console.log(`   State: ${businessState}`);

    if (!businessName || !phone || !email || !businessCity || !businessState) {
      console.error('❌ Missing required fields');
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['businessName', 'phone', 'email', 'businessCity', 'businessState'],
        received: req.body
      });
    }

    console.log(`🚀 Starting signup: ${businessName} | ${businessCity}, ${businessState}`);

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

    const formattedOwnerPhone = formatPhoneE164(phone);
    console.log(`📱 Formatted phone: ${formattedOwnerPhone}`);

    // ============================================
    // STEP 1: CREATE KNOWLEDGE BASE (IF WEBSITE PROVIDED)
    // ============================================
    let knowledgeBaseId = null;
    if (websiteUrl && websiteUrl.trim().length > 0) {
      console.log('🌐 Website URL provided, creating knowledge base...');
      try {
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
      } catch (kbError) {
        console.error('⚠️ Knowledge base error (non-blocking):', kbError.message);
      }
    }

    // ============================================
    // STEP 2: CREATE INDUSTRY-SPECIFIC VAPI ASSISTANT
    // ✅ UPDATED: Now includes call transfer support via owner phone
    // ============================================
    console.log(`🤖 Creating industry-specific VAPI assistant for: ${industry}`);
    
    const assistant = await createIndustryAssistant(
      businessName,
      industry,
      knowledgeBaseId,
      formattedOwnerPhone,  // ✅ ADDED: Enables call transfer to owner
      process.env.BACKEND_URL + '/webhook/vapi'
    );
    
    console.log(`✅ Industry assistant created: ${assistant.id}`);

    // Step 3: Provision LOCAL phone number
    const phoneData = await provisionLocalPhone(
      businessCity,
      businessState,
      assistant.id,
      businessName
    );
    
    console.log(`✅ Phone provisioned: ${phoneData.number}`);

    // Step 3.5: Configure phone webhook
    await configurePhoneWebhook(phoneData.id, assistant.id);

    // Step 4: Create client record
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    const { data: newClient, error: clientError } = await supabase
      .from('clients')
      .insert({
        business_name: businessName,
        business_city: businessCity,
        business_state: businessState,
        phone_number: phoneData.number,
        phone_area_code: phoneData.number.substring(2, 5),
        owner_name: ownerName || null,
        owner_phone: formattedOwnerPhone,
        email,
        industry: industry || 'general',
        vapi_assistant_id: assistant.id,
        vapi_phone_number: phoneData.number,
        knowledge_base_id: knowledgeBaseId,
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

    // Step 5: Create user record
    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        client_id: newClient.id,
        email: email,
        first_name: firstName,
        last_name: lastName || null,
        role: 'admin'
      })
      .select()
      .single();

    if (userError) {
      console.error('❌ User creation error:', userError);
      throw userError;
    }

    console.log(`✅ User created: ${newUser.id}`);

    // Step 6: Generate password token
    const token = await createPasswordToken(newUser.id, email);
    console.log(`✅ Password token generated`);

    // Step 7: Send password setup email
    console.log('📧 Sending welcome email...');
    
    try {
      const { data: emailData, error: emailError } = await resend.emails.send({
        from: 'CallBird <onboarding@callbirdai.com>',
        to: email,
        subject: 'Welcome to CallBird - Set Your Password',
        html: `
          <h2>Welcome to CallBird, ${firstName}!</h2>
          <p>Your AI receptionist is ready for ${businessName}.</p>
          <p><strong>Your Phone Number:</strong> ${phoneData.number}</p>
          <p><strong>Location:</strong> ${businessCity}, ${businessState}</p>
          <p>Set your password to access your dashboard:</p>
          <p><a href="https://app.callbirdai.com/auth/set-password?token=${token}" style="background:#0066cc;color:white;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;">Set Password</a></p>
          <p>Your 7-day free trial has started. No credit card required.</p>
        `
      });

      if (emailError) {
        console.error('⚠️ Email send failed:', emailError);
      } else {
        console.log('✅ Welcome email sent');
      }
    } catch (emailError) {
      console.error('⚠️ Email error:', emailError);
    }

    // Step 8: Create Stripe customer
    console.log('💳 Creating Stripe customer...');

    try {
      const stripeResponse = await fetch(`${process.env.BACKEND_URL}/api/webhooks/ghl-payment`, {
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
      }
    } catch (stripeError) {
      console.error('⚠️ Stripe customer creation error (non-blocking):', stripeError.message);
    }

    console.log('🎉 Onboarding complete for:', businessName);

    res.status(200).json({
      success: true,
      message: 'Client provisioned successfully',
      client: {
        id: newClient.id,
        business_name: newClient.business_name,
        phone_number: phoneData.number,
        location: `${businessCity}, ${businessState}`,
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