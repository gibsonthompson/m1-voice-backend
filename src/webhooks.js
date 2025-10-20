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
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #111D96; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-top: none; }
          .detail { margin: 10px 0; padding: 10px; background: white; border-radius: 4px; }
          .label { font-weight: bold; color: #111D96; }
          .summary { background: #E8EAF6; padding: 15px; border-radius: 4px; margin: 15px 0; }
          .button { background: #F8B828; color: #111D96; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin-top: 15px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin: 0;">🔔 New Call Received</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">${client.business_name}</p>
          </div>
          <div class="content">
            <div class="detail">
              <span class="label">Customer:</span> ${callData.customerName}
            </div>
            <div class="detail">
              <span class="label">Phone:</span> ${callData.customerPhone}
            </div>
            <div class="detail">
              <span class="label">Time:</span> ${new Date(callData.timestamp).toLocaleString('en-US', { 
                dateStyle: 'medium', 
                timeStyle: 'short' 
              })}
            </div>
            
            <div class="summary">
              <div class="label" style="margin-bottom: 10px;">📝 Call Summary:</div>
              <p style="margin: 0;">${callData.summary}</p>
            </div>
            
            <a href="https://app.callbird.com/dashboard" class="button">View Full Transcript →</a>
            
            <p style="margin-top: 20px; font-size: 12px; color: #666;">
              This is an automated notification from CallBird AI. 
              You're receiving this because a call was received on your business line.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const { data, error } = await resend.emails.send({
      from: 'CallBird AI <notifications@callbirdai.com>',
      to: [client.email],
      subject: `🔔 New Call - ${client.business_name}`,
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

function extractCustomerName(transcript) {
  // Try to extract from AI summary first
  const summaryMatch = transcript.match(/name[,:]?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
  if (summaryMatch && summaryMatch[1]) {
    return summaryMatch[1].trim();
  }

  // Fallback to original patterns
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
  // Try to extract from AI confirmation first (most reliable)
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

  // Try standard format
  const standardMatch = transcript.match(/(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/);
  if (standardMatch) {
    const cleaned = standardMatch[1].replace(/[\s.\-]/g, '');
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    }
  }

  // Try digit by digit (must be exactly 10 digits with spaces)
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
  
  // Try to find the AI's summary section
  const summaryMatch = transcript.match(/Here's a summary of your information[,:]?(.*?)(?:Our scheduling team|Is there anything else|User:|$)/is);
  
  if (summaryMatch && summaryMatch[1]) {
    // Extract key info from AI's summary
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
  
  // Fallback: take first meaningful sentence
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
      
      const customerName = extractCustomerName(transcript);
      const customerPhone = extractPhoneNumber(transcript) || callerPhone;
      const aiSummary = generateSmartSummary(transcript);
      
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