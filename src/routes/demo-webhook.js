const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Import existing helper functions from webhooks.js
const { sendGHLSMS, formatPhoneE164, formatPhoneDisplay } = require('../webhooks');

// ============================================
// DEMO TRIAL SIGNUP WEBHOOK
// ============================================
router.post('/demo-trial-signup', async (req, res) => {
  try {
    console.log('🎯 Demo trial signup request received');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    const { message } = req.body;
    
    // Extract function call from VAPI payload structure
    const functionCall = message?.toolCallList?.[0]?.function || 
                         message?.functionCall;
    
    if (!functionCall) {
      console.log('⚠️ No function call data in request');
      return res.status(200).json({
        result: "Thanks for your interest! Visit CallBird.ai to get started."
      });
    }

    // Parse arguments (might be string or object)
    let args;
    if (typeof functionCall.arguments === 'string') {
      args = JSON.parse(functionCall.arguments);
    } else {
      args = functionCall.arguments;
    }

    const { phone_number, business_name, website } = args;
    
    console.log('📞 Demo signup data:', {
      phone: phone_number,
      business: business_name,
      website: website || 'not provided'
    });

    // Validate phone number
    const formattedPhone = formatPhoneE164(phone_number);
    if (!formattedPhone) {
      console.log('❌ Invalid phone number format');
      return res.status(200).json({
        result: "I couldn't validate that phone number. Can you verify it and try again?"
      });
    }

    // CRITICAL: Respond to VAPI immediately (< 1.5 seconds)
    res.status(200).json({
      result: "Perfect! I'm texting you the signup link right now. Check your phone!"
    });

    // NOW do the slow stuff asynchronously
    // VAPI already got its response, call continues
    console.log('⏳ Processing trial signup asynchronously...');
    
    processTrialSignup(formattedPhone, business_name, website)
      .catch(err => {
        console.error('❌ Async processing error:', err);
      });
    
  } catch (error) {
    console.error('❌ Demo trial signup error:', error);
    // Still respond to VAPI even on error
    res.status(200).json({
      result: "Thanks for your interest! I'll have our team reach out shortly."
    });
  }
});

// ============================================
// ASYNC PROCESSING FUNCTION
// ============================================
async function processTrialSignup(phone, businessName, website) {
  try {
    console.log('🔄 Starting async trial signup processing...');
    
    // Step 1: Check if phone number already exists
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id, email, business_name, subscription_status')
      .or(`owner_phone.eq.${phone},phone_number.eq.${phone}`)
      .single();
    
    if (existingClient) {
      console.log('⚠️ Phone number already exists for:', existingClient.business_name);
      
      // Send them their existing login link
      const message = `Hi! You already have a CallBird account for ${existingClient.business_name}.\n\nLogin: https://app.callbirdai.com/login\n\nForgot password? Use the reset option.\n\n- CallBird Team`;
      
      await sendGHLSMS(phone, message, businessName);
      console.log('✅ Sent existing customer SMS');
      return;
    }

    // Step 2: Create new trial account
    console.log('📝 Creating new trial account...');
    
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 7); // 7 days from now

    const { data: newClient, error: clientError } = await supabase
      .from('clients')
      .insert({
        business_name: businessName,
        business_website: website || null,
        owner_phone: phone,
        phone_number: phone, // Temporary - will be replaced with VAPI number
        email: `demo+${Date.now()}@callbird.ai`, // Placeholder - they'll set real email
        industry: 'home_services', // Default - they can change
        subscription_status: 'trial',
        plan_type: 'Starter',
        trial_ends_at: trialEndsAt.toISOString(),
        monthly_call_limit: 50,
        calls_this_month: 0,
        status: 'pending_setup' // Will change to 'active' after they complete onboarding
      })
      .select()
      .single();

    if (clientError) {
      console.error('❌ Error creating trial account:', clientError);
      throw clientError;
    }

    console.log('✅ Trial account created:', newClient.id);

    // Step 3: Send SMS with signup link
    const signupLink = `https://app.callbirdai.com/complete-signup?id=${newClient.id}&phone=${encodeURIComponent(phone)}`;
    
    const message = `Hi from CallBird! 👋

Thanks for trying our demo. Ready for the full experience?

Complete your FREE 7-day trial setup:
${signupLink}

No credit card required. Takes 2 minutes.

Questions? Reply to this text.

- The CallBird Team`;

    const smsSent = await sendGHLSMS(phone, message, businessName);
    
    if (smsSent) {
      console.log('✅ Trial signup SMS sent successfully');
      
      // Step 4: If website provided, trigger scraping (optional - can do later)
      if (website && website.trim().length > 0) {
        console.log('📄 Website provided, can scrape later:', website);
        // You can trigger your existing website scraping here if needed
        // For now, they'll add it during signup completion
      }
      
      console.log('🎉 Trial signup processing complete!');
    } else {
      console.error('❌ Failed to send trial SMS');
    }
    
  } catch (error) {
    console.error('❌ Trial signup processing failed:', error);
    throw error;
  }
}

module.exports = router;