const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Helper: Send email via Resend
async function sendEmail(to, subject, html) {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'CallBird <notifications@callbirdai.com>',
        to: [to],
        subject: subject,
        html: html
      })
    });

    if (!response.ok) {
      console.error('❌ Email send failed:', await response.text());
      return false;
    }

    console.log('✅ Email sent successfully');
    return true;
  } catch (error) {
    console.error('❌ Email error:', error);
    return false;
  }
}

// Helper: Get client by Stripe customer ID
async function getClientByStripeCustomerId(customerId) {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .single();

  if (error) {
    console.error('Error fetching client:', error);
    return null;
  }

  return data;
}

// Handle: customer.subscription.created
async function handleSubscriptionCreated(subscription) {
  console.log('📝 Subscription created:', subscription.id);

  const client = await getClientByStripeCustomerId(subscription.customer);
  if (!client) {
    console.error('❌ Client not found for customer:', subscription.customer);
    return;
  }

  // Determine plan details
  const priceId = subscription.items.data[0].price.id;
  let planType = 'starter';
  let callLimit = 100;

  if (priceId === 'price_1SLxBDECyXQyJHEsweVK4Qwh') {
    planType = 'growth';
    callLimit = 500;
  } else if (priceId === 'price_1SLxC4ECyXQyJHEss4ctfu8c') {
    planType = 'pro';
    callLimit = 2000;
  }

  // Update client with subscription details
  const { error } = await supabase
    .from('clients')
    .update({
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status,
      plan_type: planType,
      monthly_call_limit: callLimit,
      trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      status: 'active'
    })
    .eq('id', client.id);

  if (error) {
    console.error('❌ Error updating client:', error);
    return;
  }

  // Log event
  await supabase.from('subscription_events').insert({
    client_id: client.id,
    event_type: 'subscription_created',
    stripe_event_id: subscription.id,
    metadata: { plan_type: planType, price_id: priceId }
  });

  console.log('✅ Subscription created for client:', client.business_name);

  // Send confirmation email
  await sendEmail(
    client.email,
    'Welcome to CallBird - Subscription Active!',
    `
      <h2>Your CallBird subscription is now active!</h2>
      <p>Hi ${client.contact_name},</p>
      <p>Thank you for subscribing to CallBird ${planType.charAt(0).toUpperCase() + planType.slice(1)} plan.</p>
      <p><strong>Plan Details:</strong></p>
      <ul>
        <li>Monthly call limit: ${callLimit} calls</li>
        <li>AI Phone: ${client.vapi_phone_number}</li>
      </ul>
      <p>Your AI receptionist is ready to take calls!</p>
      <p><a href="https://callbird-dashboard.vercel.app">View Dashboard</a></p>
    `
  );
}

// Handle: customer.subscription.updated
async function handleSubscriptionUpdated(subscription) {
  console.log('🔄 Subscription updated:', subscription.id);

  const client = await getClientByStripeCustomerId(subscription.customer);
  if (!client) return;

  const { error } = await supabase
    .from('clients')
    .update({
      subscription_status: subscription.status,
      status: subscription.status === 'active' ? 'active' : 'suspended'
    })
    .eq('id', client.id);

  if (error) {
    console.error('❌ Error updating subscription status:', error);
    return;
  }

  // Log event
  await supabase.from('subscription_events').insert({
    client_id: client.id,
    event_type: 'subscription_updated',
    stripe_event_id: subscription.id,
    metadata: { status: subscription.status }
  });

  console.log('✅ Subscription updated for:', client.business_name);
}

// Handle: customer.subscription.deleted
async function handleSubscriptionDeleted(subscription) {
  console.log('❌ Subscription cancelled:', subscription.id);

  const client = await getClientByStripeCustomerId(subscription.customer);
  if (!client) return;

  const { error } = await supabase
    .from('clients')
    .update({
      subscription_status: 'cancelled',
      status: 'suspended'
    })
    .eq('id', client.id);

  if (error) {
    console.error('❌ Error cancelling subscription:', error);
    return;
  }

  // Log event
  await supabase.from('subscription_events').insert({
    client_id: client.id,
    event_type: 'subscription_cancelled',
    stripe_event_id: subscription.id,
    metadata: { cancelled_at: new Date() }
  });

  console.log('✅ Subscription cancelled for:', client.business_name);

  // Send cancellation email
  await sendEmail(
    client.email,
    'CallBird Subscription Cancelled',
    `
      <h2>Your subscription has been cancelled</h2>
      <p>Hi ${client.contact_name},</p>
      <p>Your CallBird subscription has been cancelled. Your AI receptionist will stop taking calls at the end of your billing period.</p>
      <p>We're sorry to see you go! If you'd like to reactivate, you can do so anytime from your dashboard.</p>
      <p><a href="https://callbird-dashboard.vercel.app">Reactivate Subscription</a></p>
    `
  );
}

// Handle: invoice.payment_succeeded
async function handlePaymentSucceeded(invoice) {
  console.log('✅ Payment succeeded:', invoice.id);

  const client = await getClientByStripeCustomerId(invoice.customer);
  if (!client) return;

  // Log event
  await supabase.from('subscription_events').insert({
    client_id: client.id,
    event_type: 'payment_succeeded',
    stripe_event_id: invoice.id,
    metadata: { 
      amount: invoice.amount_paid,
      currency: invoice.currency
    }
  });

  console.log('✅ Payment logged for:', client.business_name);

  // Send receipt email
  await sendEmail(
    client.email,
    'CallBird Payment Receipt',
    `
      <h2>Payment Received - Thank You!</h2>
      <p>Hi ${client.contact_name},</p>
      <p>We've successfully processed your payment of $${(invoice.amount_paid / 100).toFixed(2)}.</p>
      <p>Your CallBird subscription remains active.</p>
      <p><a href="${invoice.hosted_invoice_url}">View Invoice</a></p>
    `
  );
}

// Handle: invoice.payment_failed
async function handlePaymentFailed(invoice) {
  console.log('❌ Payment failed:', invoice.id);

  const client = await getClientByStripeCustomerId(invoice.customer);
  if (!client) return;

  // Update status to past_due
  const { error } = await supabase
    .from('clients')
    .update({
      subscription_status: 'past_due',
      status: 'suspended'
    })
    .eq('id', client.id);

  if (error) {
    console.error('❌ Error updating payment failed status:', error);
    return;
  }

  // Log event
  await supabase.from('subscription_events').insert({
    client_id: client.id,
    event_type: 'payment_failed',
    stripe_event_id: invoice.id,
    metadata: { 
      amount: invoice.amount_due,
      attempt_count: invoice.attempt_count
    }
  });

  console.log('⚠️ Payment failed for:', client.business_name);

  // Send urgent email
  await sendEmail(
    client.email,
    '🚨 CallBird Payment Failed - Action Required',
    `
      <h2>Payment Failed - Update Your Payment Method</h2>
      <p>Hi ${client.contact_name},</p>
      <p><strong>We were unable to process your payment of $${(invoice.amount_due / 100).toFixed(2)}.</strong></p>
      <p>Your CallBird AI receptionist has been temporarily suspended.</p>
      <p><strong>To reactivate your service:</strong></p>
      <ol>
        <li>Update your payment method</li>
        <li>We'll automatically retry the payment</li>
        <li>Your service will resume immediately</li>
      </ol>
      <p><a href="${invoice.hosted_invoice_url}" style="background: #111D96; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Update Payment Method</a></p>
      <p style="color: #dc2626; margin-top: 20px;"><strong>Act now to avoid service interruption!</strong></p>
    `
  );
}

// Handle: customer.subscription.trial_will_end
async function handleTrialWillEnd(subscription) {
  console.log('⏰ Trial ending soon:', subscription.id);

  const client = await getClientByStripeCustomerId(subscription.customer);
  if (!client) return;

  const trialEnd = new Date(subscription.trial_end * 1000);
  const daysLeft = Math.ceil((trialEnd - new Date()) / (1000 * 60 * 60 * 24));

  // Log event
  await supabase.from('subscription_events').insert({
    client_id: client.id,
    event_type: 'trial_ending',
    stripe_event_id: subscription.id,
    metadata: { days_left: daysLeft, trial_end: trialEnd }
  });

  // Send reminder email
  await sendEmail(
    client.email,
    `⏰ Your CallBird Trial Ends in ${daysLeft} Days`,
    `
      <h2>Your trial is ending soon</h2>
      <p>Hi ${client.contact_name},</p>
      <p>Your 7-day CallBird trial ends in <strong>${daysLeft} days</strong> on ${trialEnd.toLocaleDateString()}.</p>
      <p><strong>Don't lose access to your AI receptionist!</strong></p>
      <p>Your subscription will automatically continue at $${subscription.items.data[0].price.unit_amount / 100}/month. No action needed.</p>
      <p>Want to upgrade or cancel? You can manage your subscription anytime.</p>
      <p><a href="https://callbird-dashboard.vercel.app/billing">Manage Subscription</a></p>
    `
  );
}

// Main webhook handler
async function handleStripeWebhook(req, res) {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('⚠️ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('📥 Stripe webhook received:', event.type);

  // Handle the event
  try {
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

module.exports = { handleStripeWebhook };