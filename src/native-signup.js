// ============================================
// NATIVE SIGNUP HANDLER - Replaces GHL Dependency
// ============================================
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const { Resend } = require('resend');
const { createKnowledgeBaseFromWebsite } = require('./website-scraper');
const { provisionLocalPhone } = require('./phone-provisioning');
const { createIndustryAssistant } = require('./vapi-assistant-config');
const { sendWelcomeSMS, sendAdminSignupNotification } = require('./telnyx-sms');

// Initialize services
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

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

// Validate signup request
function validateSignupRequest(body) {
  const errors = [];
  
  if (!body.firstName || body.firstName.trim().length < 1) {
    errors.push('First name is required');
  }
  if (!body.email || !body.email.includes('@')) {
    errors.push('Valid email is required');
  }
  if (!body.phone || body.phone.replace(/\D/g, '').length < 10) {
    errors.push('Valid phone number is required');
  }
  if (!body.businessName || body.businessName.trim().length < 2) {
    errors.push('Business name is required');
  }
  if (!body.businessCity || body.businessCity.trim().length < 2) {
    errors.push('City is required');
  }
  if (!body.businessState || body.businessState.trim().length < 2) {
    errors.push('State is required');
  }
  if (!body.industry) {
    errors.push('Industry is required');
  }
  
  return errors;
}

// ============================================
// MAIN NATIVE SIGNUP HANDLER
// ============================================
async function handleNativeSignup(req, res) {
  try {
    console.log('📝 Native Signup Request Received');
    console.log('   Body:', JSON.stringify(req.body, null, 2));

    // Validate request
    const validationErrors = validateSignupRequest(req.body);
    if (validationErrors.length > 0) {
      console.error('❌ Validation errors:', validationErrors);
      return res.status(400).json({ 
        error: 'Validation failed',
        errors: validationErrors
      });
    }

    // Extract and normalize fields
    const {
      firstName,
      lastName = '',
      email,
      phone,
      businessName,
      industry,
      businessCity,
      businessState,
      websiteUrl: rawWebsiteUrl,
      referralSource = ''
    } = req.body;

    // Normalize website URL
    let websiteUrl = rawWebsiteUrl;
    if (websiteUrl && !websiteUrl.startsWith('http://') && !websiteUrl.startsWith('https://')) {
      websiteUrl = `https://${websiteUrl}`;
      console.log(`🔗 Auto-fixed website URL: ${websiteUrl}`);
    }

    const ownerName = lastName ? `${firstName} ${lastName}`.trim() : firstName;
    const formattedOwnerPhone = formatPhoneE164(phone);

    console.log('📋 Parsed fields:');
    console.log(`   Business: ${businessName}`);
    console.log(`   Owner: ${ownerName}`);
    console.log(`   Email: ${email}`);
    console.log(`   Phone: ${formattedOwnerPhone}`);
    console.log(`   Website: ${websiteUrl || 'none'}`);
    console.log(`   Industry: ${industry}`);
    console.log(`   Location: ${businessCity}, ${businessState}`);
    console.log(`   Referral: ${referralSource || 'none'}`);

    // Check for duplicate
    const { data: existing } = await supabase
      .from('clients')
      .select('id, email')
      .eq('email', email.toLowerCase())
      .single();

    if (existing) {
      console.log('⚠️ Duplicate signup attempt:', email);
      return res.status(409).json({ 
        error: 'Account already exists',
        message: 'An account with this email already exists. Please log in or use a different email.',
        client_id: existing.id 
      });
    }

    console.log(`🚀 Starting signup: ${businessName} | ${businessCity}, ${businessState}`);

    // ============================================
    // STEP 1: CREATE KNOWLEDGE BASE (IF WEBSITE PROVIDED)
    // ============================================
    let knowledgeBaseData = null;
    if (websiteUrl && websiteUrl.trim().length > 0) {
      console.log('🌐 Website URL provided, creating knowledge base...');
      try {
        knowledgeBaseData = await createKnowledgeBaseFromWebsite(
          websiteUrl,
          businessName,
          process.env.VAPI_API_KEY
        );
        
        if (knowledgeBaseData) {
          console.log(`✅ Knowledge base ready: ${knowledgeBaseData.knowledgeBaseId}`);
        } else {
          console.log('⚠️ Knowledge base creation failed, continuing without it');
        }
      } catch (kbError) {
        console.error('⚠️ Knowledge base error (non-blocking):', kbError.message);
      }
    }

    // ============================================
    // STEP 2: CREATE INDUSTRY-SPECIFIC VAPI ASSISTANT
    // ============================================
    console.log(`🤖 Creating industry-specific VAPI assistant for: ${industry}`);
    
    const assistant = await createIndustryAssistant(
      businessName,
      industry,
      knowledgeBaseData,
      formattedOwnerPhone,
      process.env.BACKEND_URL + '/webhook/vapi'
    );
    
    console.log(`✅ Industry assistant created: ${assistant.id}`);

    // ============================================
    // STEP 3: PROVISION LOCAL PHONE NUMBER
    // ============================================
    const phoneData = await provisionLocalPhone(
      businessCity,
      businessState,
      assistant.id,
      businessName
    );
    
    console.log(`✅ Phone provisioned: ${phoneData.number}`);

    // Configure phone webhook
    await configurePhoneWebhook(phoneData.id, assistant.id);

    // ============================================
    // STEP 4: CREATE CLIENT RECORD
    // ============================================
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
        email: email.toLowerCase(),
        industry: industry,
        vapi_assistant_id: assistant.id,
        vapi_phone_number: phoneData.number,
        knowledge_base_id: knowledgeBaseData?.knowledgeBaseId || null,
        subscription_status: 'trial',
        trial_ends_at: trialEndsAt,
        status: 'active',
        plan_type: 'starter',
        monthly_call_limit: 50,
        calls_this_month: 0,
        business_website: websiteUrl || null,
        referral_source: referralSource || null
      })
      .select()
      .single();

    if (clientError) {
      console.error('❌ Database error:', clientError);
      throw clientError;
    }

    console.log(`🎉 Client created successfully: ${newClient.business_name}`);

    // ============================================
    // STEP 5: CREATE USER RECORD
    // ============================================
    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        client_id: newClient.id,
        email: email.toLowerCase(),
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

    // ============================================
    // STEP 6: GENERATE PASSWORD TOKEN
    // ============================================
    const token = await createPasswordToken(newUser.id, email.toLowerCase());
    console.log(`✅ Password token generated`);

    // ============================================
    // STEP 7: SEND WELCOME EMAIL
    // ============================================
    console.log('📧 Sending welcome email...');
    
    try {
      const { error: emailError } = await resend.emails.send({
        from: 'CallBird <onboarding@callbirdai.com>',
        to: email,
        subject: 'Welcome to CallBird - Set Your Password',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { text-align: center; margin-bottom: 30px; }
              .logo { width: 150px; }
              .highlight-box { background: #f0f4ff; border-left: 4px solid #122092; padding: 20px; margin: 20px 0; border-radius: 4px; }
              .phone-number { font-size: 24px; font-weight: bold; color: #122092; }
              .btn { display: inline-block; background: #122092; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
              .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <img src="https://i.imgur.com/qwyQQW5.png" alt="CallBird" class="logo">
              </div>
              
              <h1>Welcome to CallBird, ${firstName}! 🎉</h1>
              
              <p>Your AI receptionist for <strong>${businessName}</strong> is ready to start answering calls.</p>
              
              <div class="highlight-box">
                <p style="margin: 0 0 10px 0;"><strong>Your AI Phone Number:</strong></p>
                <p class="phone-number">${phoneData.number}</p>
                <p style="margin: 10px 0 0 0; font-size: 14px;">Location: ${businessCity}, ${businessState}</p>
              </div>
              
              <p><strong>Next Steps:</strong></p>
              <ol>
                <li>Set your password to access your dashboard</li>
                <li>Forward your business line to your new AI number</li>
                <li>Start receiving call summaries instantly!</li>
              </ol>
              
              <center>
                <a href="https://app.callbirdai.com/auth/set-password?token=${token}" class="btn">
                  Set Your Password →
                </a>
              </center>
              
              <p>Your <strong>7-day free trial</strong> has started. No credit card required.</p>
              
              <div class="footer">
                <p>Questions? Reply to this email or call us at <a href="tel:+16783161454">(678) 316-1454</a></p>
                <p>© 2025 CallBird AI • Atlanta, GA</p>
              </div>
            </div>
          </body>
          </html>
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

    // ============================================
    // STEP 8: SEND WELCOME SMS VIA TELNYX
    // ============================================
    console.log('📱 Sending welcome SMS via Telnyx...');
    
    try {
      const smsSent = await sendWelcomeSMS(formattedOwnerPhone, businessName, phoneData.number);
      if (smsSent) {
        console.log('✅ Welcome SMS sent via Telnyx');
      } else {
        console.log('⚠️ Welcome SMS failed (non-blocking)');
      }
    } catch (smsError) {
      console.error('⚠️ SMS error (non-blocking):', smsError.message);

    // Send admin signup notification
    try {
      await sendAdminSignupNotification({
        businessName,
        ownerName,
        email,
        phone: formattedOwnerPhone,
        city: businessCity,
        state: businessState,
        industry,
        website: websiteUrl,
        referralSource,
        aiPhoneNumber: phoneData.number
      });
      console.log('✅ Admin signup notification sent');
    } catch (adminErr) {
      console.error('⚠️ Admin notification failed (non-blocking):', adminErr.message);
    }
    }

    // ============================================
    // STEP 9: CREATE STRIPE CUSTOMER
    // ============================================
    console.log('💳 Creating Stripe customer...');

    try {
      const stripeResponse = await fetch(`${process.env.BACKEND_URL}/api/webhooks/ghl-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email.toLowerCase(),
          contact_name: ownerName,
          business_name: businessName,
          phone: formattedOwnerPhone,
          client_id: newClient.id
        })
      });

      if (!stripeResponse.ok) {
        console.error('⚠️ Stripe customer creation failed (non-blocking)');
      } else {
        const stripeData = await stripeResponse.json();
        console.log('✅ Stripe customer created:', stripeData.stripe_customer_id);
      }
    } catch (stripeError) {
      console.error('⚠️ Stripe customer creation error (non-blocking):', stripeError.message);
    }

    console.log('🎉 Onboarding complete for:', businessName);

    // Return success response
    res.status(200).json({
      success: true,
      message: 'Account created successfully! Check your email to set your password.',
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
    console.error('❌ Signup error:', error);
    res.status(500).json({ 
      error: 'Signup failed', 
      message: 'Something went wrong. Please try again or contact support.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

module.exports = { handleNativeSignup };