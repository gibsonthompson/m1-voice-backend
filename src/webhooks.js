const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

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
              <li><strong>Growth:</strong> $79/month - 500 calls</li>
              <li><strong>Pro:</strong> $199/month - 2000 calls</li>
            </ul>
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://callbird-dashboard.vercel.app/billing" 
                 style="background: #111D96; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
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
              <li><strong>Growth:</strong> $79/month - 500 calls</li>
              <li><strong>Pro:</strong> $199/month - 2000 calls</li>
            </ul>
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://callbird-dashboard.vercel.app/billing" 
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
// PHONE & GHL HELPER FUNCTIONS
// ============================================

// Helper: Format phone number to E.164 format
function formatPhoneE164(phone) {
  if (!phone) return null;
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Handle different lengths
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11) {
    return `+${digits}`;
  }
  
  // If already formatted correctly
  if (phone.startsWith('+') && phone.replace(/\D/g, '').length >= 10) {
    return phone.replace(/[^\d+]/g, '');
  }
  
  console.log(`⚠️ Invalid phone format: ${phone}`);
  return null;
}

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

// GHL: Search for contact by phone number
async function findGHLContact(phone) {
  try {
    console.log('🔍 Searching for GHL contact:', phone);
    
    const response = await axios.get(
      `https://services.leadconnectorhq.com/contacts/search/duplicate`,
      {
        params: {
          locationId: process.env.GHL_LOCATION_ID,
          number: phone
        },
        headers: {
          'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
          'Version': '2021-07-28'
        }
      }
    );
    
    if (response.data && response.data.contact) {
      console.log('✅ Contact found:', response.data.contact.id);
      return response.data.contact.id;
    }
    
    console.log('⚠️ Contact not found');
    return null;
  } catch (error) {
    console.error('❌ Error searching contact:', error.response?.data || error.message);
    return null;
  }
}

// GHL: Create new contact
async function createGHLContact(phone, name = null) {
  try {
    console.log('📝 Creating GHL contact:', phone);
    
    const contactData = {
      locationId: process.env.GHL_LOCATION_ID,
      phone: phone,
      source: 'CallBird'
    };
    
    // Add name if provided
    if (name && name !== 'Unknown') {
      const nameParts = name.split(' ');
      contactData.firstName = nameParts[0];
      if (nameParts.length > 1) {
        contactData.lastName = nameParts.slice(1).join(' ');
      }
    }
    
    const response = await axios.post(
      'https://services.leadconnectorhq.com/contacts/',
      contactData,
      {
        headers: {
          'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        }
      }
    );
    
    const contactId = response.data.contact.id;
    console.log('✅ Contact created:', contactId);
    return contactId;
  } catch (error) {
    console.error('❌ Error creating contact:', error.response?.data || error.message);
    return null;
  }
}

// GHL: Send SMS to contact
async function sendGHLSMS(toPhone, message, businessOwnerName = null) {
  try {
    console.log('📱 Preparing to send SMS via GoHighLevel...');
    console.log('   To:', toPhone);
    console.log('   Message length:', message.length, 'chars');
    
    // Validate environment variables
    if (!process.env.GHL_API_KEY || !process.env.GHL_LOCATION_ID) {
      throw new Error('GHL_API_KEY or GHL_LOCATION_ID not configured');
    }
    
    // Format phone to E.164
    const formattedPhone = formatPhoneE164(toPhone);
    if (!formattedPhone) {
      throw new Error(`Invalid phone format: ${toPhone}`);
    }
    console.log('   Formatted phone:', formattedPhone);
    
    // Step 1: Search for existing contact
    let contactId = await findGHLContact(formattedPhone);
    
    // Step 2: Create contact if doesn't exist
    if (!contactId) {
      console.log('📝 Contact does not exist, creating...');
      contactId = await createGHLContact(formattedPhone, businessOwnerName);
      if (!contactId) {
        throw new Error('Failed to create contact');
      }
    }
    
    // Step 3: Send SMS using contactId
    console.log('📤 Sending SMS to contactId:', contactId);
    
    const response = await axios.post(
      'https://services.leadconnectorhq.com/conversations/messages',
      {
        type: 'SMS',
        contactId: contactId,
        message: message
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        }
      }
    );
    
    console.log('✅ SMS sent via GHL successfully!');
    console.log('   Conversation ID:', response.data.conversationId);
    console.log('   Message ID:', response.data.messageId || response.data.id);
    
    return true;
  } catch (error) {
    console.error('❌ GHL SMS error:', error.response?.data || error.message);
    
    // Log detailed error for debugging
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
    
    return false;
  }
}

// ============================================
// TRANSCRIPT EXTRACTION FUNCTIONS
// ============================================

// Extract customer name from transcript
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

// Extract phone number from transcript
function extractPhoneNumber(transcript) {
  const phonePattern = /(\+?1?\s*\(?[2-9]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{4})/;
  const match = transcript.match(phonePattern);
  if (match) {
    const cleaned = match[1].replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.substring(0,3)}) ${cleaned.substring(3,6)}-${cleaned.substring(6)}`;
    }
    return cleaned;
  }
  return null;
}

// Extract email from transcript
function extractEmail(transcript) {
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
  const match = transcript.match(emailPattern);
  return match ? match[0] : null;
}

// Detect urgency level
function detectUrgency(transcript) {
  const lowerTranscript = transcript.toLowerCase();
  
  const emergencyWords = ['emergency', 'urgent', 'asap', 'immediately', 'right now', 'critical', 'serious'];
  const hasEmergency = emergencyWords.some(word => lowerTranscript.includes(word));
  if (hasEmergency) return 'HIGH';
  
  const mediumWords = ['soon', 'quickly', 'today', 'this week'];
  const hasMedium = mediumWords.some(word => lowerTranscript.includes(word));
  if (hasMedium) return 'MEDIUM';
  
  return 'NORMAL';
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
      
      // Get the actual phone number
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
      
      // ============================================
      // 🆕 HARD BLOCK: CHECK CALL LIMITS BEFORE PROCESSING
      // ============================================
      const currentCallCount = client.calls_this_month || 0;
      const callLimit = client.monthly_call_limit || 100;
      
      console.log(`📊 Current usage: ${currentCallCount}/${callLimit} calls`);
      
      if (currentCallCount >= callLimit) {
        console.log(`🚫 CALL BLOCKED: ${client.business_name} has reached limit`);
        console.log(`   Usage: ${currentCallCount}/${callLimit}`);
        console.log(`   Plan: ${client.plan_type}`);
        
        // Send limit reached email if this is the first blocked call
        if (currentCallCount === callLimit) {
          console.log('📧 Sending limit reached notification...');
          await sendLimitReachedEmail(client, callLimit);
        }
        
        // Return success to VAPI but don't process the call
        return res.status(200).json({ 
          received: true,
          blocked: true,
          reason: 'Monthly call limit reached',
          currentUsage: currentCallCount,
          limit: callLimit,
          message: `Client ${client.business_name} has used all ${callLimit} calls for this billing period`
        });
      }
      
      console.log(`✅ Within limit, processing call...`);
      
      // ============================================
      // CONTINUE WITH NORMAL CALL PROCESSING
      // ============================================
      const transcript = message.transcript || '';
      const callerPhone = call.customer?.number || 'Unknown';
      
      // Use VAPI's analysis if available
      const analysis = message.analysis || {};
      const customerName = analysis.structuredData?.customerName || 
                          extractCustomerName(transcript);
      const customerPhone = analysis.structuredData?.customerPhone || 
                           extractPhoneNumber(transcript) || 
                           callerPhone;
      const customerEmail = extractEmail(transcript);
      const urgency = analysis.structuredData?.urgency || 
                     detectUrgency(transcript);
      const serviceType = analysis.structuredData?.serviceType || null;
      
      // Build smart summary
      let aiSummary = '';
      if (customerName && customerName !== 'Unknown') {
        aiSummary = `${customerName} called`;
      } else {
        aiSummary = 'Customer called';
      }
      if (serviceType) {
        aiSummary += ` about ${serviceType}`;
      }
      if (analysis.structuredData?.appointmentRequested) {
        aiSummary += ' - requested appointment';
      }
      if (urgency === 'HIGH' || urgency === 'high') {
        aiSummary += ' (URGENT)';
      }
      if (customerPhone && customerPhone !== 'Unknown') {
        aiSummary += `. Contact: ${customerPhone}`;
      }
      aiSummary = aiSummary.trim() + '.';

      // ============================================
      // 🎵 EXTRACT RECORDING URL FROM VAPI
      // ============================================
      // VAPI can send recording URL in multiple places
      const recordingUrl = 
        message.recordingUrl ||           // Top level
        message.artifact?.recordingUrl || // In artifact
        call.recordingUrl ||              // In call object
        message.recording?.url ||         // In recording object
        null;
      
      if (recordingUrl) {
        console.log('🎵 Recording URL found:', recordingUrl);
      } else {
        console.log('⚠️ No recording URL in webhook payload');
      }

      // Save to database
      const callRecord = {
        client_id: client.id,
        customer_name: customerName,
        customer_phone: customerPhone,
        ai_summary: aiSummary,
        transcript: transcript,
        recording_url: recordingUrl, // 🆕 Save recording URL
        created_at: new Date().toISOString()
      };
      
      console.log('💾 Saving call to Supabase...');
      console.log('   Customer:', customerName);
      console.log('   Phone:', customerPhone);
      console.log('   Urgency:', urgency);
      
      const { data: insertedCall, error: insertError } = await supabase
        .from('calls')
        .insert([callRecord])
        .select();
      
      if (insertError) {
        console.error('❌ Error inserting call:', insertError);
        return res.status(500).json({ error: 'Failed to save call' });
      }
      
      console.log('✅ Call saved successfully');
      
      // ============================================
      // TRACK CALL USAGE & CHECK LIMITS
      // ============================================
      console.log('📊 Tracking call usage...');
      
      try {
        // Increment call counter
        const newCallCount = currentCallCount + 1;
        
        await supabase
          .from('clients')
          .update({ calls_this_month: newCallCount })
          .eq('id', client.id);
        
        console.log(`✅ Call count updated: ${newCallCount}/${callLimit}`);
        
        // Check if approaching limit (80%)
        const usagePercent = (newCallCount / callLimit) * 100;
        if (usagePercent >= 80 && usagePercent < 100) {
          console.log(`⚠️ Client ${client.email} at ${usagePercent.toFixed(0)}% of call limit`);
          
          // Send warning email at exactly 80%
          if (newCallCount === Math.floor(callLimit * 0.8)) {
            await sendUsageWarningEmail(client, newCallCount, callLimit);
          }
        }
        
        // Check if limit just reached (100%)
        if (newCallCount >= callLimit) {
          console.log(`🚨 Client ${client.email} reached call limit!`);
          
          // Send limit reached email (only once at exactly the limit)
          if (newCallCount === callLimit) {
            await sendLimitReachedEmail(client, callLimit);
          }
        }
      } catch (usageError) {
        console.error('⚠️ Usage tracking error (non-blocking):', usageError.message);
      }
      
      // ============================================
      // SEND SMS NOTIFICATION
      // ============================================
      let smsSent = false;
      
      if (client.owner_phone) {
        console.log('📱 Preparing SMS notification via GHL...');
        console.log('   Raw owner_phone from DB:', client.owner_phone);
        
        // Format phone number to E.164
        const formattedPhone = formatPhoneE164(client.owner_phone);
        console.log('   Formatted to E.164:', formattedPhone);
        
        if (!formattedPhone) {
          console.log('❌ Could not format owner phone number:', client.owner_phone);
        } else {
          // Build SMS message
          let smsMessage = `🔔 New Call - ${client.business_name}\n\n`;
          smsMessage += `Customer: ${customerName}\n`;
          smsMessage += `Phone: ${customerPhone}\n`;
          if (customerEmail) {
            smsMessage += `Email: ${customerEmail}\n`;
          }
          if (urgency === 'HIGH') {
            smsMessage += `⚠️ Urgency: HIGH\n`;
          }
          smsMessage += `\nSummary: ${aiSummary}\n\n`;
          smsMessage += `View full details in your CallBird dashboard.`;
          
          console.log('📝 SMS message prepared');
          
          // Send via GHL (with business owner's first name for contact creation)
          const ownerFirstName = client.business_name ? client.business_name.split(' ')[0] : null;
          smsSent = await sendGHLSMS(formattedPhone, smsMessage, ownerFirstName);
          
          if (smsSent) {
            console.log('✅ SMS notification sent successfully via GHL');
          } else {
            console.log('⚠️ SMS notification failed via GHL');
          }
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
        recordingUrl: recordingUrl, // 🆕 Return recording URL in response
        extractedData: {
          customerName,
          customerPhone,
          customerEmail,
          urgency,
          summary: aiSummary
        }
      });
    }
    
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    return res.status(500).json({ error: error.message });
  }
}

module.exports = { handleVapiWebhook };