const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
const { createKnowledgeBaseFromWebsite } = require('./website-scraper');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Industry-specific templates
const industryTemplates = {
  plumbing: {
    firstMessage: "Thanks for calling! I'm here to help with your plumbing needs. Could you tell me your name and what you need help with today?",
    voice: { provider: 'azure', voiceId: 'andrew' },
    transcriber: { provider: 'deepgram', model: 'nova-2' },
    model: {
      provider: 'openai',
      model: 'gpt-4',
      temperature: 0.7,
      systemPrompt: `You are a professional plumbing receptionist. Be friendly and helpful. Ask for:
1. Customer's name
2. Type of plumbing issue (drain, leak, water heater, etc.)
3. Urgency level (emergency or can wait)
4. Best callback number
5. If they want to schedule an appointment

Keep responses concise and professional.`
    }
  },
  hvac: {
    firstMessage: "Thanks for calling! I'm here to help with your heating and cooling needs. Could you tell me your name and what you need help with?",
    voice: { provider: 'azure', voiceId: 'andrew' },
    transcriber: { provider: 'deepgram', model: 'nova-2' },
    model: {
      provider: 'openai',
      model: 'gpt-4',
      temperature: 0.7,
      systemPrompt: `You are a professional HVAC receptionist. Be friendly and helpful. Ask for:
1. Customer's name
2. Type of HVAC issue (AC, heating, maintenance)
3. Urgency level
4. Best callback number
5. If they want to schedule an appointment

Keep responses concise and professional.`
    }
  },
  electrical: {
    firstMessage: "Thanks for calling! I'm here to help with your electrical needs. Could you tell me your name and what you need help with today?",
    voice: { provider: 'azure', voiceId: 'andrew' },
    transcriber: { provider: 'deepgram', model: 'nova-2' },
    model: {
      provider: 'openai',
      model: 'gpt-4',
      temperature: 0.7,
      systemPrompt: `You are a professional electrical service receptionist. Be friendly and helpful. Ask for:
1. Customer's name
2. Type of electrical issue
3. Safety concerns or urgency
4. Best callback number
5. If they want to schedule an appointment

Keep responses concise and professional.`
    }
  },
  roofing: {
    firstMessage: "Thanks for calling! I'm here to help with your roofing needs. Could you tell me your name and what you're looking for?",
    voice: { provider: 'azure', voiceId: 'andrew' },
    transcriber: { provider: 'deepgram', model: 'nova-2' },
    model: {
      provider: 'openai',
      model: 'gpt-4',
      temperature: 0.7,
      systemPrompt: `You are a professional roofing company receptionist. Be friendly and helpful. Ask for:
1. Customer's name
2. Type of roofing service (repair, replacement, inspection)
3. Urgency level
4. Best callback number
5. If they want to schedule an estimate

Keep responses concise and professional.`
    }
  },
  general: {
    firstMessage: "Thanks for calling! I'm here to help. Could you tell me your name and how I can assist you today?",
    voice: { provider: 'azure', voiceId: 'andrew' },
    transcriber: { provider: 'deepgram', model: 'nova-2' },
    model: {
      provider: 'openai',
      model: 'gpt-4',
      temperature: 0.7,
      systemPrompt: `You are a professional business receptionist. Be friendly and helpful. Ask for:
1. Customer's name
2. What they need help with
3. Urgency level
4. Best callback number
5. If they want to schedule an appointment

Keep responses concise and professional.`
    }
  }
};

// Validate area code (US only) with multiple fallbacks
function validateAreaCode(areaCode) {
  // Remove any non-digits
  const cleaned = String(areaCode).replace(/\D/g, '');
  
  // Must be exactly 3 digits
  if (cleaned.length !== 3) {
    console.log(`⚠️ Invalid area code length: ${areaCode}, will try common codes`);
    return '404';
  }
  
  // First digit can't be 0 or 1
  if (cleaned[0] === '0' || cleaned[0] === '1') {
    console.log(`⚠️ Invalid area code format: ${areaCode}, will try common codes`);
    return '404';
  }
  
  return cleaned;
}

// Create VAPI assistant with optional knowledge base
async function createVAPIAssistant(businessName, industry, websiteUrl) {
  const templateConfig = industryTemplates[industry] || industryTemplates.general;
  
  // Customize prompt with business name
  const customizedPrompt = templateConfig.model.systemPrompt.replace(
    'professional',
    `professional ${businessName}`
  );
  
  // Create knowledge base from website if provided
  let knowledgeBaseId = null;
  if (websiteUrl && websiteUrl.trim().length > 0) {
    console.log('🌐 Website URL provided, creating knowledge base...');
    knowledgeBaseId = await createKnowledgeBaseFromWebsite(
      websiteUrl,
      businessName,
      process.env.VAPI_API_KEY,
      process.env.JINA_API_KEY // Optional, can be null
    );
    
    if (knowledgeBaseId) {
      console.log(`✅ Knowledge base ready: ${knowledgeBaseId}`);
    } else {
      console.log('⚠️ Knowledge base creation failed, continuing without it');
    }
  } else {
    console.log('ℹ️ No website URL provided, skipping knowledge base');
  }
  
  // Build assistant configuration
  const newAssistant = {
    name: `${businessName} Assistant`,
    firstMessage: templateConfig.firstMessage,
    model: {
      ...templateConfig.model,
      knowledgeBaseId: knowledgeBaseId, // Link knowledge base if created
      messages: [{ 
        role: 'system', 
        content: knowledgeBaseId 
          ? `${customizedPrompt}\n\nWhen customers ask about ${businessName}'s services, pricing, location, or company information, use the knowledge base to provide accurate details from their website.`
          : customizedPrompt
      }]
    },
    voice: templateConfig.voice,
    transcriber: templateConfig.transcriber,
    serverUrl: process.env.VAPI_WEBHOOK_URL,
    serverUrlSecret: process.env.VAPI_WEBHOOK_SECRET,
    // Structured data extraction
    analysisPlan: {
      structuredDataPlan: {
        enabled: true,
        schema: {
          type: "object",
          properties: {
            customerName: {
              type: "string",
              description: "Customer's full name"
            },
            customerPhone: {
              type: "string",
              description: "Customer's phone number if provided"
            },
            urgency: {
              type: "string",
              enum: ["HIGH", "MEDIUM", "NORMAL"],
              description: "Urgency level of the request"
            },
            serviceType: {
              type: "string",
              description: "Type of service they need"
            },
            appointmentRequested: {
              type: "boolean",
              description: "Whether they requested an appointment"
            }
          },
          required: ["customerName", "urgency"]
        },
        messages: [{
          role: "system",
          content: `Extract the following information from the call transcript:
- Customer's full name (look for "my name is", "this is", "I'm" followed by their name)
- Customer's phone number if they provided it (in any format)
- Type of service they need (be specific: "drain cleaning", "water heater repair", etc.)
- Urgency level (emergency, urgent, routine, or inquiry)
- Whether they requested an appointment

Only extract information that was clearly stated. If not mentioned, leave blank.`
        }],
        timeoutSeconds: 30
      }
    }
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

// Purchase VAPI phone number with fallback to suggested area codes
async function provisionVAPIPhone(assistantId, areaCode) {
  const validAreaCode = validateAreaCode(areaCode);
  
  console.log(`📞 Attempting to purchase phone number with area code: ${validAreaCode}`);
  
  // Try requested area code first
  let lastError = null;
  const attemptedCodes = [validAreaCode];
  
  for (const code of attemptedCodes) {
    try {
      const buyResponse = await fetch('https://api.vapi.ai/phone-number/buy', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          areaCode: code,
          name: `Assistant Phone`,
          assistantId: assistantId,
          serverUrl: process.env.VAPI_WEBHOOK_URL
        })
      });
      
      if (buyResponse.ok) {
        const phoneData = await buyResponse.json();
        console.log(`✅ Phone number purchased: ${phoneData.number}`);
        
        // Log if we had to use a fallback
        if (code !== validAreaCode) {
          console.log(`ℹ️ Used fallback area code ${code} (requested: ${validAreaCode})`);
        }
        
        return phoneData.number;
      }
      
      // Parse error response
      const errorData = await buyResponse.json();
      lastError = errorData;
      
      console.log(`⚠️ Area code ${code} unavailable`);
      
      // Check if VAPI suggested alternative area codes
      if (errorData.message && errorData.message.includes('Try one of')) {
        const suggestedMatch = errorData.message.match(/Try one of ([\d, ]+)/);
        if (suggestedMatch) {
          const suggestedCodes = suggestedMatch[1]
            .split(',')
            .map(c => c.trim())
            .filter(c => c.length === 3);
          
          console.log(`💡 VAPI suggests trying: ${suggestedCodes.join(', ')}`);
          
          // Add suggested codes to attempt list (if not already tried)
          for (const suggested of suggestedCodes) {
            if (!attemptedCodes.includes(suggested)) {
              attemptedCodes.push(suggested);
            }
          }
        }
      }
      
    } catch (error) {
      console.error(`❌ Error attempting area code ${code}:`, error.message);
      lastError = error;
    }
  }
  
  // If we've exhausted all attempts, throw error
  throw new Error(
    `Failed to purchase phone number. Attempted area codes: ${attemptedCodes.join(', ')}. ` +
    `Last error: ${lastError?.message || JSON.stringify(lastError)}`
  );
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
                Your CallBird AI phone system for <strong>${businessName}</strong> is ready to start taking calls!
              </p>
              
              <!-- Phone Number Box -->
              <div style="background-color: #E8EAF6; border-left: 4px solid #111D96; padding: 20px; margin: 30px 0; border-radius: 4px;">
                <p style="margin: 0 0 10px; color: #666666; font-size: 14px; font-weight: 600;">YOUR AI PHONE NUMBER</p>
                <p style="margin: 0; color: #111D96; font-size: 24px; font-weight: 700;">${vapiPhone}</p>
              </div>
              
              <p style="margin: 0 0 30px; color: #333333; font-size: 16px; line-height: 1.6;">
                To access your dashboard and view incoming calls, please set your password:
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${setPasswordUrl}" style="display: inline-block; padding: 16px 40px; background-color: #F8B828; color: #111D96; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                      Set Your Password
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
                This link will expire in 24 hours for security purposes.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #FAFAF8; border-radius: 0 0 8px 8px; border-top: 1px solid #E8EAF6;">
              <p style="margin: 0 0 10px; color: #666666; font-size: 14px; line-height: 1.6;">
                <strong>What's Next?</strong>
              </p>
              <p style="margin: 0 0 20px; color: #666666; font-size: 14px; line-height: 1.6;">
                • Set your password and log in to your dashboard<br>
                • Test your AI phone number<br>
                • View real-time call transcripts<br>
                • Get instant notifications for new calls
              </p>
              
              <p style="margin: 0; color: #999999; font-size: 12px;">
                Questions? Reply to this email or visit our support center.
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
      throw new Error(`Resend API error: ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Email sent successfully:', data.id);
    return true;

  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
    return false;
  }
}

// Main GHL webhook handler
async function handleGHLSignup(req, res) {
  try {
    console.log('🎯 GHL webhook received');
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    const {
      firstName,
      lastName,
      email,
      phone,
      businessName,
      industry,
      areaCode,
      websiteUrl
    } = req.body;

    // Validation
    if (!email || !businessName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: email and businessName'
      });
    }

    console.log(`📋 Processing signup for: ${businessName} (${email})`);
    if (websiteUrl) {
      console.log(`🌐 Website: ${websiteUrl}`);
    }

    // ✅ DUPLICATE CHECK FIRST (before creating any resources)
    const { data: existingClient, error: checkError } = await supabase
      .from('clients')
      .select('id, business_name, email')
      .eq('email', email)
      .single();

    if (existingClient) {
      console.log('⚠️ Client already exists:', existingClient.business_name);
      return res.status(200).json({
        success: true,
        message: 'Client already exists',
        clientId: existingClient.id,
        duplicate: true
      });
    }

    // 1. Create VAPI Assistant (with knowledge base if website provided)
    console.log('🤖 Creating VAPI assistant...');
    const assistant = await createVAPIAssistant(businessName, industry, websiteUrl);
    console.log(`✅ Assistant created: ${assistant.id}`);

    // 2. Purchase Phone Number
    console.log('📞 Provisioning phone number...');
    const phoneNumber = await provisionVAPIPhone(assistant.id, areaCode);

    // 3. Create Client in Supabase
    console.log('💾 Creating client record...');
    const { data: newClient, error: clientError } = await supabase
      .from('clients')
      .insert([{
        business_name: businessName,
        email: email,
        owner_phone: phone,
        industry: industry || 'general',
        vapi_assistant_id: assistant.id,
        vapi_phone_number: phoneNumber,
        website_url: websiteUrl || null,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (clientError) {
      console.error('❌ Failed to create client:', clientError);
      throw clientError;
    }

    console.log(`✅ Client created: ${newClient.id}`);

    // 4. Create User Account
    console.log('👤 Creating user account...');
    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert([{
        email: email,
        client_id: newClient.id,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (userError) {
      console.error('❌ Failed to create user:', userError);
      throw userError;
    }

    console.log(`✅ User created: ${newUser.id}`);

    // 5. Generate Password Reset Token
    const token = require('crypto').randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const { error: tokenError } = await supabase
      .from('password_reset_tokens')
      .insert([{
        user_id: newUser.id,
        email: email,
        token: token,
        expires_at: expiresAt.toISOString(),
        used: false,
        created_at: new Date().toISOString()
      }]);

    if (tokenError) {
      console.error('❌ Failed to create token:', tokenError);
      throw tokenError;
    }

    console.log('✅ Password reset token generated');

    // 6. Send Welcome Email
    console.log('📧 Sending welcome email...');
    const emailSent = await sendWelcomeEmail(
      email,
      firstName || 'there',
      businessName,
      phoneNumber,
      token
    );

    if (emailSent) {
      console.log('✅ Welcome email sent successfully');
    } else {
      console.log('⚠️ Welcome email failed to send');
    }

    // Success response
    return res.status(200).json({
      success: true,
      message: 'Client onboarding complete',
      data: {
        clientId: newClient.id,
        userId: newUser.id,
        assistantId: assistant.id,
        phoneNumber: phoneNumber,
        websiteUrl: websiteUrl || null,
        knowledgeBaseCreated: !!assistant.model?.knowledgeBaseId,
        emailSent: emailSent
      }
    });

  } catch (error) {
    console.error('❌ GHL webhook error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

module.exports = { handleGHLSignup };