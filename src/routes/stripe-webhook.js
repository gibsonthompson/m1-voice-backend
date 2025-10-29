const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');
const { getPaymentConfirmationEmail } = require('../email-templates');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Helper: Send email via Resend
async function sendEmail(emailData) {
  try {
    console.log(`📧 Sending email to ${emailData.to}...`);
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'CallBird AI <onboarding@callbirdai.com>',
        to: [emailData.to],
        subject: emailData.subject,
        html: emailData.html
      })
    });

    if (!response.ok) {
      console.error('❌ Email send failed:', await response.text());
      return { success: false };
    }

    const result = await response.json();
    console.log('✅ Email sent successfully:', result.id);
    return { success: true, data: result };
    
  } catch (error) {
    console.error('❌ Email error:', error);
    return { success: false, error: error.message };
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

// Helper: Get plan details from price ID
function getPlanDetails(priceId) {
  // Your actual Stripe Price IDs
  const plans = {
    'price_1SLxCFECyXQyJHEs4qn05Zh9': { name: 'starter', callLimit: 100 },
    'price_1SLxBDECyXQyJHEsweVK4Qwh': { name: 'professional', callLimit: 250 },
    'price_1SLxC4ECyXQyJHEss4ctfu8c': { name: 'enterprise', callLimit: 500 },
  };
  
  return plans[priceId] || { name: 'starter', callLimit: 100 };
}

// Helper: Re-enable VAPI assistant after payment
async function reEnableVAPIAssistant(client) {
  try {
    console.log(`🔊 Re-enabling VAPI assistant: ${client.vapi_assistant_id}`);

    // Restore the assistant's original functionality
    const businessName = client.business_name;

    // Professional prompt that restores full functionality
    const restoredPrompt = `You are a professional AI receptionist for ${businessName}.

Your role is to:
- Answer calls professionally and courteously
- Provide information about the business
- Take messages from customers
- Collect customer contact information (name, phone, reason for calling)
- Assess the urgency of inquiries

Always be helpful, professional, and represent ${businessName} well.`;

    const vapiUpdateResponse = await fetch(
      `https://api.vapi.ai/assistant/${client.vapi_assistant_id}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: {
            messages: [{
              role: 'system',
              content: restoredPrompt
            }]
          }
        })
      }
    );

    if (vapiUpdateResponse.ok) {
      console.log('✅ VAPI assistant re-enabled successfully');
      return true;
    } else {
      const errorText = await vapiUpdateResponse.text();
      console.error('❌ Failed to re-enable VAPI assistant:', errorText);
      return false;
    }

  } catch (error) {
    console.error('❌ Error re-enabling VAPI assistant:', error);
    return false;
  }
}

// Handle: checkout.session.completed (NEW - for GHL checkout)
async function handleCheckoutCompleted(session) {
  console.log('🎉 Checkout completed:', session.id);
  
  const customerId = session.customer;
  const subscriptionId = session.subscription;
  
  try {
    // Find client by Stripe customer ID
    const client = await getClientByStripeCustomerId(customerId);
    
    if (!client) {
      console.error('❌ Client not found for customer:', customerId);
      return;
    }
    
    // Get subscription details from Stripe
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const priceId = subscription.items.data[0].price.id;
    
    // Get plan details
    const planDetails = getPlanDetails(priceId);
    
    // Update client record - ACTIVATE SUBSCRIPTION & REMOVE TRIAL
    const { error: updateError } = await supabase
      .from('clients')
      .update({
        subscription_status: 'active',  // 🔥 THIS REMOVES TRIAL BANNER
        stripe_subscription_id: subscriptionId,
        plan_type: planDetails.name,
        monthly_call_limit: planDetails.callLimit,
        calls_this_month: 0,
        trial_ends_at: null,  // Clear trial date
        updated_at: new Date().toISOString()
      })
      .eq('id', client.id);
    
    if (updateError) {
      console.error('❌ Error updating client:', updateError);
      return;
    }
    
    // ============================================
    // 🆕 ALWAYS RE-ENABLE VAPI ASSISTANT AFTER PAYMENT
    // ============================================
    if (client.vapi_assistant_id) {
      console.log('🔓 Re-enabling VAPI assistant after payment...');
      await reEnableVAPIAssistant(client);
    }
    
    // Log event
    await supabase.from('subscription_events').insert({
      client_id: client.id,
      event_type: 'checkout_completed',
      stripe_event_id: session.id,
      metadata: { plan_type: planDetails.name, price_id: priceId }
    });
    
    console.log('✅ Client upgraded successfully:', {
      clientId: client.id,
      plan: planDetails.name,
      status: 'active'
    });
    
    // ============================================
    // 🆕 SEND PAYMENT CONFIRMATION EMAIL
    // Using branded template from email-templates.js
    // ============================================
    console.log('📧 Sending payment confirmation email...');
    
    try {
      const clientData = {
        business_name: client.business_name,
        first_name: client.owner_name || client.business_name,
        email: client.email,
        phone_number: client.vapi_phone_number,
        plan_type: planDetails.name,
        amount: (session.amount_total / 100).toFixed(2)
      };

      const emailData = getPaymentConfirmationEmail(clientData);
      const emailResult = await sendEmail(emailData);

      // Log the email
      if (emailResult.success) {
        await supabase.from('email_logs').insert([{
          client_id: client.id,
          email_type: 'payment_confirmation',
          recipient_email: client.email,
          sent_at: new Date().toISOString(),
          status: 'sent',
          resend_id: emailResult.data?.id
        }]);
        console.log('✅ Payment confirmation email sent');
      }
    } catch (emailError) {
      console.error('⚠️ Email error (non-blocking):', emailError);
      // Don't fail the whole process if email fails
    }
    
  } catch (error) {
    console.error('❌ Error handling checkout:', error);
  }
}

// Handle: customer.subscription.created
async function handleSubscriptionCreated(subscription) {
  console.log('📝 Subscription created:', subscription.id);

  const client = await getClientByStripeCustomerId(subscription.customer);
  if (!client) {
    console.error('❌ Client not found for customer:', subscription.customer);
    return;
  }

  // Get plan details from price ID
  const priceId = subscription.items.data[0].price.id;
  const planDetails = getPlanDetails(priceId);

  // Update client with subscription details
  const { error } = await supabase
    .from('clients')
    .update({
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status,
      plan_type: planDetails.name,
      monthly_call_limit: planDetails.callLimit,
      trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null
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
    metadata: { plan_type: planDetails.name, price_id: priceId }
  });

  console.log('✅ Subscription created for client:', client.business_name);
}

// Handle: customer.subscription.updated
async function handleSubscriptionUpdated(subscription) {
  console.log('🔄 Subscription updated:', subscription.id);

  const client = await getClientByStripeCustomerId(subscription.customer);
  if (!client) return;

  const { error } = await supabase
    .from('clients')
    .update({
      subscription_status: subscription.status
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
      subscription_status: 'cancelled'
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
  await sendEmail({
    to: client.email,
    subject: 'CallBird Subscription Cancelled',
    html: `
      <h2>Your subscription has been cancelled</h2>
      <p>Hi ${client.owner_name || client.business_name},</p>
      <p>Your CallBird subscription has been cancelled. Your AI receptionist will stop taking calls at the end of your billing period.</p>
      <p>We're sorry to see you go! If you'd like to reactivate, you can do so anytime from your dashboard.</p>
      <p><a href="https://app.callbirdai.com">Reactivate Subscription</a></p>
    `
  });
}

// Handle: invoice.payment_succeeded
async function handlePaymentSucceeded(invoice) {
  console.log('✅ Payment succeeded:', invoice.id);

  const client = await getClientByStripeCustomerId(invoice.customer);
  if (!client) return;

  // Ensure subscription is active
  const { error } = await supabase
    .from('clients')
    .update({
      subscription_status: 'active',
      calls_this_month: 0  // Reset for new billing period
    })
    .eq('id', client.id);

  if (error) {
    console.error('❌ Error updating payment status:', error);
  }

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
  await sendEmail({
    to: client.email,
    subject: 'CallBird Payment Receipt',
    html: `
      <h2>Payment Received - Thank You!</h2>
      <p>Hi ${client.owner_name || client.business_name},</p>
      <p>We've successfully processed your payment of $${(invoice.amount_paid / 100).toFixed(2)}.</p>
      <p>Your CallBird subscription remains active.</p>
      <p><a href="${invoice.hosted_invoice_url}">View Invoice</a></p>
    `
  });
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
      subscription_status: 'past_due'
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
  await sendEmail({
    to: client.email,
    subject: '🚨 CallBird Payment Failed - Action Required',
    html: `
      <h2>Payment Failed - Update Your Payment Method</h2>
      <p>Hi ${client.owner_name || client.business_name},</p>
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
  });
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
  await sendEmail({
    to: client.email,
    subject: `⏰ Your CallBird Trial Ends in ${daysLeft} Days`,
    html: `
      <h2>Your trial is ending soon</h2>
      <p>Hi ${client.owner_name || client.business_name},</p>
      <p>Your 7-day CallBird trial ends in <strong>${daysLeft} days</strong> on ${trialEnd.toLocaleDateString()}.</p>
      <p><strong>Don't lose access to your AI receptionist!</strong></p>
      <p>Upgrade now to keep your calls flowing smoothly.</p>
      <p><a href="https://app.callbirdai.com" style="background: #111D96; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Upgrade Now</a></p>
    `
  });
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
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;

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