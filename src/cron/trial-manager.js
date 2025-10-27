const { createClient } = require('@supabase/supabase-js');

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

    return true;
  } catch (error) {
    console.error('❌ Email error:', error);
    return false;
  }
}

// Check for trials expiring in 24 hours
async function checkExpiringTrials() {
  console.log('⏰ Checking for expiring trials...');

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { data: expiringClients, error } = await supabase
    .from('clients')
    .select('*')
    .eq('subscription_status', 'trial')
    .lte('trial_ends_at', tomorrow.toISOString())
    .gte('trial_ends_at', new Date().toISOString());

  if (error) {
    console.error('❌ Error fetching expiring trials:', error);
    return;
  }

  console.log(`📊 Found ${expiringClients.length} trials expiring soon`);

  for (const client of expiringClients) {
    const daysLeft = Math.ceil((new Date(client.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24));

    console.log(`⏰ Sending reminder to ${client.email} - ${daysLeft} days left`);

    await sendEmail(
      client.email,
      `⏰ Your CallBird Trial Ends in ${daysLeft} Day${daysLeft > 1 ? 's' : ''}`,
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #111D96;">Your trial is ending soon!</h2>
          <p>Hi ${client.contact_name},</p>
          <p>Your 7-day CallBird trial ends in <strong>${daysLeft} day${daysLeft > 1 ? 's' : ''}</strong>.</p>
          
          <div style="background: #F8F9FA; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0;"><strong>Your AI Receptionist Stats:</strong></p>
            <p style="margin: 5px 0;">📞 Calls handled: ${client.calls_this_month || 0}</p>
            <p style="margin: 5px 0;">📱 Phone number: ${client.vapi_phone_number}</p>
          </div>

          <p><strong>Keep your AI receptionist active!</strong></p>
          <p>After your trial ends, you'll automatically be subscribed to the Starter plan at $29/month. No action needed.</p>
          
          <p>Want to upgrade to handle more calls?</p>
          <ul>
            <li><strong>Growth:</strong> $79/month - 500 calls</li>
            <li><strong>Pro:</strong> $199/month - 2000 calls</li>
          </ul>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://callbird-dashboard.vercel.app/billing" 
               style="background: #111D96; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Manage Subscription
            </a>
          </div>

          <p style="color: #666; font-size: 14px;">Don't want to continue? You can cancel anytime from your dashboard.</p>
        </div>
      `
    );

    // Log the event
    await supabase.from('subscription_events').insert({
      client_id: client.id,
      event_type: 'trial_reminder_sent',
      metadata: { days_left: daysLeft }
    });
  }

  console.log('✅ Trial reminders sent');
}

// Check for expired trials
async function checkExpiredTrials() {
  console.log('🔍 Checking for expired trials...');

  const { data: expiredClients, error } = await supabase
    .from('clients')
    .select('*')
    .eq('subscription_status', 'trial')
    .lt('trial_ends_at', new Date().toISOString());

  if (error) {
    console.error('❌ Error fetching expired trials:', error);
    return;
  }

  console.log(`📊 Found ${expiredClients.length} expired trials`);

  for (const client of expiredClients) {
    // Check if they have a Stripe subscription (they should if trial converted)
    if (client.stripe_subscription_id) {
      console.log(`✅ Client ${client.email} has active subscription`);
      continue;
    }

    console.log(`❌ Suspending expired trial for: ${client.email}`);

    // Suspend the account
    const { error: updateError } = await supabase
      .from('clients')
      .update({
        subscription_status: 'trial_expired',
        status: 'suspended'
      })
      .eq('id', client.id);

    if (updateError) {
      console.error('❌ Error suspending client:', updateError);
      continue;
    }

    // Log the event
    await supabase.from('subscription_events').insert({
      client_id: client.id,
      event_type: 'trial_expired',
      metadata: { expired_at: new Date() }
    });

    // Send suspension email
    await sendEmail(
      client.email,
      '⚠️ Your CallBird Trial Has Ended',
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Your trial has ended</h2>
          <p>Hi ${client.contact_name},</p>
          <p>Your 7-day CallBird trial has ended and your AI receptionist has been temporarily suspended.</p>
          
          <div style="background: #FEF2F2; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; color: #991b1b;"><strong>⚠️ Your phone number is no longer answering calls</strong></p>
          </div>

          <p><strong>Reactivate your AI receptionist now:</strong></p>
          <ol>
            <li>Choose a plan (starting at $29/month)</li>
            <li>Your phone number will be active again immediately</li>
            <li>Never miss a customer call</li>
          </ol>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://callbird-dashboard.vercel.app/billing" 
               style="background: #111D96; color: white; padding: 14px 36px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
              Reactivate Now - Starting at $29/month
            </a>
          </div>

          <p style="color: #666; font-size: 14px;">Questions? Reply to this email - we're here to help!</p>
        </div>
      `
    );

    console.log(`✅ Suspension email sent to: ${client.email}`);
  }

  console.log('✅ Expired trial processing complete');
}

// Main cron job runner
async function runTrialManager() {
  console.log('🚀 Starting Trial Manager Cron Job');
  console.log(`📅 Current time: ${new Date().toISOString()}`);

  try {
    await checkExpiringTrials();
    await checkExpiredTrials();
    console.log('✅ Trial Manager completed successfully');
  } catch (error) {
    console.error('❌ Trial Manager error:', error);
  }
}

// Export for manual testing
module.exports = { runTrialManager, checkExpiringTrials, checkExpiredTrials };

// If run directly (for testing)
if (require.main === module) {
  runTrialManager().then(() => {
    console.log('Done');
    process.exit(0);
  });
}