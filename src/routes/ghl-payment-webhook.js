const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Handle GHL signup + Stripe customer creation
async function handleGHLPaymentWebhook(req, res) {
  console.log('📥 GHL Payment Webhook received');

  try {
    const {
      email,
      contact_name,
      business_name,
      phone,
      client_id // This should be passed from your main ghl-signup.js after creating the client
    } = req.body;

    // Validate required fields
    if (!email || !client_id) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['email', 'client_id']
      });
    }

    console.log('📝 Creating Stripe customer for:', email);

    // Create Stripe customer
    const customer = await stripe.customers.create({
      email: email,
      name: contact_name || business_name,
      metadata: {
        client_id: client_id,
        business_name: business_name || '',
        phone: phone || ''
      }
    });

    console.log('✅ Stripe customer created:', customer.id);

    // Calculate trial end date (7 days from now)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 7);

    // Update client with Stripe customer ID and trial info
    const { data: updatedClient, error: updateError } = await supabase
      .from('clients')
      .update({
        stripe_customer_id: customer.id,
        subscription_status: 'trial',
        trial_ends_at: trialEndsAt.toISOString(),
        status: 'active' // Active during trial
      })
      .eq('id', client_id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Error updating client with Stripe info:', updateError);
      return res.status(500).json({ error: 'Failed to update client' });
    }

    console.log('✅ Client updated with Stripe customer ID');

    // Log the event
    await supabase.from('subscription_events').insert({
      client_id: client_id,
      event_type: 'trial_started',
      stripe_event_id: customer.id,
      metadata: {
        trial_ends_at: trialEndsAt,
        stripe_customer_id: customer.id
      }
    });

    res.json({
      success: true,
      stripe_customer_id: customer.id,
      trial_ends_at: trialEndsAt,
      message: 'Stripe customer created and trial started'
    });

  } catch (error) {
    console.error('❌ GHL Payment Webhook Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

module.exports = { handleGHLPaymentWebhook };