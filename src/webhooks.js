const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

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
    console.error('Error fetching phone number:', error.message);
    return null;
  }
}

// Create or find contact in GoHighLevel
async function getOrCreateGHLContact(phone, name, businessName) {
  try {
    console.log('🔍 Looking for GHL contact:', phone);
    
    // Search for existing contact
    const searchResponse = await axios.get(
      'https://services.leadconnectorhq.com/contacts/search',
      {
        params: {
          locationId: process.env.GHL_LOCATION_ID,
          query: phone.replace(/\D/g, '') // Search by digits only
        },
        headers: {
          'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
          'Version': '2021-07-28'
        }
      }
    );

    if (searchResponse.data.contacts && searchResponse.data.contacts.length > 0) {
      console.log('✅ Found existing contact');
      return searchResponse.data.contacts[0].id;
    }

    // Create new contact if not found
    console.log('📝 Creating new GHL contact');
    const createResponse = await axios.post(
      'https://services.leadconnectorhq.com/contacts/',
      {
        locationId: process.env.GHL_LOCATION_ID,
        firstName: name || businessName,
        phone: phone,
        source: 'CallBird AI'
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        }
      }
    );

    console.log('✅ Contact created:', createResponse.data.contact.id);
    return createResponse.data.contact.id;

  } catch (error) {
    console.error('❌ GHL contact error:', error.response?.data || error.message);
    return null;
  }
}

// Send SMS via GoHighLevel
async function sendGHLSMS(contactId, message) {
  try {
    console.log('📱 Sending SMS to contact:', contactId);
    
    const response = await axios.post(
      'https://services.leadconnectorhq.com/conversations/messages',
      {
        type: 'SMS',
        contactId: contactId,
        message: message,
        locationId: process.env.GHL_LOCATION_ID
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        }
      }
    );

    console.log('✅ SMS sent successfully');
    return true;
  } catch (error) {
    console.error('❌ SMS error:', error.response?.data || error.message);
    return false;
  }
}

function extractCustomerName(transcript) {
  // Try to extract from AI summary first
  const summaryMatch = transcript.match(/name[,:]?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
  if (summaryMatch && summaryMatch[1]) {
    return summaryMatch[1].trim();
  }

  // Fallback to original patterns
  const patterns = [
    /my name is ([a-z\s]+?)(?:\.|,|$|user:|ai:|email)/i,
    /this is ([a-z\s]+?)(?:\.|,|$|user:|ai:|email)/i,
    /i'm ([a-z\s]+?)(?:\.|,|$|user:|ai:|email)/i,
  ];
  
  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      if (name.length < 3 || name.length > 50) continue;
      if (['hello', 'thanks', 'thank you', 'sorry'].includes(name.toLowerCase())) continue;
      
      return name.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
  }
  
  return 'Unknown Caller';
}

function extractPhoneNumber(transcript) {
  // Try to extract from AI confirmation first (most reliable)
  const confirmMatch = transcript.match(/(?:phone[,:]?|that is)\s+((?:\d[\s.]*){10,11})/i);
  if (confirmMatch) {
    const cleaned = confirmMatch[1].replace(/[\s.\-()]/g, '');
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    }
    if (cleaned.length === 11 && cleaned[0] === '1') {
      return `+${cleaned}`;
    }
  }

  // Try standard format
  const standardMatch = transcript.match(/(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/);
  if (standardMatch) {
    const cleaned = standardMatch[1].replace(/[\s.\-]/g, '');
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    }
  }

  // Try digit by digit (must be exactly 10 digits with spaces)
  const digitMatch = transcript.match(/(\d\s+\d\s+\d\s+\d\s+\d\s+\d\s+\d\s+\d\s+\d\s+\d)(?!\s*\d)/);
  if (digitMatch) {
    const cleaned = digitMatch[1].replace(/\s+/g, '');
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    }
  }
  
  return 'Unknown';
}

function generateSmartSummary(transcript) {
  if (!transcript) return 'Call completed - no transcript available';
  
  // Try to find the AI's summary section
  const summaryMatch = transcript.match(/Here's a summary of your information[,:]?(.*?)(?:Our scheduling team|Is there anything else|User:|$)/is);
  
  if (summaryMatch && summaryMatch[1]) {
    // Extract key info from AI's summary
    const summaryText = summaryMatch[1].trim();
    
    const name = summaryText.match(/name[,:]?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i)?.[1];
    const phone = summaryText.match(/phone[,:]?\s+([\d\s.]+)/i)?.[1]?.replace(/\s+/g, '-');
    const service = summaryText.match(/service needed[,:]?\s+([^.]+)/i)?.[1]?.trim();
    const timing = summaryText.match(/(?:preferred timing|appointment)[,:]?\s+([^.]+)/i)?.[1]?.trim();
    
    let summary = '';
    if (name) summary += `${name} `;
    summary += 'called to schedule ';
    if (service) summary += `${service} `;
    if (timing) summary += `for ${timing}. `;
    if (phone) summary += `Phone: ${phone}.`;
    
    if (summary.length > 20) {
      return summary.trim();
    }
  }
  
  // Fallback: take first meaningful sentence
  const cleaned = transcript.trim();
  const firstSentence = cleaned.split(/[.!?]/).filter(s => s.trim().length > 10)[0];
  
  if (firstSentence && firstSentence.length < 200) {
    return firstSentence.trim() + '.';
  }
  
  return cleaned.substring(0, 200) + (cleaned.length > 200 ? '...' : '');
}

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
      
      const customerName = extractCustomerName(transcript);
      const customerPhone = extractPhoneNumber(transcript) || callerPhone;
      const aiSummary = generateSmartSummary(transcript);
      
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

      // Send SMS notification via GoHighLevel
      if (client.owner_phone && process.env.GHL_API_KEY) {
        console.log('📱 Attempting to send SMS notification...');
        
        const contactId = await getOrCreateGHLContact(
          client.owner_phone,
          client.owner_name || client.business_name,
          client.business_name
        );

        if (contactId) {
          // Format SMS message
          const smsMessage = `🔔 New Call - ${client.business_name}\n\n` +
            `Customer: ${customerName}\n` +
            `Phone: ${customerPhone}\n\n` +
            `Summary:\n${aiSummary.substring(0, 120)}...\n\n` +
            `View full details in your CallBird dashboard`;

          await sendGHLSMS(contactId, smsMessage);
        }
      } else {
        console.log('⚠️ SMS not configured (missing owner_phone or GHL_API_KEY)');
      }

      return res.status(200).json({ 
        received: true,
        saved: true,
        callId: insertedCall[0]?.id
      });
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    return res.status(500).json({ error: error.message });
  }
}

module.exports = { handleVapiWebhook };