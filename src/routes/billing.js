const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Price IDs
const PRICE_IDS = {
  starter: 'price_1SLxCFECyXQyJHEs4qn05Zh9',
  growth: 'price_1SLxBDECyXQyJHEsweVK4Qwh',
  pro: 'price_1SLxC4ECyXQyJHEss4ctfu8c'
};

// Create checkout session
async function createCheckoutSession(req, res) {
  try {
    const { client_id, plan } = req.body;

    if (!client_id || !plan) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['client_id', 'plan']
      });
    }

    // Validate plan
    if (!PRICE_IDS[plan]) {
      return res.status(400).json({ 
        error: 'Invalid plan',
        valid_plans: ['starter', 'growth', 'pro']
      });
    }

    // Get client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', client_id)
      .single();

    if (clientError || !client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    console.log('🛒 Creating checkout session for:', client.email, 'Plan:', plan);

    // Create or get Stripe customer
    let customerId = client.stripe_customer_id;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: client.email,
        name: client.contact_name || client.business_name,
        metadata: {
          client_id: client_id,
          business_name: client.business_name
        }
      });
      customerId = customer.id;

      // Update client with customer ID
      await supabase
        .from('clients')
        .update({ stripe_customer_id: customerId })
        .eq('id', client_id);
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: PRICE_IDS[plan],
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: {
          client_id: client_id,
          plan: plan
        }
      },
      success_url: `${process.env.FRONTEND_URL || 'https://callbird-dashboard.vercel.app'}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'https://callbird-dashboard.vercel.app'}/billing?canceled=true`,
      metadata: {
        client_id: client_id,
        plan: plan
      }
    });

    console.log('✅ Checkout session created:', session.id);

    res.json({
      success: true,
      sessionId: session.id,
      url: session.url
    });

  } catch (error) {
    console.error('❌ Checkout session error:', error);
    res.status(500).json({ 
      error: 'Failed to create checkout session',
      message: error.message 
    });
  }
}

// Create customer portal session
async function createPortalSession(req, res) {
  try {
    const { client_id } = req.body;

    if (!client_id) {
      return res.status(400).json({ error: 'client_id required' });
    }

    // Get client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', client_id)
      .single();

    if (clientError || !client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    if (!client.stripe_customer_id) {
      return res.status(400).json({ error: 'No Stripe customer found' });
    }

    console.log('🔗 Creating portal session for:', client.email);

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: client.stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL || 'https://callbird-dashboard.vercel.app'}/billing`,
    });

    console.log('✅ Portal session created');

    res.json({
      success: true,
      url: session.url
    });

  } catch (error) {
    console.error('❌ Portal session error:', error);
    res.status(500).json({ 
      error: 'Failed to create portal session',
      message: error.message 
    });
  }
}

// Get subscription status
async function getSubscriptionStatus(req, res) {
  try {
    const { client_id } = req.params;

    if (!client_id) {
      return res.status(400).json({ error: 'client_id required' });
    }

    const { data: client, error } = await supabase
      .from('clients')
      .select('subscription_status, plan_type, monthly_call_limit, calls_this_month, trial_ends_at, stripe_subscription_id')
      .eq('id', client_id)
      .single();

    if (error || !client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // If they have a subscription, get latest from Stripe
    if (client.stripe_subscription_id) {
      const subscription = await stripe.subscriptions.retrieve(client.stripe_subscription_id);
      
      return res.json({
        success: true,
        subscription_status: subscription.status,
        plan_type: client.plan_type,
        monthly_call_limit: client.monthly_call_limit,
        calls_this_month: client.calls_this_month,
        trial_ends_at: client.trial_ends_at,
        current_period_end: new Date(subscription.current_period_end * 1000),
        cancel_at_period_end: subscription.cancel_at_period_end
      });
    }

    // Return trial status
    res.json({
      success: true,
      subscription_status: client.subscription_status,
      plan_type: client.plan_type || 'starter',
      monthly_call_limit: client.monthly_call_limit || 100,
      calls_this_month: client.calls_this_month || 0,
      trial_ends_at: client.trial_ends_at
    });

  } catch (error) {
    console.error('❌ Get subscription error:', error);
    res.status(500).json({ 
      error: 'Failed to get subscription status',
      message: error.message 
    });
  }
}

module.exports = {
  createCheckoutSession,
  createPortalSession,
  getSubscriptionStatus
};