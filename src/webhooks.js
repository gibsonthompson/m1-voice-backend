const { createClient } = require('@supabase/supabase-js');
const { sendSMS } = require('./sms');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function handleVapiWebhook(req, res) {
  try {
    console.log('Vapi webhook:', JSON.stringify(req.body, null, 2));

    const message = req.body.message;
    
    if (message?.type === 'end-of-call-report') {
      const call = message.call;
      const transcript = message.transcript || '';
      
      const phoneNumber = call.phoneNumber?.number;
      
      const { data: client } = await supabase
        .from('clients')
        .select('*')
        .eq('phone_number', phoneNumber)
        .single();

      if (!client) {
        console.log('Client not found:', phoneNumber);
        return res.status(200).json({ received: true });
      }

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
          `New call for ${client.business_name}\nFrom: ${call.customer?.number}\n\n${transcript.substring(0, 200)}`
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
