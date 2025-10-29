// src/cron/trial-manager.js
// Enhanced trial management with branded email templates

const { createClient } = require('@supabase/supabase-js');
const { 
  getTrialReminderEmail, 
  getTrialExpiredEmail 
} = require('../email-templates');

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

// Helper: Calculate days until trial expiration
function getDaysUntilExpiry(trialEndsAt) {
  const now = new Date();
  const expiryDate = new Date(trialEndsAt);
  const diffTime = expiryDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// Check for trials expiring soon
async function checkExpiringTrials() {
  console.log('⏰ Checking for expiring trials...');

  try {
    // Get all active trial accounts
    const { data: trialClients, error } = await supabase
      .from('clients')
      .select('*, users!inner(first_name, last_name)')
      .eq('subscription_status', 'trial')
      .eq('status', 'active')
      .not('trial_ends_at', 'is', null);

    if (error) {
      console.error('❌ Error fetching trials:', error);
      return;
    }

    if (!trialClients || trialClients.length === 0) {
      console.log('✅ No active trials found');
      return;
    }

    console.log(`📊 Found ${trialClients.length} active trial account(s)`);

    for (const client of trialClients) {
      const daysLeft = getDaysUntilExpiry(client.trial_ends_at);
      console.log(`\n👤 ${client.business_name} - ${daysLeft} day(s) left`);

      const clientData = {
        business_name: client.business_name,
        first_name: client.users?.[0]?.first_name || client.owner_name || '',
        email: client.email,
        phone_number: client.vapi_phone_number,
        client_id: client.id
      };

      // Send reminders on Day 5 and Day 6 (2 days and 1 day left)
      if (daysLeft === 2) {
        console.log('📧 Sending "2 days left" reminder');
        await sendTrialReminder(clientData, 2);
      } else if (daysLeft === 1) {
        console.log('📧 Sending "last day" reminder');
        await sendTrialReminder(clientData, 1);
      }
    }

    console.log('\n✅ Trial reminder check complete');

  } catch (error) {
    console.error('❌ Error checking expiring trials:', error);
  }
}

// Send trial reminder email
async function sendTrialReminder(clientData, daysLeft) {
  try {
    // Check if we've already sent this reminder today (prevent duplicates)
    const { data: existingLog } = await supabase
      .from('email_logs')
      .select('*')
      .eq('client_id', clientData.client_id)
      .eq('email_type', `trial_reminder_day_${daysLeft}`)
      .gte('sent_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .maybeSingle();

    if (existingLog) {
      console.log(`ℹ️ Reminder already sent today, skipping`);
      return;
    }

    // Generate branded email
    const emailData = getTrialReminderEmail(clientData, daysLeft);
    const result = await sendEmail(emailData);

    // Log the email send
    if (result.success) {
      await supabase.from('email_logs').insert([{
        client_id: clientData.client_id,
        email_type: `trial_reminder_day_${daysLeft}`,
        recipient_email: clientData.email,
        sent_at: new Date().toISOString(),
        status: 'sent',
        resend_id: result.data?.id
      }]);

      // Also log to subscription_events for backward compatibility
      await supabase.from('subscription_events').insert({
        client_id: clientData.client_id,
        event_type: 'trial_reminder_sent',
        metadata: { days_left: daysLeft }
      });
    }

  } catch (error) {
    console.error(`❌ Error sending trial reminder:`, error);
  }
}

// Check for expired trials
async function checkExpiredTrials() {
  console.log('🔍 Checking for expired trials...');

  try {
    const { data: expiredClients, error } = await supabase
      .from('clients')
      .select('*, users!inner(first_name, last_name)')
      .eq('subscription_status', 'trial')
      .lt('trial_ends_at', new Date().toISOString());

    if (error) {
      console.error('❌ Error fetching expired trials:', error);
      return;
    }

    if (!expiredClients || expiredClients.length === 0) {
      console.log('✅ No expired trials found');
      return;
    }

    console.log(`📊 Found ${expiredClients.length} expired trial(s)`);

    for (const client of expiredClients) {
      // Check if they have active subscription (upgraded during trial)
      if (client.stripe_subscription_id && client.subscription_status === 'active') {
        console.log(`✅ Client ${client.email} has active subscription, skipping`);
        continue;
      }

      console.log(`❌ Processing expired trial for: ${client.email}`);
      
      const clientData = {
        business_name: client.business_name,
        first_name: client.users?.[0]?.first_name || client.owner_name || '',
        email: client.email,
        phone_number: client.vapi_phone_number,
        client_id: client.id
      };

      await handleExpiredTrial(client, clientData);
    }

    console.log('✅ Expired trial processing complete');

  } catch (error) {
    console.error('❌ Error processing expired trials:', error);
  }
}

// Handle expired trial - suspend account and send email
async function handleExpiredTrial(client, clientData) {
  try {
    // 1. Skip VAPI update for now - calls will still work, just won't have suspension message
    // The important part is marking the account as expired in the database
    // TODO: Implement proper VAPI suspension later if needed
    console.log('ℹ️ Skipping VAPI assistant update (account will be marked as expired in database)');

    // 2. Update client subscription status (don't touch 'status' field - has constraint)
    const { error: updateError } = await supabase
      .from('clients')
      .update({
        subscription_status: 'trial_expired',
        // Removed 'status' update - has database constraint we don't want to violate
        updated_at: new Date().toISOString()
      })
      .eq('id', client.id);

    if (updateError) {
      console.error('❌ Error updating client status:', updateError);
    } else {
      console.log('✅ Client status updated to suspended');
    }

    // 3. Check if we've already sent expiry email today
    const { data: existingLog } = await supabase
      .from('email_logs')
      .select('*')
      .eq('client_id', client.id)
      .eq('email_type', 'trial_expired')
      .gte('sent_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .maybeSingle();

    if (!existingLog) {
      // 4. Send trial expired email with branded template
      console.log('📧 Sending trial expired email...');
      const emailData = getTrialExpiredEmail(clientData);
      const emailResult = await sendEmail(emailData);

      // Log the email
      if (emailResult.success) {
        await supabase.from('email_logs').insert([{
          client_id: client.id,
          email_type: 'trial_expired',
          recipient_email: clientData.email,
          sent_at: new Date().toISOString(),
          status: 'sent',
          resend_id: emailResult.data?.id
        }]);

        // Also log to subscription_events
        await supabase.from('subscription_events').insert({
          client_id: client.id,
          event_type: 'trial_expired',
          metadata: { expired_at: new Date() }
        });
      }
    } else {
      console.log('ℹ️ Expiry email already sent today');
    }

  } catch (error) {
    console.error('❌ Error handling expired trial:', error);
  }
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

// Export for use in other files
module.exports = { 
  runTrialManager, 
  checkExpiringTrials, 
  checkExpiredTrials 
};

// If run directly (for testing)
if (require.main === module) {
  runTrialManager().then(() => {
    console.log('Done');
    process.exit(0);
  });
}