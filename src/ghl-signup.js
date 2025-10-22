const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
const crypto = require('crypto');

// Initialize Supabase with SERVICE KEY
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// VAPI Template IDs by industry
const VAPI_TEMPLATES = {
  'home_services': '6f10579e-1a4d-4ad2-bbb0-8d4acb577569',
  'medical': '1c0ace33-8229-4af4-9be8-d2beb955fa82',
  'retail': '0b78f485-d860-401c-abc5-4283510fe19c',
  'professional_services': '8c6b9048-c6f8-40e0-879f-58e060780b7e',
  'restaurants': '360775b7-9573-45a7-9789-595b8acf25d9'
};

// Map GHL industry strings to template keys
const INDUSTRY_MAP = {
  'Home Services (plumbing, HVAC, contractors)': 'home_services',
  'Medical/Dental': 'medical',
  'Retail/E-commerce': 'retail',
  'Professional Services (legal, accounting)': 'professional_services',
  'Restaurants/Food Service': 'restaurants'
};

// Format phone number to E.164 standard (+1XXXXXXXXXX)
function formatPhoneE164(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`;
  return `+${digits}`;
}

// Validate and clean area code (must be 3 digits)
function validateAreaCode(areaCode) {
  if (!areaCode) return '404';
  const cleaned = String(areaCode).replace(/\D/g, '');
  if (cleaned.length === 3) return cleaned;
  return '404';
}

// Generate secure random token for password reset
function generatePasswordToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Store password reset token in database
async function createPasswordToken(userId, email) {
  const token = generatePasswordToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // Expires in 24 hours
  
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

// Fetch VAPI assistant template configuration
async function getVAPITemplate(templateId) {
  const response = await fetch(`https://api.vapi.ai/assistant/${templateId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get VAPI template: ${errorText}`);
  }
  
  return await response.json();
}

// Create customized VAPI assistant from template
async function createVAPIAssistant(templateConfig, businessName) {
  // Customize the system prompt with business details
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
    const errorText = await response.text();
    throw new Error(`Failed to create VAPI assistant: ${errorText}`);
  }
  
  return await response.json();
}

// Purchase VAPI phone number with specified area code
async function provisionVAPIPhone(assistantId, areaCode) {
  const validAreaCode = validateAreaCode(areaCode);
  
  console.log(`📞 Purchasing phone number with area code: ${validAreaCode}`);
  
  const buyResponse = await fetch('https://api.vapi.ai/phone-number/buy', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      areaCode: validAreaCode,
      name: `Assistant Phone`,
      assistantId: assistantId
    })
  });
  
  if (!buyResponse.ok) {
    const errorText = await buyResponse.text();
    throw new Error(`Failed to buy phone number: ${errorText}`);
  }
  
  const phoneData = await buyResponse.json();
  console.log(`✅ Phone number purchased: ${phoneData.number}`);
  return phoneData.number;
}

// Send welcome email with password setup link via Resend
async function sendWelcomeEmail(email, firstName, businessName, vapiPhone, token) {
  const setPasswordUrl = `https://callbird-dashboard.vercel.app/auth/set-password?token=${token}`;
  
  console.log(`📧 Sending welcome email FROM hello@callbirdai.com TO ${email}`);
  
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'CallBird <hello@callbirdai.com>',
        to: email,
        subject: 'Welcome to CallBird - Set Your Password',
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #FAFAF8;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FAFAF8; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background-color: #111D96; border-radius: 8px 8px 0 0;">
              <img src="https://i.imgur.com/MqnUvNC.png" alt="CallBird" style="width: 120px; height: auto;">
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h1 style="margin: 0 0 20px; color: #111D96; font-size: 28px; font-weight: 600;">Welcome to CallBird! 🎉</h1>
              
              <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                Hi ${firstName},
              </p>
              
              <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                Your CallBird account for <strong>${businessName}</strong> is ready and your AI assistant is live!
              </p>
              
              <!-- Phone Number Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0; background-color: #E8EAF6; border-radius: 6px;">
                <tr>
                  <td style="padding: 20px; text-align: center;">
                    <div style="color: #666666; font-size: 14px; margin-bottom: 5px;">Your AI Assistant Phone Number</div>
                    <div style="color: #111D96; font-size: 24px; font-weight: 600;">${vapiPhone}</div>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 20px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                <strong>Next Step:</strong> Set your password to access your dashboard and view call transcripts.
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${setPasswordUrl}" style="display: inline-block; padding: 16px 40px; background-color: #F8B828; color: #000000; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                      Set Your Password →
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 20px 0 10px; color: #666666; font-size: 14px; text-align: center;">
                This link expires in 24 hours
              </p>
              
              <!-- Features Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0; border-top: 2px solid #E8EAF6; padding-top: 30px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 15px; color: #111D96; font-size: 16px; font-weight: 600;">What you can do in your dashboard:</p>
                    <ul style="margin: 0; padding-left: 20px; color: #333333; font-size: 15px; line-height: 1.8;">
                      <li>View all call transcripts in real-time</li>
                      <li>See AI summaries of customer requests</li>
                      <li>Manage your business settings</li>
                      <li>Track urgent calls and appointments</li>
                    </ul>
                  </td>
                </tr>
              </table>
              
              <!-- Trial Notice -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td style="background-color: #FFF9E6; padding: 20px; border-radius: 6px; border-left: 4px solid #F8B828;">
                    <p style="margin: 0; color: #333333; font-size: 14px; line-height: 1.6;">
                      <strong>Your 7-day free trial starts now!</strong><br>
                      No credit card required. Cancel anytime.
                    </p>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
                Questions? Just reply to this email - we're here to help!
              </p>
              
              <p style="margin: 20px 0 0; color: #333333; font-size: 16px;">
                Welcome aboard! 🚀<br>
                <span style="color: #666666; font-size: 14px;">The CallBird Team</span>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px; text-align: center; background-color: #FAFAF8; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; color: #999999; font-size: 12px;">
                CallBird - AI-Powered Call Management<br>
                <a href="https://callbirdai.com" style="color: #111D96; text-decoration: none;">callbirdai.com</a>
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to send email:', errorText);
      throw new Error(`Email failed: ${errorText}`);
    }
    
    const result = await response.json();
    console.log(`✅ Email sent successfully to ${email} (Resend ID: ${result.id})`);
    
  } catch (error) {
    console.error('❌ Email error:', error);
    // Don't throw - we don't want email failure to block account creation
    // User can still use "forgot password" flow if email fails
  }
}

// Main webhook handler for GHL signups
async function handleGHLSignup(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  console.log('📥 GHL Webhook received:', req.body);
  
  try {
    // Extract and validate required fields from webhook
    const { email, first_name, phone, business_name, industry, area_code } = req.body;
    
    if (!email || !first_name || !phone || !business_name || !industry) {
      console.error('❌ Missing required fields');
      return res.status(400).json({ 
        error: 'Missing required fields',
        received: req.body
      });
    }
    
    // Format and validate data
    const formattedPhone = formatPhoneE164(phone);
    const industryKey = INDUSTRY_MAP[industry];
    
    if (!industryKey) {
      console.error('❌ Invalid industry:', industry);
      return res.status(400).json({ 
        error: 'Invalid industry',
        received: industry,
        valid_options: Object.keys(INDUSTRY_MAP)
      });
    }
    
    const validatedAreaCode = validateAreaCode(area_code);
    
    console.log('✅ Data validated:', { 
      email, 
      first_name, 
      formattedPhone, 
      business_name, 
      industryKey,
      area_code: validatedAreaCode 
    });
    
    // CRITICAL: Check for duplicates FIRST before creating any expensive resources
    console.log('🔍 Checking for existing accounts...');
    
    const { data: existingUser, error: userCheckError } = await supabase
      .from('users')
      .select('id, client_id')
      .eq('email', email)
      .single();
    
    if (existingUser) {
      console.log('⚠️ User already exists:', email);
      return res.status(200).json({ 
        success: false,
        message: 'An account already exists for this email address',
        user_id: existingUser.id,
        client_id: existingUser.client_id
      });
    }
    
    const { data: existingClient, error: clientCheckError } = await supabase
      .from('clients')
      .select('id, business_name')
      .eq('email', email)
      .single();
    
    if (existingClient) {
      console.log('⚠️ Client already exists:', email);
      return res.status(200).json({ 
        success: false,
        message: 'A business account already exists for this email address',
        client_id: existingClient.id,
        business_name: existingClient.business_name
      });
    }
    
    console.log('✅ No duplicates found - proceeding with account creation');
    
    // Get VAPI assistant template for the industry
    console.log(`🤖 Fetching VAPI template for industry: ${industryKey}`);
    const templateId = VAPI_TEMPLATES[industryKey];
    const templateConfig = await getVAPITemplate(templateId);
    console.log('✅ Template fetched');
    
    // Create customized VAPI assistant
    console.log('🛠️ Creating VAPI assistant...');
    const assistant = await createVAPIAssistant(templateConfig, business_name);
    console.log(`✅ Assistant created: ${assistant.id}`);
    
    // Purchase phone number and link to assistant
    console.log('📞 Provisioning phone number...');
    const vapiPhone = await provisionVAPIPhone(assistant.id, validatedAreaCode);
    console.log(`✅ Phone provisioned: ${vapiPhone}`);
    
    // Create client record in Supabase
    console.log('💾 Creating client record in database...');
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 7); // 7-day trial
    
    const { data: newClient, error: clientError } = await supabase
      .from('clients')
      .insert({
        email: email,
        business_name: business_name,
        industry: industryKey,
        phone_number: formattedPhone,
        owner_name: first_name,
        owner_phone: formattedPhone,
        vapi_assistant_id: assistant.id,
        vapi_phone_number: vapiPhone,
        status: 'trial',
        trial_ends_at: trialEndsAt.toISOString(),
        onboarding_completed: false,
        onboarding_step: 1
      })
      .select()
      .single();
    
    if (clientError) {
      console.error('❌ Failed to create client:', clientError);
      throw new Error(`Database error creating client: ${clientError.message}`);
    }
    
    console.log(`✅ Client created: ${newClient.id}`);
    
    // Create user record (for authentication)
    console.log('👤 Creating user record...');
    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        email: email,
        password_hash: null, // Will be set when user clicks password setup link
        first_name: first_name,
        client_id: newClient.id,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (userError) {
      console.error('❌ Failed to create user:', userError);
      throw new Error(`Database error creating user: ${userError.message}`);
    }
    
    console.log(`✅ User created: ${newUser.id}`);
    
    // Generate password setup token
    console.log('🔐 Generating password setup token...');
    const token = await createPasswordToken(newUser.id, email);
    console.log('✅ Token generated');
    
    // Send welcome email with password setup link
    console.log('📧 Sending welcome email...');
    await sendWelcomeEmail(email, first_name, business_name, vapiPhone, token);
    
    console.log('🎉 Account creation complete!');
    
    return res.status(200).json({
      success: true,
      client_id: newClient.id,
      user_id: newUser.id,
      vapi_assistant_id: assistant.id,
      vapi_phone: vapiPhone,
      area_code: validatedAreaCode,
      trial_ends_at: trialEndsAt.toISOString(),
      message: 'Account created successfully. Welcome email sent to customer.'
    });
    
  } catch (error) {
    console.error('❌ Webhook error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error', 
      message: error.message 
    });
  }
}

module.exports = { handleGHLSignup };