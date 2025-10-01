const { createClient } = require('@supabase/supabase-js');
const { sendSMS } = require('./sms');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Extract insights from conversation
function extractInsights(transcript) {
  const insights = {
    customer_name: null,
    service_type: null,
    urgency: 'normal',
    sentiment: 'neutral'
  };

  if (!transcript) return insights;

  const lowerTranscript = transcript.toLowerCase();

  // Extract customer name (common patterns)
  const namePatterns = [
    /(?:my name is|i'm|this is|i am)\s+([a-z]+)/i,
    /^([a-z]+)\s+(?:here|calling)/i
  ];
  
  for (const pattern of namePatterns) {
    const match = transcript.match(pattern);
    if (match && match[1]) {
      insights.customer_name = match[1].charAt(0).toUpperCase() + match[1].slice(1);
      break;
    }
  }

  // Extract service type
  const services = ['plumbing', 'leak', 'drain', 'toilet', 'sink', 'water heater', 'pipe', 'faucet'];
  for (const service of services) {
    if (lowerTranscript.includes(service)) {
      insights.service_type = service;
      break;
    }
  }

  // Determine urgency
  const urgentWords = ['emergency', 'urgent', 'asap', 'immediately', 'flooding', 'burst', 'broke'];
  if (urgentWords.some(word => lowerTranscript.includes(word))) {
    insights.urgency = 'high';
  }

  // Determine sentiment
  const negativeWords = ['frustrated', 'angry', 'upset', 'terrible', 'awful'];
  const positiveWords = ['thank', 'appreciate', 'great', 'helpful'];
  
  if (negativeWords.some(word => lowerTranscript.includes(word))) {
    insights.sentiment = 'negative';
  } else if (positiveWords.some(word => lowerTranscript.includes(word))) {
    insights.sentiment = 'positive';
  }

  return insights;
}

async function handleTelnyxWebhook(req, res) {
  try {
    console.log('📞 Received Telnyx webhook:', JSON.stringify(req.body, null, 2));

    const event = req.body;
    const eventType = event.data?.event_type;

    // Handle Telnyx AI Assistant ended event
    if (eventType === 'assistant.ended' || eventType === 'assistant.completed') {
      console.log('🤖 Processing AI Assistant call completion...');
      
      const payload = event.data.payload;
      
      // Extract call details from assistant payload
      const fromNumber = payload.from || payload.telnyx_end_user_target;
      const toNumber = payload.to || payload.telnyx_agent_target;
      const callId = payload.call_control_id || payload.call_session_id;
      
      // Get transcript from conversation or payload
      const transcript = payload.transcript || payload.conversation_transcript || '';
      const duration = payload.duration || payload.call_duration || 0;
      const recordingUrl = payload.recording_url || null;

      console.log('📝 Call details:', {
        from: fromNumber,
        to: toNumber,
        callId: callId,
        transcriptLength: transcript.length,
        duration: duration
      });

      // Get client info based on phone number
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('phone_number', toNumber)
        .single();

      if (clientError) {
        console.error('❌ Error finding client:', clientError);
        return res.status(200).json({ received: true, error: 'Client not found', toNumber: toNumber });
      }

      console.log('✅ Found client:', client.business_name);

      // Extract insights from conversation
      const insights = extractInsights(transcript);
      console.log('🔍 Extracted insights:', insights);

      // Store call in database
      const callRecord = {
        client_id: client.id,
        call_id: callId,
        from_number: fromNumber,
        to_number: toNumber,
        duration: duration,
        transcript: transcript,
        recording_url: recordingUrl,
        customer_name: insights.customer_name,
        service_type: insights.service_type,
        urgency: insights.urgency,
        sentiment: insights.sentiment,
        status: 'completed'
      };

      const { data: savedCall, error: saveError } = await supabase
        .from('calls')
        .insert([callRecord])
        .select()
        .single();

      if (saveError) {
        console.error('❌ Error saving call:', saveError);
        return res.status(500).json({ error: 'Failed to save call', details: saveError.message });
      }

      console.log('✅ Call saved to database:', savedCall.id);

      // Send SMS notification to business owner
      if (client.notification_phone) {
        const smsMessage = `New call for ${client.business_name}!\n\n` +
          `From: ${fromNumber}\n` +
          `${insights.customer_name ? `Name: ${insights.customer_name}\n` : ''}` +
          `${insights.service_type ? `Service: ${insights.service_type}\n` : ''}` +
          `Urgency: ${insights.urgency}\n\n` +
          `Transcript: ${transcript.substring(0, 200)}${transcript.length > 200 ? '...' : ''}`;

        try {
          await sendSMS(client.notification_phone, smsMessage);
          console.log('✅ SMS notification sent to:', client.notification_phone);
        } catch (smsError) {
          console.error('❌ SMS error:', smsError.message);
          // Don't fail the whole webhook if SMS fails
        }
      } else {
        console.log('⚠️ No notification phone configured for client');
      }

      return res.status(200).json({ 
        received: true, 
        callId: savedCall.id,
        insights: insights,
        smsAttempted: !!client.notification_phone
      });
    }

    // Handle regular call.completed event (for non-AI calls)
    if (eventType === 'call.completed') {
      console.log('📞 Processing regular call completion...');
      
      const callData = event.data.payload;
      
      // Get client info based on phone number
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('phone_number', callData.to)
        .single();

      if (clientError) {
        console.error('❌ Error finding client:', clientError);
        return res.status(200).json({ received: true, error: 'Client not found' });
      }

      // Extract insights from conversation
      const transcript = callData.transcript || '';
      const insights = extractInsights(transcript);

      // Store call in database
      const callRecord = {
        client_id: client.id,
        call_id: callData.call_control_id,
        from_number: callData.from,
        to_number: callData.to,
        duration: callData.duration,
        transcript: transcript,
        recording_url: callData.recording_url || null,
        customer_name: insights.customer_name,
        service_type: insights.service_type,
        urgency: insights.urgency,
        sentiment: insights.sentiment,
        status: 'completed'
      };

      const { data: savedCall, error: saveError } = await supabase
        .from('calls')
        .insert([callRecord])
        .select()
        .single();

      if (saveError) {
        console.error('❌ Error saving call:', saveError);
        return res.status(500).json({ error: 'Failed to save call' });
      }

      console.log('✅ Call saved to database:', savedCall.id);

      // Send SMS notification to business owner
      if (client.notification_phone) {
        const smsMessage = `New call for ${client.business_name}!\n\n` +
          `From: ${callData.from}\n` +
          `${insights.customer_name ? `Name: ${insights.customer_name}\n` : ''}` +
          `${insights.service_type ? `Service: ${insights.service_type}\n` : ''}` +
          `Urgency: ${insights.urgency}\n\n` +
          `Transcript: ${transcript.substring(0, 200)}${transcript.length > 200 ? '...' : ''}`;

        try {
          await sendSMS(client.notification_phone, smsMessage);
          console.log('✅ SMS notification sent to:', client.notification_phone);
        } catch (smsError) {
          console.error('❌ SMS error:', smsError.message);
        }
      }

      return res.status(200).json({ 
        received: true, 
        callId: savedCall.id,
        insights: insights
      });
    }

    // For other event types, just acknowledge and log
    console.log(`ℹ️ Received event type: ${eventType} - acknowledging but not processing`);
    return res.status(200).json({ received: true, eventType: eventType });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    return res.status(500).json({ error: error.message });
  }
}

module.exports = { handleTelnyxWebhook };
