const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

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

// Send SMS via Telnyx
async function sendTelnyxSMS(toPhone, message) {
  try {
    console.log('📱 Sending SMS via Telnyx...');
    console.log('   To:', toPhone);
    console.log('   Message length:', message.length, 'chars');
    
    const response = await axios.post(
      'https://api.telnyx.com/v2/messages',
      {
        from: '+15055573160', // Your notification number
        to: toPhone,
        text: message
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.TELNYX_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ SMS sent successfully!');
    console.log('   Message ID:', response.data.data.id);
    return true;
  } catch (error) {
    console.error('❌ Telnyx SMS error:', error.response?.data || error.message);
    return false;
  }
}

// Extract customer name from transcript
function extractCustomerName(transcript) {
  const patterns = [
    /my name is (\w+(?:\s+\w+)?)/i,
    /this is (\w+(?:\s+\w+)?)/i,
    /I'm (\w+(?:\s+\w+)?)/i,
    /I am (\w+(?:\s+\w+)?)/i,
  ];
  
  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return 'Unknown';
}

// Extract phone number from transcript
function extractPhoneNumber(transcript) {
  const phonePattern = /(\+?1?\s*\(?[2-9]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{4})/;
  const match = transcript.match(phonePattern);
  return match ? match[1].replace(/\D/g, '') : null;
}

// Generate smart summary from transcript
function generateSmartSummary(transcript) {
  if (!transcript || transcript.length < 20) {
    return 'No summary available';
  }
  
  // Try to find key information
  const lowerTranscript = transcript.toLowerCase();
  
  // Extract name
  const name = extractCustomerName(transcript);
  
  // Extract phone
  const phone = extractPhoneNumber(transcript);
  
  // Look for urgency keywords
  const isUrgent = lowerTranscript.includes('emergency') || 
                   lowerTranscript.includes('urgent') || 
                   lowerTranscript.includes('asap');
  
  // Look for service keywords
  let service = null;
  if (lowerTranscript.includes('leak')) service = 'leak';
  else if (lowerTranscript.includes('drain') || lowerTranscript.includes('clog')) service = 'drain issue';
  else if (lowerTranscript.includes('water heater')) service = 'water heater';
  else if (lowerTranscript.includes('toilet')) service = 'toilet repair';
  else if (lowerTranscript.includes('sink')) service = 'sink repair';
  else if (lowerTranscript.includes('faucet')) service = 'faucet issue';
  
  // Build smart summary
  let summary = '';
  if (name && name !== 'Unknown') {
    summary += `${name} called`;
  } else {
    summary += 'Customer called';
  }
  
  if (service) {
    summary += ` about ${service}`;
  }
  
  if (isUrgent) {
    summary += ' (URGENT)';
  }
  
  if (summary.length > 20) {
    if (phone) summary += `. Contact: ${phone}`;
    return summary.trim() + '.';
  }
  
  // Fallback: take first meaningful sentence
  const cleaned = transcript.trim();
  const firstSentence = cleaned.split(/[.!?]/).filter(s => s.trim().length > 10)[0];
  
  if (firstSentence && firstSentence.length < 200) {
    return firstSentence.trim() + '.';
  }
  
  return cleaned.substring(0, 200) + (cleaned.length > 200 ? '...' : '');
}

// Main webhook handler
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

      const transcript = message.transcript || '';
      const callerPhone = call.customer?.number || 'Unknown';
      
      // Extract information
      const customerName = extractCustomerName(transcript);
      const customerPhone = extractPhoneNumber(transcript) || callerPhone;
      const aiSummary = generateSmartSummary(transcript);
      
      // Save to database
      const callRecord = {
        client_id: client.id,
        customer_name: customerName,
        customer_phone: customerPhone,
        ai_summary: aiSummary,
        transcript: transcript,
        created_at: new Date().toISOString()
      };

      console.log('💾 Saving call to Supabase...');

      const { data: insertedCall, error: insertError } = await supabase
        .from('calls')
        .insert([callRecord])
        .select();
      
      if (insertError) {
        console.error('❌ Error inserting call:', insertError);
        return res.status(500).json({ error: 'Failed to save call' });
      }
      
      console.log('✅ Call saved successfully');

      // Send SMS notification via Telnyx
      if (client.owner_phone) {
        console.log('📱 Preparing SMS notification...');
        
        const smsMessage = `🔔 New Call - ${client.business_name}

Customer: ${customerName}
Phone: ${customerPhone}

Summary: ${aiSummary}

View full details in your CallBird dashboard.`;

        const smsSent = await sendTelnyxSMS(client.owner_phone, smsMessage);
        
        if (smsSent) {
          console.log('✅ SMS notification sent to:', client.owner_phone);
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
        smsSent: !!client.owner_phone
      });
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    return res.status(500).json({ error: error.message });
  }
}

module.exports = { handleVapiWebhook };