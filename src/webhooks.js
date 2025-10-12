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

function extractCustomerName(transcript) {
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
  const patterns = [
    /(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/,
    /(\d\s+\d\s+\d\s+\d\s+\d\s+\d\s+\d\s+\d\s+\d\s+\d)/,
  ];
  
  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (match) {
      const cleaned = match[1].replace(/\s+/g, '').replace(/[^\d]/g, '');
      if (cleaned.length === 10) {
        return `+1${cleaned}`;
      }
    }
  }
  
  return 'Unknown';
}

function generateAISummary(transcript) {
  if (!transcript) return 'Call completed - no transcript available';
  
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
      const aiSummary = generateAISummary(transcript);
      
      // ONLY these fields - nothing else!
      const callRecord = {
        client_id: client.id,
        customer_name: customerName,
        customer_phone: customerPhone,
        ai_summary: aiSummary,
        transcript: transcript,
        created_at: new Date().toISOString()
      };

      console.log('💾 Saving call to Supabase...');
      console.log('📝 Call record:', JSON.stringify(callRecord, null, 2));

      const { data: insertedCall, error: insertError } = await supabase
        .from('calls')
        .insert([callRecord])
        .select();
      
      if (insertError) {
        console.error('❌ Error inserting call:', insertError);
        return res.status(500).json({ error: 'Failed to save call' });
      }
      
      console.log('✅ Call saved successfully:', {
        client: client.business_name,
        customer: customerName,
        phone: customerPhone
      });

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