const { createClient } = require('@supabase/supabase-js');
const { sendSMS } = require('./sms');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function handleVapiWebhook(req, res) {
  try {
    const message = req.body.message;
    
    if (message?.type === 'end-of-call-report') {
      const call = message.call;
      
      // Try multiple paths to find phone number
      const phoneNumber = call.phoneNumber?.number 
        || call.phoneNumber 
        || call.phoneNumberId
        || call.to;
      
      console.log('Phone number extracted:', phoneNumber);
      console.log('Call structure:', JSON.stringify({
        hasPhoneNumber: !!call.phoneNumber,
        hasPhoneNumberId: !!call.phoneNumberId,
        hasTo: !!call.to,
        phoneNumberValue: phoneNumber
      }));

      if (!phoneNumber) {
        console.log('No phone number found in call object');
        return res.status(200).json({ received: true, error: 'no phone number' });
      }

      const { data: client } = await supabase
        .from('clients')
        .select('*')
        .eq('phone_number', phoneNumber)
        .single();

      if (!client) {
        console.log('Client not found for:', phoneNumber);
        return res.status(200).json({ received: true, error: 'client not found' });
      }

      const transcript = message.transcript || '';
      
      const callRecord = {
        client_id: client.id,
        call_id: call.id,
        from_number: call.customer?.number || call.from || 'unknown',
        to_number: phoneNumber,
        duration: call.endedAt ? Math.round((new Date(call.endedAt) - new Date(call.startedAt)) / 1000) : 0,
        transcript: transcript,
        status: 'completed'
      };

      await supabase.from('calls').insert([callRecord]);
      console.log('Call saved for client:', client.business_name);

      if (client.notification_phone) {
        await sendSMS(client.notification_phone, 
          `New call for ${client.business_name}\nFrom: ${callRecord.from_number}\n\n${transcript.substring(0, 150)}`
        );
        console.log('SMS sent to:', client.notification_phone);
      }

      return res.status(200).json({ received: true, success: true });
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: error.message });
  }
}

module.exports = { handleVapiWebhook };
