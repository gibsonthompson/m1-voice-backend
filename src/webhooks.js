const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const { Resend } = require('resend');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

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

// Send email notification via Resend
async function sendEmailNotification(client, callData) {
  try {
    console.log('📧 Sending email notification to:', client.email);
    
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #FAFAF8;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(18, 32, 146, 0.08);
    }
    .header {
      background: linear-gradient(135deg, #122092 0%, #1a2db5 100%);
      padding: 32px 24px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      color: #FAFAF8;
      font-size: 24px;
      font-weight: 600;
      letter-spacing: -0.5px;
    }
    .header p {
      margin: 8px 0 0 0;
      color: #FAFAF8;
      font-size: 14px;
      opacity: 0.9;
    }
    .content {
      padding: 32px 24px;
    }
    .call-info {
      background-color: #FAFAF8;
      border-left: 4px solid #F8B828;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .info-row {
      display: flex;
      margin-bottom: 12px;
      align-items: flex-start;
    }
    .info-row:last-child {
      margin-bottom: 0;
    }
    .info-label {
      font-weight: 600;
      color: #122092;
      min-width: 120px;
      font-size: 14px;
    }
    .info-value {
      color: #2d3748;
      font-size: 14px;
      line-height: 1.6;
    }
    .summary-box {
      background-color: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .summary-title {
      color: #122092;
      font-size: 16px;
      font-weight: 600;
      margin: 0 0 12px 0;
    }
    .summary-text {
      color: #4a5568;
      font-size: 14px;
      line-height: 1.7;
      margin: 0;
    }
    .button-container {
      text-align: center;
      margin: 32px 0;
    }
    .button {
      display: inline-block;
      background-color: #122092;
      color: #FAFAF8;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 15px;
      transition: background-color 0.2s;
      box-shadow: 0 2px 4px rgba(18, 32, 146, 0.2);
    }
    .button:hover {
      background-color: #0d1870;
    }
    .footer {
      background-color: #FAFAF8;
      padding: 24px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
    }
    .footer-text {
      color: #718096;
      font-size: 13px;
      margin: 0;
      line-height: 1.6;
    }
    .timestamp {
      color: #a0aec0;
      font-size: 12px;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔔 New Call Received</h1>
      <p>CallBird AI Notification</p>
    </div>
    
    <div class="content">
      <div class="call-info">
        <div class="info-row">
          <div class="info-label">Customer:</div>
          <div class="info-value"><strong>${callData.customerName}</strong></div>
        </div>
        <div class="info-row">
          <div class="info-label">Phone:</div>
          <div class="info-value">${callData.customerPhone}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Business:</div>
          <div class="info-value">${client.business_name}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Time:</div>
          <div class="info-value">${new Date(callData.timestamp).toLocaleString('en-US', { 
            dateStyle: 'medium', 
            timeStyle: 'short' 
          })}</div>
        </div>
      </div>

      <div class="summary-box">
        <h2 class="summary-title">Call Summary</h2>
        <p class="summary-text">${callData.summary}</p>
      </div>

      <div class="button-container">
        <a href="https://callbirdai.com/dashboard" class="button">View Full Details</a>
      </div>
    </div>

    <div class="footer">
      <p class="footer-text">
        This is an automated notification from CallBird AI<br>
        You're receiving this because a call was received at your business
      </p>
      <p class="timestamp">Sent at ${new Date(callData.timestamp).toLocaleString('en-US', { 
        dateStyle: 'full', 
        timeStyle: 'long' 
      })}</p>
    </div>
  </div>
</body>
</html>
    `;

    const { data, error } = await resend.emails.send({
      from: 'CallBird AI <notifications@callbirdai.com>',
      to: [client.email],
      subject: `🔔 New Call from ${callData.customerName} - ${client.business_name}`,
      html: emailHtml
    });

    if (error) {
      console.error('❌ Resend error:', error);
      return false;
    }

    console.log('✅ Email sent successfully:', data.id);
    return true;

  } catch (error) {
    console.error('❌ Email error:', error);
    return false;
  }
}

// Fallback extraction functions (used if VAPI analysis fails)
function extractCustomerName(transcript) {
  const summaryMatch = transcript.match(/name[,:]?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
  if (summaryMatch && summaryMatch[1]) {
    return summaryMatch[1].trim();
  }

  const patterns = [
    /my name is ([a-z\s]+?)(?:\.|,|$|user:|ai:|email)/i,
    /this is ([a-z\s]+?)(?:\.|,|$|user:|ai:|email)/i,
    /i'm ([a-z\s]+?)(?:\.|,|$|user:|ai:|email)/i,
  ];
  
  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      if (name.length < 3 || name.length > 50) continue;
      if (['hello', 'thanks', 'thank you', 'sorry'].includes(name.toLowerCase())) continue;
      
      return name.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
  }
  
  return 'Unknown Caller';
}

function extractPhoneNumber(transcript) {
  const confirmMatch = transcript.match(/(?:phone[,:]?|that is)\s+((?:\d[\s.]*){10,11})/i);
  if (confirmMatch) {
    const cleaned = confirmMatch[1].replace(/[\s.\-()]/g, '');
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    }
    if (cleaned.length === 11 && cleaned[0] === '1') {
      return `+${cleaned}`;
    }
  }

  const standardMatch = transcript.match(/(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/);
  if (standardMatch) {
    const cleaned = standardMatch[1].replace(/[\s.\-]/g, '');
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    }
  }

  const digitMatch = transcript.match(/(\d\s+\d\s+\d\s+\d\s+\d\s+\d\s+\d\s+\d\s+\d\s+\d)(?!\s*\d)/);
  if (digitMatch) {
    const cleaned = digitMatch[1].replace(/\s+/g, '');
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    }
  }
  
  return 'Unknown';
}

function generateSmartSummary(transcript) {
  if (!transcript) return 'Call completed - no transcript available';
  
  const summaryMatch = transcript.match(/Here's a summary of your information[,:]?(.*?)(?:Our scheduling team|Is there anything else|User:|$)/is);
  
  if (summaryMatch && summaryMatch[1]) {
    const summaryText = summaryMatch[1].trim();
    
    const name = summaryText.match(/name[,:]?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i)?.[1];
    const phone = summaryText.match(/phone[,:]?\s+([\d\s.]+)/i)?.[1]?.replace(/\s+/g, '-');
    const service = summaryText.match(/service needed[,:]?\s+([^.]+)/i)?.[1]?.trim();
    const timing = summaryText.match(/(?:preferred timing|appointment)[,:]?\s+([^.]+)/i)?.[1]?.trim();
    
    let summary = '';
    if (name) summary += `${name} `;
    summary += 'called to schedule ';
    if (service) summary += `${service} `;
    if (timing) summary += `for ${timing}. `;
    if (phone) summary += `Phone: ${phone}.`;
    
    if (summary.length > 20) {
      return summary.trim();
    }
  }
  
  const cleaned = transcript.trim();
  const firstSentence = cleaned.split(/[.!?]/).filter(s => s.trim().length > 10)[0];
  
  if (firstSentence && firstSentence.length < 200) {
    return firstSentence.trim() + '.';
  }
  
  return cleaned.substring(0, 200) + (cleaned.length > 200 ? '...' : '');
}

async function handleVapiWebhook(req, res) {
  try {
    console.log('📞 VAPI webhook received');
    
    const message = req.body.message;
    
    if (message?.type === 'end-of-call-report') {
      const call = message.call;
      const phoneNumberId = call.phoneNumberId;
      
      const phoneNumber = await getPhoneNumberFromVapi(phoneNumberId);

      if (!phoneNumber) {
        console.log('⚠️ Could not get phone number from VAPI');
        return res.status(200).json({ received: true });
      }

      console.log('📱 Phone number:', phoneNumber);

      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('vapi_phone_number', phoneNumber)
        .single();

      if (clientError || !client) {
        console.log('⚠️ No client found for phone:', phoneNumber);
        return res.status(200).json({ received: true });
      }

      console.log('✅ Client found:', client.business_name);

      const transcript = message.transcript || '';
      const callerPhone = call.customer?.number || 'Unknown';
      
      // Try to get structured data from VAPI analysis first
      const analysis = call.analysis || {};
      const structuredData = analysis.structuredData || {};
      
      // Use VAPI's extracted data if available, otherwise fallback to regex
      const customerName = structuredData.customerName || extractCustomerName(transcript);
      const customerPhone = structuredData.customerPhone || extractPhoneNumber(transcript) || callerPhone;
      const aiSummary = analysis.summary || generateSmartSummary(transcript);
      
      console.log('📊 Extracted data:', {
        name: customerName,
        phone: customerPhone,
        summary: aiSummary.substring(0, 100) + '...'
      });
      
      const callRecord = {
        client_id: client.id,
        customer_name: customerName,
        customer_phone: customerPhone,
        ai_summary: aiSummary,
        transcript: transcript,
        created_at: new Date().toISOString()
      };

      console.log('💾 Saving call to Supabase...');

      const { data: insertedCall, error: insertError } = await supabase
        .from('calls')
        .insert([callRecord])
        .select();
      
      if (insertError) {
        console.error('❌ Error inserting call:', insertError);
        return res.status(500).json({ error: 'Failed to save call' });
      }
      
      console.log('✅ Call saved successfully');

      // Send email notification via Resend
      if (client.email && process.env.RESEND_API_KEY) {
        console.log('📧 Attempting to send email notification...');
        
        await sendEmailNotification(client, {
          customerName,
          customerPhone,
          summary: aiSummary,
          timestamp: new Date().toISOString()
        });
      } else {
        console.log('⚠️ Email not configured (missing client email or RESEND_API_KEY)');
      }

      return res.status(200).json({ 
        received: true,
        saved: true,
        callId: insertedCall[0]?.id
      });
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    return res.status(500).json({ error: error.message });
  }
}

module.exports = { handleVapiWebhook };