const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Helper: Format phone number to E.164 format for Telnyx
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

// Send SMS via Telnyx
async function sendTelnyxSMS(toPhone, message) {
  try {
    console.log('📱 Sending SMS via Telnyx...');
    console.log('   To:', toPhone);
    console.log('   Message length:', message.length, 'chars');
    
    // DEBUG: Check API key
    const apiKey = process.env.TELNYX_API_KEY;
    console.log('🔍 DEBUG - API Key exists:', !!apiKey);
    console.log('🔍 DEBUG - API Key length:', apiKey?.length);
    console.log('🔍 DEBUG - API Key first 10 chars:', apiKey?.substring(0, 10));
    console.log('🔍 DEBUG - API Key last 4 chars:', apiKey?.substring(apiKey.length - 4));
    
    if (!apiKey) {
      throw new Error('TELNYX_API_KEY environment variable not set');
    }
    
    const response = await axios.post(
      'https://api.telnyx.com/v2/messages',
      {
        from: '+14046719089', // Your Telnyx number
        to: toPhone,
        text: message
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
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

// Extract customer name from transcript (works across all industries)
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
      // Filter out common false positives
      const excludeWords = ['calling', 'interested', 'looking', 'trying', 'hoping', 'wondering'];
      if (!excludeWords.some(word => name.toLowerCase().includes(word))) {
        return name;
      }
    }
  }
  
  return 'Unknown';
}

// Extract phone number from transcript (universal)
function extractPhoneNumber(transcript) {
  const phonePattern = /(\+?1?\s*\(?[2-9]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{4})/;
  const match = transcript.match(phonePattern);
  if (match) {
    const cleaned = match[1].replace(/\D/g, '');
    // Return formatted phone number
    if (cleaned.length === 10) {
      return `(${cleaned.substring(0,3)}) ${cleaned.substring(3,6)}-${cleaned.substring(6)}`;
    }
    return cleaned;
  }
  return null;
}

// Extract email from transcript (universal)
function extractEmail(transcript) {
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
  const match = transcript.match(emailPattern);
  return match ? match[0] : null;
}

// Detect urgency level (universal - works for all industries)
function detectUrgency(transcript) {
  const lowerTranscript = transcript.toLowerCase();
  
  // Emergency keywords
  const emergencyWords = ['emergency', 'urgent', 'asap', 'immediately', 'right now', 'critical', 'serious'];
  const hasEmergency = emergencyWords.some(word => lowerTranscript.includes(word));
  
  if (hasEmergency) return 'HIGH';
  
  // Medium urgency keywords
  const mediumWords = ['soon', 'quickly', 'today', 'this week'];
  const hasMedium = mediumWords.some(word => lowerTranscript.includes(word));
  
  if (hasMedium) return 'MEDIUM';
  
  return 'NORMAL';
}

// Generate smart summary from transcript (industry-agnostic)
function generateSmartSummary(transcript) {
  if (!transcript || transcript.length < 20) {
    return 'Customer called - no details captured';
  }
  
  const lowerTranscript = transcript.toLowerCase();
  
  // Extract key information
  const name = extractCustomerName(transcript);
  const phone = extractPhoneNumber(transcript);
  const email = extractEmail(transcript);
  const urgency = detectUrgency(transcript);
  
  // Look for common inquiry patterns (universal)
  let inquiryType = null;
  
  if (lowerTranscript.includes('question about') || lowerTranscript.includes('wondering about')) {
    inquiryType = 'inquiry';
  } else if (lowerTranscript.includes('appointment') || lowerTranscript.includes('schedule') || lowerTranscript.includes('book')) {
    inquiryType = 'appointment request';
  } else if (lowerTranscript.includes('price') || lowerTranscript.includes('cost') || lowerTranscript.includes('quote')) {
    inquiryType = 'pricing inquiry';
  } else if (lowerTranscript.includes('problem') || lowerTranscript.includes('issue') || lowerTranscript.includes('help')) {
    inquiryType = 'service request';
  } else if (lowerTranscript.includes('interested in') || lowerTranscript.includes('looking for')) {
    inquiryType = 'general inquiry';
  }
  
  // Build smart summary
  let summary = '';
  
  if (name && name !== 'Unknown') {
    summary += `${name} called`;
  } else {
    summary += 'Customer called';
  }
  
  if (inquiryType) {
    summary += ` with ${inquiryType}`;
  }
  
  if (urgency === 'HIGH') {
    summary += ' (URGENT)';
  }
  
  // Add contact info if available
  let contactInfo = [];
  if (phone) contactInfo.push(phone);
  if (email) contactInfo.push(email);
  
  if (contactInfo.length > 0) {
    summary += `. Contact: ${contactInfo.join(', ')}`;
  }
  
  if (summary.length > 30) {
    return summary.trim() + '.';
  }
  
  // Fallback: extract first meaningful sentence
  const sentences = transcript.split(/[.!?]/).filter(s => s.trim().length > 15);
  
  if (sentences.length > 0) {
    const firstSentence = sentences[0].trim();
    if (firstSentence.length < 200) {
      return firstSentence + '.';
    }
  }
  
  // Last resort: truncate transcript
  return transcript.substring(0, 150).trim() + '...';
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
      
      // Use VAPI's analysis if available, otherwise fallback to extraction
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
      
      // Build smart summary using VAPI data
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

      // ✨ FIXED: Send SMS notification via Telnyx with proper phone formatting
      if (client.owner_phone) {
        console.log('📱 Preparing SMS notification...');
        
        // Format phone number to E.164
        const formattedPhone = formatPhoneE164(client.owner_phone);
        
        if (!formattedPhone) {
          console.log('⚠️ Could not format owner phone number:', client.owner_phone);
        } else {
          console.log('📱 Formatted phone:', formattedPhone);
          
          // Build SMS message (works for any industry)
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
          smsMessage += `View full transcript in your CallBird dashboard.`;

          const smsSent = await sendTelnyxSMS(formattedPhone, smsMessage);
          
          if (smsSent) {
            console.log('✅ SMS notification sent to:', formattedPhone);
          } else {
            console.log('⚠️ SMS notification failed');
          }
        }
      } else {
        console.log('⚠️ No owner_phone configured for this client');
      }

      return res.status(200).json({ 
        received: true,
        saved: true,
        callId: insertedCall[0]?.id,
        smsSent: !!client.owner_phone,
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