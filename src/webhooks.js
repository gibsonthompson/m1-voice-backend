const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function handleTelnyxWebhook(req, res) {
  try {
    console.log('📞 Received Telnyx webhook:', JSON.stringify(req.body, null, 2));

    const event = req.body;
    const eventType = event.data?.event_type;

    // Handle assistant.initialization - Store conversation for later processing
    if (eventType === 'assistant.initialization') {
      console.log('🤖 Processing AI Assistant initialization...');
      
      const payload = event.data.payload;
      
      // Extract key details
      const conversationId = payload.telnyx_conversation_id;
      const fromNumber = payload.from || payload.telnyx_end_user_target;
      const toNumber = payload.to || payload.telnyx_agent_target;
      const callControlId = payload.call_control_id;
      const callSessionId = payload.call_session_id;

      console.log('📝 Call started:', {
        conversationId,
        from: fromNumber,
        to: toNumber,
        callControlId
      });

      // Get client info based on phone number
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('phone_number', toNumber)
        .single();

      if (clientError) {
        console.error('❌ Error finding client:', clientError);
        return res.status(200).json({ 
          received: true, 
          error: 'Client not found', 
          toNumber: toNumber 
        });
      }

      console.log('✅ Found client:', client.business_name);

      // Store initial call record with conversation_id
      const callRecord = {
        client_id: client.id,
        call_id: callControlId,
        conversation_id: conversationId, // Store this for later API fetch
        from_number: fromNumber,
        to_number: toNumber,
        duration: 0, // Will be updated later
        transcript: null, // Will be fetched later
        recording_url: null,
        customer_name: null, // Will be extracted later
        service_type: null,
        urgency: 'normal',
        sentiment: 'neutral',
        status: 'in_progress', // Mark as in-progress
        call_metadata: payload // Store full payload for reference
      };

      const { data: savedCall, error: saveError } = await supabase
        .from('calls')
        .upsert([callRecord], { 
          onConflict: 'call_id',
          ignoreDuplicates: false 
        })
        .select()
        .single();

      if (saveError) {
        console.error('❌ Error saving call:', saveError);
        return res.status(500).json({ 
          error: 'Failed to save call', 
          details: saveError.message 
        });
      }

      console.log('✅ Call initialized in database:', savedCall.id);
      console.log('📋 Conversation ID stored for later fetch:', conversationId);

      return res.status(200).json({ 
        received: true, 
        callId: savedCall.id,
        conversationId: conversationId,
        status: 'initialized'
      });
    }

    // Handle other event types
    console.log(`ℹ️ Received event type: ${eventType} - acknowledging but not processing`);
    return res.status(200).json({ received: true, eventType: eventType });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    return res.status(500).json({ error: error.message });
  }
}

module.exports = { handleTelnyxWebhook };
