const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const { sendSMS } = require('./sms');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Extract insights from conversation messages
function extractInsights(messages) {
  const insights = {
    customer_name: null,
    service_type: null,
    urgency: 'normal',
    sentiment: 'neutral'
  };

  if (!messages || messages.length === 0) return insights;

  // Combine all user messages
  const userMessages = messages
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join(' ');

  const lowerText = userMessages.toLowerCase();

  // Extract customer name patterns
  const namePatterns = [
    /(?:my name is|i'm|this is|i am)\s+([a-z]+)/i,
    /^([a-z]+)\s+(?:here|calling)/i
  ];
  
  for (const pattern of namePatterns) {
    const match = userMessages.match(pattern);
    if (match && match[1]) {
      insights.customer_name = match[1].charAt(0).toUpperCase() + match[1].slice(1);
      break;
    }
  }

  // Extract service type
  const services = ['plumbing', 'leak', 'drain', 'toilet', 'sink', 'water heater', 'pipe', 'faucet'];
  for (const service of services) {
    if (lowerText.includes(service)) {
      insights.service_type = service;
      break;
    }
  }

  // Determine urgency
  const urgentWords = ['emergency', 'urgent', 'asap', 'immediately', 'flooding', 'burst', 'broke'];
  if (urgentWords.some(word => lowerText.includes(word))) {
    insights.urgency = 'high';
  }

  // Determine sentiment
  const negativeWords = ['frustrated', 'angry', 'upset', 'terrible', 'awful'];
  const positiveWords = ['thank', 'appreciate', 'great', 'helpful'];
  
  if (negativeWords.some(word => lowerText.includes(word))) {
    insights.sentiment = 'negative';
  } else if (positiveWords.some(word => lowerText.includes(word))) {
    insights.sentiment = 'positive';
  }

  return insights;
}

// Fetch conversation details from Telnyx API
async function fetchConversation(conversationId) {
  try {
    console.log('🔍 Fetching conversation:', conversationId);

    const response = await axios.get(
      `https://api.telnyx.com/v2/ai/conversations/${conversationId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.TELNYX_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const conversation = response.data.data;
    console.log('✅ Conversation fetched successfully');

    return conversation;
  } catch (error) {
    console.error('❌ Error fetching conversation:', error.response?.data || error.message);
    throw error;
  }
}

// Process a completed conversation and update database
async function processConversation(conversationId) {
  try {
    // Fetch conversation from Telnyx
    const conversation = await fetchConversation(conversationId);

    // Get the corresponding call record
    const { data: call, error: callError } = await supabase
      .from('calls')
      .select('*, clients(*)')
      .eq('conversation_id', conversationId)
      .single();

    if (callError) {
      throw new Error(`Call not found for conversation ${conversationId}: ${callError.message}`);
    }

    // Extract transcript from messages
    const messages = conversation.messages || [];
    const transcript = messages
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');

    // Extract insights
    const insights = extractInsights(messages);

    // Use Telnyx's AI-generated summary if available
    const aiSummary = conversation.insights?.summary || '';

    // Update call record
    const updates = {
      transcript: transcript,
      duration: conversation.duration || 0,
      customer_name: insights.customer_name,
      service_type: insights.service_type,
      urgency: insights.urgency,
      sentiment: insights.sentiment,
      status: 'completed',
      ai_summary: aiSummary,
      conversation_data: conversation // Store full conversation object
    };

    const { data: updatedCall, error: updateError } = await supabase
      .from('calls')
      .update(updates)
      .eq('conversation_id', conversationId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update call: ${updateError.message}`);
    }

    console.log('✅ Call updated with conversation details:', updatedCall.id);

    // Send SMS notification
    if (call.clients.notification_phone) {
      const smsMessage = `New call for ${call.clients.business_name}!\n\n` +
        `From: ${call.from_number}\n` +
        `${insights.customer_name ? `Name: ${insights.customer_name}\n` : ''}` +
        `${insights.service_type ? `Service: ${insights.service_type}\n` : ''}` +
        `Urgency: ${insights.urgency}\n\n` +
        `${aiSummary ? `Summary: ${aiSummary.substring(0, 150)}...` : `Transcript: ${transcript.substring(0, 150)}...`}`;

      try {
        await sendSMS(call.clients.notification_phone, smsMessage);
        console.log('✅ SMS notification sent to:', call.clients.notification_phone);
      } catch (smsError) {
        console.error('❌ SMS error:', smsError.message);
      }
    }

    return updatedCall;
  } catch (error) {
    console.error('❌ Error processing conversation:', error);
    throw error;
  }
}

module.exports = { 
  fetchConversation, 
  processConversation,
  extractInsights
};
