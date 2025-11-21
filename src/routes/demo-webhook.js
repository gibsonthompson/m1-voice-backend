const express = require('express');
const router = express.Router();

// Import SMS helper from webhooks.js
const { sendGHLSMS, formatPhoneE164 } = require('../webhooks');

// ============================================
// DEMO TRIAL SIGNUP WEBHOOK (SIMPLIFIED)
// ============================================
router.post('/demo-trial-signup', async (req, res) => {
  try {
    console.log('🎯 Demo trial signup request received');
    
    const { message } = req.body;
    
    // Extract function call from VAPI
    const functionCall = message?.toolCallList?.[0]?.function || 
                         message?.functionCall;
    
    if (!functionCall) {
      return res.status(200).json({
        result: "Thanks for your interest! Visit CallBird.ai to get started."
      });
    }

    // Parse phone number and business name
    let args = typeof functionCall.arguments === 'string' 
      ? JSON.parse(functionCall.arguments) 
      : functionCall.arguments;
    
    const { phone_number, business_name } = args;
    
    console.log('📞 Extracted data:');
    console.log('   Phone:', phone_number);
    console.log('   Business:', business_name);

    // Validate and format phone
    const phone = formatPhoneE164(phone_number);
    if (!phone) {
      return res.status(200).json({
        result: "I couldn't validate that phone number. Can you verify it?"
      });
    }

    // RESPOND TO VAPI IMMEDIATELY (< 1.5 seconds)
    res.status(200).json({
      result: "Perfect! I'm texting you the signup link right now. Check your phone!"
    });

    // Send SMS asynchronously (after VAPI response)
    sendDemoSMS(phone, business_name).catch(err => {
      console.error('❌ SMS send error:', err);
    });
    
  } catch (error) {
    console.error('❌ Demo webhook error:', error);
    res.status(200).json({
      result: "Thanks for trying CallBird! Visit callbirdai.com to get started."
    });
  }
});

// ============================================
// SIMPLE SMS SENDER (NO DATABASE)
// ============================================
async function sendDemoSMS(phone, businessName) {
  console.log('📱 Sending demo SMS to:', phone);
  
  const message = `Hi from CallBird! 👋

Thanks for trying our demo. Ready to get started?

Start your FREE 7-day trial:
https://callbirdai.com/signup

No credit card required. Questions? Reply to this text.

- The CallBird Team`;

  try {
    const sent = await sendGHLSMS(phone, message, businessName);
    
    if (sent) {
      console.log('✅ Demo SMS sent successfully to:', phone);
    } else {
      console.error('❌ Demo SMS failed for:', phone);
    }
  } catch (error) {
    console.error('❌ SMS error:', error);
  }
}

module.exports = router;