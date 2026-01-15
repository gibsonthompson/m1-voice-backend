const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const { sendTelnyxSMS, sendCallNotificationSMS, formatPhoneE164, formatPhoneDisplay } = require('./telnyx-sms');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ============================================
// EMAIL HELPER FUNCTIONS
// ============================================
async function sendUsageWarningEmail(client, currentCalls, limit) {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'CallBird <notifications@callbirdai.com>',
        to: [client.email],
        subject: '⚠️ CallBird: 80% of Monthly Calls Used',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #F59E0B;">You're approaching your call limit</h2>
            <p>Hi ${client.contact_name || client.business_name},</p>
            <p>You've used <strong>${currentCalls} of ${limit} calls</strong> (${Math.round((currentCalls/limit)*100)}%) this month.</p>
            <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 16px; margin: 20px 0;">
              <p style="margin: 0;"><strong>📊 Usage: ${currentCalls}/${limit} calls</strong></p>
            </div>
            <p><strong>Upgrade to avoid service interruption:</strong></p>
            <ul>
              <li><strong>Starter:</strong> $49/month - 50 calls</li>
              <li><strong>Professional:</strong> $99/month - 300 calls</li>
              <li><strong>Enterprise:</strong> $197/month - Unlimited calls</li>
            </ul>
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://app.callbirdai.com/upgrade-required" 
                 style="background: #122092; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                Upgrade Plan
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">Your plan resets at the start of next month.</p>
          </div>
        `
      })
    });

    if (response.ok) {
      console.log('✅ Usage warning email sent');
      return true;
    } else {
      console.error('❌ Failed to send usage warning email');
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to send usage warning email:', error);
    return false;
  }
}

async function sendLimitReachedEmail(client, limit) {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'CallBird <notifications@callbirdai.com>',
        to: [client.email],
        subject: '🚨 CallBird: Monthly Call Limit Reached',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">You've reached your monthly call limit</h2>
            <p>Hi ${client.contact_name || client.business_name},</p>
            <p>You've used all <strong>${limit} calls</strong> included in your current plan.</p>
            <div style="background: #FEF2F2; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0;">
              <p style="margin: 0; color: #991b1b;"><strong>⚠️ Additional calls are now being blocked</strong></p>
            </div>
            <p><strong>Upgrade now to resume service:</strong></p>
            <ul>
              <li><strong>Starter:</strong> $49/month - 50 calls</li>
              <li><strong>Professional:</strong> $99/month - 300 calls</li>
              <li><strong>Enterprise:</strong> $197/month - Unlimited calls</li>
            </ul>
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://app.callbirdai.com/upgrade-required" 
                 style="background: #dc2626; color: white; padding: 14px 36px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
                Upgrade Now
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">Your call count resets at the start of next billing cycle.</p>
          </div>
        `
      })
    });

    if (response.ok) {
      console.log('✅ Limit reached email sent');
      return true;
    } else {
      console.error('❌ Failed to send limit reached email');
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to send limit reached email:', error);
    return false;
  }
}

// ============================================
// VAPI HELPER FUNCTIONS
// ============================================

// Get VAPI phone number from phoneNumberId
async function getPhoneNumberFromVapi(phoneNumberId) {
  try {
    const response = await axios.get(
      `https://api.vapi.ai/phone-number/${phoneNumberId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.VAPI_API_KEY}`
        }
      }
    );
    return response.data.number;
  } catch (error) {
    console.error('❌ Error fetching phone number from VAPI:', error.message);
    return null;
  }
}

// ============================================
// TRANSCRIPT EXTRACTION FUNCTIONS (FALLBACKS)
// ============================================

function extractCustomerName(transcript) {
  const patterns = [
    /my name is (\w+(?:\s+\w+)?)/i,
    /this is (\w+(?:\s+\w+)?)/i,
    /I'm (\w+(?:\s+\w+)?)/i,
    /I am (\w+(?:\s+\w+)?)/i,
    /speaking with (\w+(?:\s+\w+)?)/i,
    /call me (\w+(?:\s+\w+)?)/i,
  ];

  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      const excludeWords = ['calling', 'interested', 'looking', 'trying', 'hoping', 'wondering'];
      if (!excludeWords.some(word => name.toLowerCase().includes(word))) {
        return name;
      }
    }
  }
  
  return 'Unknown';
}

function extractPhoneNumber(transcript) {
  const phonePattern = /(\+?1?\s*\(?[2-9]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{4})/;
  const match = transcript.match(phonePattern);
  if (match) {
    return formatPhoneDisplay(match[1]);
  }
  return null;
}

function extractEmail(transcript) {
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
  const match = transcript.match(emailPattern);
  return match ? match[0] : null;
}

function detectUrgency(transcript) {
  const lowerTranscript = transcript.toLowerCase();
  
  const emergencyWords = ['emergency', 'urgent', 'asap', 'immediately', 'right now', 'critical', 'serious'];
  const hasEmergency = emergencyWords.some(word => lowerTranscript.includes(word));
  if (hasEmergency) return 'high';
  
  const mediumWords = ['soon', 'quickly', 'today', 'this week'];
  const hasMedium = mediumWords.some(word => lowerTranscript.includes(word));
  if (hasMedium) return 'medium';
  
  return 'routine';
}

// ============================================
// AI-POWERED SUMMARY & DATA EXTRACTION
// ============================================
async function generateAISummaryAndExtractData(transcript, industry, callerPhone) {
  console.log('🤖 Generating AI-powered summary using Claude API');
  
  const industryGuidance = {
    home_services: 'Focus on: the specific problem or issue, property location if mentioned, urgency level, and what specific service is needed.',
    medical: 'Focus on: appointment type, existing vs new patient status, general reason for visit (HIPAA-compliant), urgency level.',
    retail: 'Focus on: specific products discussed, customer intent, product details or specifications mentioned, and visit plans.',
    professional_services: 'Focus on: general matter type (no confidential details), whether new or existing client, urgency or deadlines.',
    restaurants: 'Focus on: reservation vs takeout/delivery, party size and date/time if reservation, specific menu items if order.',
    salon_spa: 'Focus on: service type, preferred stylist/technician, appointment date/time preferences, new vs returning client.'
  };

  const prompt = `You are analyzing a phone call transcript for a ${industry} business.

Your task is to extract structured data AND generate a professional summary.

Call Transcript:
${transcript}

Caller's Phone Number: ${callerPhone}

Instructions:
1. Extract the customer's name from the transcript
2. Extract the customer's phone number if they provide one (otherwise use the caller's number provided above)
3. Extract the customer's email if mentioned
4. Assess urgency level based on keywords
5. Generate a professional 2-3 sentence summary focusing on: ${industryGuidance[industry] || 'what the customer needs and next steps'}

CRITICAL: Respond with ONLY a valid JSON object. No markdown, no backticks, no explanations.

JSON Format:
{
  "customerName": "string (or 'Unknown' if not found)",
  "customerPhone": "string (format as (XXX) XXX-XXXX if US number)",
  "customerEmail": "string or null",
  "urgency": "emergency|high|medium|routine",
  "summary": "2-3 sentence professional summary with specific details"
}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        temperature: 0.3,
        messages: [{
          role: "user",
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Claude API error:', response.status, errorText);
      throw new Error(`Claude API failed: ${response.status}`);
    }

    const data = await response.json();
    let responseText = data.content[0].text.trim();
    
    responseText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    const extractedData = JSON.parse(responseText);
    
    console.log('✅ AI-extracted data:', {
      name: extractedData.customerName,
      phone: extractedData.customerPhone,
      urgency: extractedData.urgency
    });
    
    return extractedData;
  } catch (error) {
    console.error('❌ Failed to generate AI summary:', error.message);
    
    // Fallback to regex extraction
    console.log('⚠️ Using fallback extraction');
    
    const customerName = extractCustomerName(transcript);
    const rawCustomerPhone = extractPhoneNumber(transcript) || callerPhone;
    const customerPhone = formatPhoneDisplay(rawCustomerPhone);
    const customerEmail = extractEmail(transcript);
    const urgency = detectUrgency(transcript);
    
    let fallbackSummary = `${customerName} (${customerPhone}) called`;
    if (urgency === 'high' || urgency === 'emergency') {
      fallbackSummary += ' with an URGENT request';
    }
    fallbackSummary += ` regarding ${industry.replace('_', ' ')} services. Team should follow up promptly.`;
    
    return {
      customerName,
      customerPhone,
      customerEmail,
      urgency,
      summary: fallbackSummary
    };
  }
}

// ============================================
// MAIN WEBHOOK HANDLER
// ============================================
async function handleVapiWebhook(req, res) {
  try {
    console.log('📞 VAPI webhook received');
    
    const message = req.body.message;
    
    if (message?.type === 'end-of-call-report') {
      const call = message.call;
      const phoneNumberId = call.phoneNumberId;
      
      const phoneNumber = await getPhoneNumberFromVapi(phoneNumberId);
      if (!phoneNumber) {
        console.log('⚠️ Could not get phone number from VAPI');
        return res.status(200).json({ received: true });
      }
      
      console.log('📱 Phone number:', phoneNumber);
      
      // Find client by VAPI phone number
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('vapi_phone_number', phoneNumber)
        .single();
      
      if (clientError || !client) {
        console.log('⚠️ No client found for phone:', phoneNumber);
        return res.status(200).json({ received: true });
      }
      
      console.log('✅ Client found:', client.business_name);
      
      // Check subscription status
      const validStatuses = ['active', 'trial'];
      const subscriptionStatus = client.subscription_status;
      
      if (!validStatuses.includes(subscriptionStatus)) {
        console.log(`🚫 CALL BLOCKED: ${client.business_name} subscription not active`);
        return res.status(200).json({ 
          received: true,
          blocked: true,
          reason: 'Subscription not active'
        });
      }
      
      // Check call limits
      const currentCallCount = client.calls_this_month || 0;
      const callLimit = client.monthly_call_limit || 100;
      
      if (currentCallCount >= callLimit) {
        console.log(`🚫 CALL BLOCKED: ${client.business_name} has reached limit`);
        
        if (currentCallCount === callLimit) {
          await sendLimitReachedEmail(client, callLimit);
        }
        
        return res.status(200).json({ 
          received: true,
          blocked: true,
          reason: 'Monthly call limit reached'
        });
      }
      
      // Extract data & generate summary
      const transcript = message.transcript || '';
      const callerPhone = call.customer?.number || 'Unknown';
      
      const aiData = await generateAISummaryAndExtractData(
        transcript,
        client.industry,
        callerPhone
      );
      
      const { customerName, customerPhone, customerEmail, urgency, summary: aiSummary } = aiData;

      // Extract recording URL
      const recordingUrl = 
        message.recordingUrl ||
        message.artifact?.recordingUrl ||
        call.recordingUrl ||
        null;

      // Save to database
      const callRecord = {
        client_id: client.id,
        customer_name: customerName,
        customer_phone: customerPhone,
        ai_summary: aiSummary,
        transcript: transcript,
        recording_url: recordingUrl,
        created_at: new Date().toISOString()
      };
      
      const { data: insertedCall, error: insertError } = await supabase
        .from('calls')
        .insert([callRecord])
        .select();
      
      if (insertError) {
        console.error('❌ Error inserting call:', insertError);
        return res.status(500).json({ error: 'Failed to save call' });
      }
      
      console.log('✅ Call saved successfully');
      
      // Track call usage
      const newCallCount = currentCallCount + 1;
      const isFirstCall = newCallCount === 1;
      
      const updateData = { calls_this_month: newCallCount };
      if (isFirstCall) {
        updateData.first_call_received = true;
        console.log('🎉 FIRST CALL EVER for client:', client.business_name);
      }
      
      await supabase
        .from('clients')
        .update(updateData)
        .eq('id', client.id);
      
      // Check usage thresholds
      const usagePercent = (newCallCount / callLimit) * 100;
      if (usagePercent >= 80 && usagePercent < 100) {
        if (newCallCount === Math.floor(callLimit * 0.8)) {
          await sendUsageWarningEmail(client, newCallCount, callLimit);
        }
      }
      
      if (newCallCount >= callLimit) {
        if (newCallCount === callLimit) {
          await sendLimitReachedEmail(client, callLimit);
        }
      }
      
      // ============================================
      // SEND SMS NOTIFICATION VIA TELNYX (REPLACES GHL)
      // ============================================
      let smsSent = false;
      
      if (client.owner_phone) {
        console.log('📱 Sending SMS notification via Telnyx...');
        
        smsSent = await sendCallNotificationSMS(client, aiData);
        
        if (smsSent) {
          console.log('✅ SMS notification sent via Telnyx');
        } else {
          console.log('⚠️ SMS notification failed');
        }
      } else {
        console.log('⚠️ No owner_phone configured for this client');
      }
      
      return res.status(200).json({ 
        received: true,
        saved: true,
        callId: insertedCall[0]?.id,
        smsSent: smsSent,
        usageTracked: true,
        firstCall: isFirstCall,
        recordingUrl: recordingUrl,
        extractedData: aiData
      });
    }
    
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    return res.status(500).json({ error: error.message });
  }
}

module.exports = { 
  handleVapiWebhook,
  sendTelnyxSMS,
  formatPhoneE164,
  formatPhoneDisplay
};