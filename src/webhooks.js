const { createClient } = require('@supabase/supabase-js');
const { sendSMS } = require('./sms');
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
    console.error('Error fetching phone number from Vapi:', error.message);
    return null;
  }
}

async function handleVapiWebhook(req, res) {
  try {
    const message = req.body.message;
    
    if (message?.type === 'end-of-call-report') {
      const call = message.call;
      const phoneNumberId = call.phoneNumberId;
      
      console.log('Phone Number ID:', phoneNumberId);
      
      const phoneNumber = await getPhoneNumberFromVapi(phoneNumberId);
      console.log('Actual phone number:', phoneNumber);

      if (!phoneNumber) {
        console.log('Could not retrieve phone number from Vapi');
        return res.status(200).json({ received: true });
      }

      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('phone_number', phoneNumber)
        .single();

      if (clientError || !client) {
        console.log('Client not found for:', phoneNumber);
        console.log('Error:', clientError?.message);
        return res.status(200).json({ received: true });
      }

      console.log('Client found:', client.business_name);

      const transcript = message.transcript || '';
      const fromNumber = call.customer?.number || call.from || 'unknown';
      
      const callRecord = {
        client_id: client.id,
        call_id: call.id,
        from_number: fromNumber,
        to_number: phoneNumber,
        duration: call.endedAt ? Math.round((new Date(call.endedAt) - new Date(call.startedAt)) / 1000) : 0,
        transcript: transcript,
        status: 'completed'
      };

      const { error: saveError } = await supabase
        .from('calls')
        .insert([callRecord]);

      if (saveError) {
        console.error('Error saving call:', saveError.message);
      } else {
        console.log('Call saved successfully');
      }

      if (client.owner_phone) {
        try {
          await sendSMS(
            client.owner_phone, 
            `New call for ${client.business_name}\nFrom: ${fromNumber}\n\n${transcript.substring(0, 150)}`
          );
          console.log('SMS sent to:', client.owner_phone);
        } catch (smsError) {
          console.error('SMS error:', smsError.message);
        }
      } else {
        console.log('No owner_phone configured for client');
      }

      return res.status(200).json({ received: true });
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: error.message });
  }
}

module.exports = { handleVapiWebhook };
