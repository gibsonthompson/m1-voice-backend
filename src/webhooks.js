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

async function sendGHLSMS(toPhone, message) {
  try {
    const response = await axios.post(
      'https://services.leadconnectorhq.com/conversations/messages',
      {
        type: 'SMS',
        contactId: toPhone, // GHL will create contact if doesn't exist
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
    return true;
  } catch (error) {
    console.error('GHL SMS error:', error.response?.data || error.message);
    return false;
  }
}

async function handleVapiWebhook(req, res) {
  try {
    const message = req.body.message;
    
    if (message?.type === 'end-of-call-report') {
      const call = message.call;
      const phoneNumberId = call.phoneNumberId;
      
      const phoneNumber = await getPhoneNumberFromVapi(phoneNumberId);

      if (!phoneNumber) {
        return res.status(200).json({ received: true });
      }

      const { data: client } = await supabase
        .from('clients')
        .select('*')
        .eq('phone_number', phoneNumber)
        .single();

      if (!client) {
        console.log('No client found');
        return res.status(200).json({ received: true });
      }

      const transcript = message.transcript || '';
      const callerPhone = call.customer?.number || 'unknown';
      
      const callRecord = {
        client_id: client.id,
        conversation_id: call.id,
        caller_phone: callerPhone,
        duration_seconds: call.endedAt ? Math.round((new Date(call.endedAt) - new Date(call.startedAt)) / 1000) : 0,
        started_at: call.startedAt,
        ended_at: call.endedAt,
        transcript: transcript,
        call_status: 'completed'
      };

      await supabase.from('calls').insert([callRecord]);
      console.log('✅ Call saved');

      // Send SMS via GoHighLevel
      if (client.owner_phone) {
        const smsMessage = `New call for ${client.business_name}\n\nFrom: ${callerPhone}\nDuration: ${callRecord.duration_seconds}s\n\nTranscript: ${transcript.substring(0, 150)}...`;
        
        const smsSent = await sendGHLSMS(client.owner_phone, smsMessage);
        
        if (smsSent) {
          console.log('✅ SMS sent via GHL to:', client.owner_phone);
        }
      }

      return res.status(200).json({ received: true });
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

module.exports = { handleVapiWebhook };
