const Telnyx = require('telnyx');

// Initialize Telnyx with your API key
const telnyx = new Telnyx(process.env.TELNYX_API_KEY);

/**
 * Send call summary via SMS to business owner
 */
async function sendCallSummary(client, call) {
  try {
    console.log('');
    console.log('📱 ========================================');
    console.log('📱 SENDING SMS NOTIFICATION');
    console.log('📱 ========================================');
    console.log('  To:', client.notification_phone);
    console.log('  From:', client.telnyx_phone_number);
    console.log('  Business:', client.business_name);
    console.log('========================================');
    
    // Format the SMS message
    const message = formatCallSummary(client, call);
    
    console.log('📝 Message Preview:');
    console.log('---');
    console.log(message);
    console.log('---');
    
    // Send SMS via Telnyx
    const response = await telnyx.messages.create({
      from: client.telnyx_phone_number, // Send from business's AI number
      to: client.notification_phone,      // Send to business owner's phone
      text: message
    });
    
    console.log('✅ SMS sent successfully!');
    console.log('  Message ID:', response.data.id);
    console.log('  Status:', response.data.to[0].status);
    console.log('========================================');
    console.log('');
    
    return response;
    
  } catch (error) {
    console.error('❌ ========================================');
    console.error('❌ SMS ERROR');
    console.error('❌ ========================================');
    console.error('  Error:', error.message);
    console.error('  Client:', client.business_name);
    console.error('  Call ID:', call.id);
    
    if (error.errors) {
      console.error('  Details:', JSON.stringify(error.errors, null, 2));
    }
    console.error('========================================');
    console.error('');
    
    throw error;
  }
}

/**
 * Format call summary into readable SMS message
 */
function formatCallSummary(client, call) {
  // Format duration
  const minutes = Math.floor(call.duration_seconds / 60);
  const seconds = call.duration_seconds % 60;
  const duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  
  // Choose emoji based on urgency
  let urgencyEmoji = '📞';
  if (call.urgency_level === 'emergency') {
    urgencyEmoji = '🚨';
  } else if (call.urgency_level === 'urgent') {
    urgencyEmoji = '⚡';
  }
  
  // Choose emoji based on sentiment
  let sentimentEmoji = '😊';
  if (call.sentiment === 'negative') {
    sentimentEmoji = '😟';
  } else if (call.sentiment === 'stressed') {
    sentimentEmoji = '😰';
  } else if (call.sentiment === 'neutral') {
    sentimentEmoji = '😐';
  }
  
  // Format the time
  const callTime = new Date(call.created_at).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  
  // Build the message
  let message = `${urgencyEmoji} New Call - ${client.business_name}\n\n`;
  
  // Customer info
  message += `📋 CUSTOMER INFO:\n`;
  message += `Name: ${call.customer_name || 'Not provided'}\n`;
  message += `Phone: ${call.caller_phone}\n`;
  
  if (call.customer_address && call.customer_address !== 'Not provided') {
    message += `Address: ${call.customer_address}\n`;
  }
  
  message += `\n`;
  
  // Call details
  message += `⏱️ CALL DETAILS:\n`;
  message += `Time: ${callTime}\n`;
  message += `Duration: ${duration}\n`;
  message += `\n`;
  
  // Summary
  if (call.summary && call.summary.length > 0) {
    message += `📝 SUMMARY:\n`;
    message += `${call.summary}\n`;
    message += `\n`;
  }
  
  // Service info
  message += `🔧 SERVICE:\n`;
  message += `Type: ${call.service_requested}\n`;
  message += `Urgency: ${call.urgency_level.toUpperCase()}\n`;
  message += `Mood: ${call.sentiment} ${sentimentEmoji}\n`;
  
  // Appointment
  if (call.appointment_booked) {
    message += `\n✅ APPOINTMENT BOOKED\n`;
    if (call.appointment_time) {
      const apptTime = new Date(call.appointment_time).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      message += `Time: ${apptTime}\n`;
    }
  }
  
  // Dashboard link (will be updated when frontend is ready)
  message += `\n`;
  message += `📊 View full details:\n`;
  message += `${process.env.FRONTEND_URL}/call/${call.id}`;
  
  return message;
}

/**
 * Send a test SMS (for testing purposes)
 */
async function sendTestSMS(toPhone, fromPhone) {
  try {
    console.log(`📱 Sending test SMS from ${fromPhone} to ${toPhone}`);
    
    const response = await telnyx.messages.create({
      from: fromPhone,
      to: toPhone,
      text: '🎉 M1 Voice Dashboard SMS Test\n\nYour SMS notification system is working! You will receive call summaries at this number.'
    });
    
    console.log('✅ Test SMS sent successfully!');
    return response;
    
  } catch (error) {
    console.error('❌ Test SMS failed:', error.message);
    throw error;
  }
}

module.exports = {
  sendCallSummary,
  sendTestSMS
};