const express = require('express');
const router = express.Router();
const { sendCallSummary } = require('./sms');

// Main Telnyx AI Assistant webhook handler
router.post('/telnyx', async (req, res) => {
  try {
    console.log('');
    console.log('📞 ========================================');
    console.log('📞 TELNYX WEBHOOK RECEIVED');
    console.log('📞 ========================================');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Full Payload:', JSON.stringify(req.body, null, 2));
    console.log('========================================');
    console.log('');
    
    const payload = req.body;
    
    // Telnyx sends different event types
    // We need to handle conversation completion
    
    // Check for conversation ended event
    if (payload.data && payload.data.event_type === 'assistant.conversation_ended') {
      await handleConversationEnded(req, payload);
    }
    // Alternative event names Telnyx might use
    else if (payload.event_type === 'conversation.ended') {
      await handleConversationEnded(req, payload);
    }
    else if (payload.data && payload.data.record_type === 'conversation') {
      await handleConversationEnded(req, payload);
    }
    else {
      console.log('ℹ️  Event type not handled, logging only');
    }
    
    // Always respond 200 OK immediately so Telnyx doesn't retry
    res.status(200).json({ received: true });
    
  } catch (error) {
    console.error('❌ ========================================');
    console.error('❌ WEBHOOK ERROR');
    console.error('❌ ========================================');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    console.error('========================================');
    
    // Still return 200 to prevent Telnyx retries
    res.status(200).json({ received: true, error: error.message });
  }
});

// Handle conversation ended
async function handleConversationEnded(req, payload) {
  const supabase = req.supabase;
  
  console.log('💬 Processing conversation ended event...');
  
  // Extract data from webhook (structure may vary)
  const data = payload.data || payload;
  const conversationData = data.payload || data;
  
  const conversationId = conversationData.conversation_id || conversationData.id || 'unknown';
  const callerPhone = conversationData.from || conversationData.caller_phone_number || 'unknown';
  const businessPhone = conversationData.to || conversationData.called_phone_number || process.env.TELNYX_PHONE_NUMBER;
  const duration = conversationData.duration_seconds || conversationData.duration || 0;
  const transcript = conversationData.transcript || conversationData.full_transcript || '';
  const summary = conversationData.summary || conversationData.ai_summary || '';
  const recordingUrl = conversationData.recording_url || null;
  const startedAt = conversationData.started_at || conversationData.created_at || new Date().toISOString();
  const endedAt = conversationData.ended_at || conversationData.completed_at || new Date().toISOString();
  
  console.log('📋 Extracted Data:');
  console.log('  - Conversation ID:', conversationId);
  console.log('  - Caller Phone:', callerPhone);
  console.log('  - Business Phone:', businessPhone);
  console.log('  - Duration:', duration, 'seconds');
  console.log('  - Has Transcript:', transcript.length > 0);
  console.log('  - Has Summary:', summary.length > 0);
  
  // Find which client this call belongs to
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .eq('telnyx_phone_number', businessPhone)
    .single();
  
  if (clientError || !client) {
    console.log('⚠️  No client found for phone number:', businessPhone);
    console.log('⚠️  You need to add this client to the database first');
    return;
  }
  
  console.log('✅ Found client:', client.business_name);
  
  // Extract insights from transcript and summary
  const insights = extractInsights(transcript, summary);
  
  console.log('🔍 Extracted Insights:');
  console.log('  - Customer Name:', insights.customer_name);
  console.log('  - Service Requested:', insights.service_requested);
  console.log('  - Urgency:', insights.urgency_level);
  console.log('  - Sentiment:', insights.sentiment);
  
  // Save call to database
  const { data: call, error: callError } = await supabase
    .from('calls')
    .insert({
      client_id: client.id,
      conversation_id: conversationId,
      caller_phone: callerPhone,
      duration_seconds: duration,
      started_at: startedAt,
      ended_at: endedAt,
      transcript: transcript,
      summary: summary,
      recording_url: recordingUrl,
      customer_name: insights.customer_name,
      customer_phone: insights.customer_phone,
      customer_address: insights.customer_address,
      service_requested: insights.service_requested,
      urgency_level: insights.urgency_level,
      sentiment: insights.sentiment,
      appointment_booked: insights.appointment_booked,
      appointment_time: insights.appointment_time,
      call_status: 'completed'
    })
    .select()
    .single();
  
  if (callError) {
    console.error('❌ Error saving call to database:', callError);
    return;
  }
  
  console.log('✅ Call saved to database with ID:', call.id);
  
  // Send SMS notification to business owner
  if (client.sms_notifications && client.notification_phone) {
    console.log('📱 Sending SMS notification...');
    await sendCallSummary(client, call);
  } else {
    console.log('ℹ️  SMS notifications disabled or no phone number configured');
  }
  
  console.log('✅ Conversation processing complete!');
  console.log('');
}

// Extract insights from transcript and summary
function extractInsights(transcript, summary) {
  const insights = {
    customer_name: 'Not provided',
    customer_phone: 'Not provided',
    customer_address: 'Not provided',
    service_requested: 'Not specified',
    urgency_level: 'routine',
    sentiment: 'neutral',
    appointment_booked: false,
    appointment_time: null
  };
  
  if (!transcript) return insights;
  
  const lowerTranscript = transcript.toLowerCase();
  const lowerSummary = summary.toLowerCase();
  
  // Extract urgency level
  const emergencyKeywords = ['emergency', 'urgent', 'flooding', 'burst', 'leak everywhere', 'gas smell', 'sewage backup'];
  if (emergencyKeywords.some(keyword => lowerTranscript.includes(keyword) || lowerSummary.includes(keyword))) {
    insights.urgency_level = 'emergency';
  } else if (lowerTranscript.includes('soon as possible') || lowerTranscript.includes('asap')) {
    insights.urgency_level = 'urgent';
  }
  
  // Extract sentiment
  const positiveKeywords = ['thank', 'great', 'perfect', 'excellent', 'appreciate'];
  const negativeKeywords = ['frustrated', 'angry', 'upset', 'terrible', 'awful'];
  
  const positiveCount = positiveKeywords.filter(keyword => lowerTranscript.includes(keyword)).length;
  const negativeCount = negativeKeywords.filter(keyword => lowerTranscript.includes(keyword)).length;
  
  if (positiveCount > negativeCount) {
    insights.sentiment = 'positive';
  } else if (negativeCount > positiveCount) {
    insights.sentiment = 'negative';
  } else if (insights.urgency_level === 'emergency') {
    insights.sentiment = 'stressed';
  }
  
  // Extract phone number
  const phoneMatch = transcript.match(/\b(\d{3}[-.]?\d{3}[-.]?\d{4}|\(\d{3}\)\s*\d{3}[-.]?\d{4})\b/);
  if (phoneMatch) {
    insights.customer_phone = phoneMatch[0];
  }
  
  // Extract name (look for "my name is" or "this is")
  const nameMatch = transcript.match(/(?:my name is|this is|i'm|im)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  if (nameMatch && nameMatch[1]) {
    insights.customer_name = nameMatch[1];
  }
  
  // Extract service type from common plumbing issues
  const services = [
    { keywords: ['drain', 'clog', 'unclog', 'blocked'], service: 'Drain cleaning' },
    { keywords: ['water heater', 'hot water', 'heater'], service: 'Water heater service' },
    { keywords: ['leak', 'leaking', 'drip'], service: 'Leak repair' },
    { keywords: ['toilet', 'flush'], service: 'Toilet repair' },
    { keywords: ['faucet', 'tap', 'fixture'], service: 'Faucet repair' },
    { keywords: ['pipe', 'burst pipe', 'broken pipe'], service: 'Pipe repair' },
    { keywords: ['sewer', 'sewage'], service: 'Sewer service' },
    { keywords: ['gas', 'gas line'], service: 'Gas line service' }
  ];
  
  for (const { keywords, service } of services) {
    if (keywords.some(keyword => lowerTranscript.includes(keyword) || lowerSummary.includes(keyword))) {
      insights.service_requested = service;
      break;
    }
  }
  
  // Check if appointment was booked
  if (lowerTranscript.includes('appointment') || lowerTranscript.includes('schedule') || lowerTranscript.includes('book')) {
    if (lowerTranscript.includes('confirm') || lowerTranscript.includes('booked') || lowerTranscript.includes('scheduled')) {
      insights.appointment_booked = true;
    }
  }
  
  return insights;
}

module.exports = router;