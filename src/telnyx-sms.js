// ============================================
// TELNYX SMS HELPER - Replaces GHL SMS
// ============================================
const fetch = require('node-fetch');

// Format phone to E.164
function formatPhoneE164(phone) {
  if (!phone) return null;
  
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11) {
    return `+${digits}`;
  }
  
  if (phone.startsWith('+') && phone.replace(/\D/g, '').length >= 10) {
    return phone.replace(/[^\d+]/g, '');
  }
  
  console.log(`⚠️ Invalid phone format: ${phone}`);
  return null;
}

// Format phone to display format: (678) 316-1454
function formatPhoneDisplay(phone) {
  if (!phone) return null;
  
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 10) {
    return `(${cleaned.substring(0,3)}) ${cleaned.substring(3,6)}-${cleaned.substring(6)}`;
  }
  
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    const without1 = cleaned.substring(1);
    return `(${without1.substring(0,3)}) ${without1.substring(3,6)}-${without1.substring(6)}`;
  }
  
  return phone;
}

/**
 * Send SMS via Telnyx
 * @param {string} toPhone - Recipient phone number
 * @param {string} message - SMS message content
 * @returns {Promise<boolean>} - Success status
 */
async function sendTelnyxSMS(toPhone, message) {
  try {
    console.log('📱 Sending SMS via Telnyx...');
    console.log('   To:', toPhone);
    console.log('   Message length:', message.length, 'chars');
    
    // Validate environment variables
    if (!process.env.TELNYX_API_KEY) {
      throw new Error('TELNYX_API_KEY not configured');
    }
    if (!process.env.TELNYX_MESSAGING_PROFILE_ID) {
      throw new Error('TELNYX_MESSAGING_PROFILE_ID not configured');
    }
    if (!process.env.TELNYX_SMS_FROM_NUMBER) {
      throw new Error('TELNYX_SMS_FROM_NUMBER not configured');
    }
    
    // Format phone to E.164
    const formattedPhone = formatPhoneE164(toPhone);
    if (!formattedPhone) {
      throw new Error(`Invalid phone format: ${toPhone}`);
    }
    console.log('   Formatted phone:', formattedPhone);
    
    // Send SMS via Telnyx API
    const response = await fetch('https://api.telnyx.com/v2/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TELNYX_API_KEY}`
      },
      body: JSON.stringify({
        from: process.env.TELNYX_SMS_FROM_NUMBER,
        to: formattedPhone,
        text: message,
        messaging_profile_id: process.env.TELNYX_MESSAGING_PROFILE_ID
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Telnyx SMS error:', errorData);
      throw new Error(`Telnyx API error: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('✅ SMS sent via Telnyx successfully!');
    console.log('   Message ID:', result.data?.id);
    
    return true;
  } catch (error) {
    console.error('❌ Telnyx SMS error:', error.message);
    return false;
  }
}

/**
 * Send call notification SMS to business owner
 * @param {Object} client - Client record from database
 * @param {Object} callData - Extracted call data
 * @returns {Promise<boolean>}
 */
async function sendCallNotificationSMS(client, callData) {
  const { customerName, customerPhone, customerEmail, urgency, summary } = callData;
  
  let smsMessage = `🔔 New Call - ${client.business_name}\n\n`;
  smsMessage += `Customer: ${customerName}\n`;
  smsMessage += `Phone: ${customerPhone}\n`;
  if (customerEmail) {
    smsMessage += `Email: ${customerEmail}\n`;
  }
  if (urgency === 'high' || urgency === 'emergency') {
    smsMessage += `⚠️ Urgency: HIGH\n`;
  }
  smsMessage += `\nSummary: ${summary}\n\n`;
  smsMessage += `View full details in your CallBird dashboard.`;
  
  return sendTelnyxSMS(client.owner_phone, smsMessage);
}

/**
 * Send welcome SMS to new signup
 * @param {string} phone - Customer phone number
 * @param {string} businessName - Business name
 * @param {string} aiPhoneNumber - The provisioned AI phone number
 * @returns {Promise<boolean>}
 */
async function sendWelcomeSMS(phone, businessName, aiPhoneNumber) {
  const message = `🎉 Welcome to CallBird!\n\n` +
    `Your AI receptionist for ${businessName} is ready!\n\n` +
    `📞 Your AI Phone: ${formatPhoneDisplay(aiPhoneNumber)}\n\n` +
    `Forward your business line to this number, or use it directly.\n\n` +
    `Check your email for login details.\n\n` +
    `Questions? Reply to this text or call (678) 316-1454`;
  
  return sendTelnyxSMS(phone, message);
}

module.exports = {
  sendTelnyxSMS,
  sendCallNotificationSMS,
  sendWelcomeSMS,
  formatPhoneE164,
  formatPhoneDisplay
};