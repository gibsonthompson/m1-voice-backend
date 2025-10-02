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
    console.error('Error fetching phone number:', error.message);
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
      
      // Fetch actual phone number from Vapi
      const phoneNumber = await getPhoneNumberFromVapi(phoneNumberId);
      console.log('Actual phone number:', phoneNumber);

      if (!phoneNumber) {
        console.log('Could not get phone number from Vapi');
        return res.status(200).json({ received: true });
      }

      const { data: client } = await supabase
        .from('clients')
        .select('*')
        .eq('phone_number', phoneNumber)
        .single();

      if (!client) {
        console.log('Client not found for:', phoneNumber);
        return res.status(200).json({ received: true });
      }

      const transcript = message.transcript || '';
      
      const callRecord = {
        client_id: client.id,
        call_id: call.id,
        from_number: call.customer?.number || 'unknown',
        to_number: phoneNumber,
        duration: call.endedAt ? Math.round((new Date(call.endedAt) - new Date(call.startedAt)) / 1000) : 0,
        transcript: transcript,
        status: 'completed'
      };

      await supabase.from('calls').insert([callRecord]);
      console.log('Call saved');

      if (client.notification_phone) {
        await sendSMS(client.notification_phone, 
          `New call for ${client.business_name}\nFrom: ${callRecord.from_number}\n\n${transcript.substring(0, 150)}`
        );
        console.log('SMS sent');
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
