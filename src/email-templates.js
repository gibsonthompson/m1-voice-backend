// email-templates.js
// HTML email templates for trial management

function getTrialReminderEmail(clientData, daysLeft) {
  const { business_name, first_name, email, phone_number } = clientData;
  const upgradeUrl = 'https://start.callbirdai.com/thank-you';
  
  let subject, headline, message;
  
  if (daysLeft === 2) {
    subject = `${business_name} - Your trial ends in 2 days`;
    headline = '⏰ Only 2 Days Left in Your Trial';
    message = `Hi ${first_name || 'there'},<br><br>Your CallBird AI receptionist has been answering calls for 5 days now! You only have <strong>2 days remaining</strong> in your free trial.<br><br>Don't let those calls go unanswered after your trial ends.`;
  } else if (daysLeft === 1) {
    subject = `${business_name} - Last day of your trial!`;
    headline = '🚨 Final Day of Your Trial';
    message = `Hi ${first_name || 'there'},<br><br>This is your last day with CallBird! Your trial ends <strong>tomorrow</strong>.<br><br>Your AI receptionist has been working hard to capture every call. Don't lose this coverage.`;
  } else {
    subject = `${business_name} - Trial ending soon`;
    headline = '⏰ Your Trial is Ending Soon';
    message = `Hi ${first_name || 'there'},<br><br>Your CallBird trial has only <strong>${daysLeft} days left</strong>.<br><br>Upgrade now to keep your AI receptionist answering calls 24/7.`;
  }

  return {
    to: email,
    subject: subject,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px 20px;
      text-align: center;
      color: white;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 600;
    }
    .content {
      padding: 40px 30px;
    }
    .countdown {
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 20px;
      margin: 25px 0;
      border-radius: 6px;
    }
    .countdown-number {
      font-size: 48px;
      font-weight: bold;
      color: #ff6b6b;
      margin: 0;
    }
    .countdown-text {
      font-size: 18px;
      color: #666;
      margin: 5px 0 0 0;
    }
    .benefits {
      background: #f8f9fa;
      padding: 25px;
      border-radius: 8px;
      margin: 25px 0;
    }
    .benefits h3 {
      margin-top: 0;
      color: #667eea;
    }
    .benefits ul {
      margin: 15px 0;
      padding-left: 20px;
    }
    .benefits li {
      margin: 10px 0;
      color: #555;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px 40px;
      text-decoration: none;
      border-radius: 8px;
      font-size: 18px;
      font-weight: 600;
      margin: 25px 0;
      text-align: center;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    }
    .cta-button:hover {
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
    }
    .phone-info {
      background: #e7f3ff;
      border-left: 4px solid #2196F3;
      padding: 15px;
      margin: 20px 0;
      border-radius: 6px;
    }
    .phone-info strong {
      color: #1976D2;
    }
    .footer {
      background: #f8f9fa;
      padding: 30px;
      text-align: center;
      color: #666;
      font-size: 14px;
      border-top: 1px solid #e9ecef;
    }
    .footer a {
      color: #667eea;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📞 CallBird AI</h1>
    </div>
    
    <div class="content">
      <h2 style="color: #333; margin-top: 0;">${headline}</h2>
      
      <p style="font-size: 16px; color: #555;">
        ${message}
      </p>

      <div class="countdown">
        <p class="countdown-number">${daysLeft}</p>
        <p class="countdown-text">Day${daysLeft === 1 ? '' : 's'} Remaining</p>
      </div>

      <div class="phone-info">
        <strong>Your CallBird Number:</strong> ${phone_number || 'Not available'}
      </div>

      <div class="benefits">
        <h3>What You Keep With CallBird:</h3>
        <ul>
          <li>✅ Never miss another customer call</li>
          <li>✅ AI answers with your business information 24/7</li>
          <li>✅ Instant SMS notifications for every call</li>
          <li>✅ Full call transcripts & recordings</li>
          <li>✅ Starting at just $49/month</li>
        </ul>
      </div>

      <div style="text-align: center;">
        <a href="${upgradeUrl}" class="cta-button">
          🚀 Upgrade Now - Keep Your AI Receptionist
        </a>
      </div>

      <p style="font-size: 14px; color: #666; margin-top: 30px;">
        Questions? Text us at <strong><a href="sms:+15055573160" style="color: #667eea; text-decoration: none;">(505) 557-3160</a></strong> or visit <a href="https://callbirdai.com" style="color: #667eea;">callbirdai.com</a>
      </p>
    </div>

    <div class="footer">
      <p>CallBird AI - Your 24/7 Phone Receptionist</p>
      <p>
        <a href="https://callbirdai.com">Website</a> • 
        <a href="https://app.callbirdai.com">Dashboard</a>
      </p>
    </div>
  </div>
</body>
</html>
    `
  };
}

function getTrialExpiredEmail(clientData) {
  const { business_name, first_name, email, phone_number } = clientData;
  const upgradeUrl = 'https://start.callbirdai.com/thank-you';

  return {
    to: email,
    subject: `${business_name} - Your trial has ended`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 600;
    }
    .content {
      padding: 40px 30px;
    }
    .alert-box {
      background: #fff3cd;
      border: 2px solid #ffc107;
      border-radius: 8px;
      padding: 20px;
      margin: 30px 0;
      text-align: center;
    }
    .alert-box h3 {
      color: #856404;
      margin: 0 0 10px 0;
      font-size: 20px;
    }
    .alert-box p {
      color: #856404;
      margin: 0;
      font-size: 16px;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      padding: 16px 40px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 18px;
      margin: 30px 0;
      transition: transform 0.2s;
    }
    .cta-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 12px rgba(102, 126, 234, 0.4);
    }
    .phone-number {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 8px;
      font-family: 'Courier New', monospace;
      font-size: 18px;
      font-weight: bold;
      color: #667eea;
      margin: 20px 0;
      text-align: center;
    }
    .pricing-info {
      background: #f8f9fa;
      padding: 25px;
      border-radius: 8px;
      margin: 30px 0;
    }
    .pricing-info h3 {
      margin-top: 0;
      color: #333;
      text-align: center;
    }
    .pricing-info p {
      color: #555;
      font-size: 16px;
      margin: 10px 0;
      text-align: center;
    }
    .footer {
      background: #f8f9fa;
      padding: 30px;
      text-align: center;
      color: #666;
      font-size: 14px;
      border-top: 1px solid #e9ecef;
    }
    .footer a {
      color: #667eea;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⏰ Your 7-Day Trial is Complete</h1>
    </div>
    
    <div class="content">
      <p style="font-size: 18px; color: #555;">
        Hi ${first_name || 'there'},
      </p>

      <div class="alert-box">
        <h3>Your AI Receptionist is Currently Paused</h3>
        <p>
          Incoming calls will not be answered until you upgrade.
        </p>
      </div>

      <p style="font-size: 16px; color: #555; margin: 25px 0;">
        Your CallBird phone number is reserved for you, but it's not currently active:
      </p>

      <div class="phone-number">
        ${phone_number || ''}
      </div>

      <p style="font-size: 18px; color: #333; font-weight: 600; margin: 30px 0 20px 0;">
        Upgrade now to reactivate your AI receptionist and never miss another call!
      </p>

      <div class="pricing-info">
        <h3>Plans Starting at $49/month</h3>
        <p><strong>Starter:</strong> $49/mo (100 calls) • <strong>Professional:</strong> $99/mo (250 calls) • <strong>Enterprise:</strong> $199/mo (500 calls)</p>
      </div>

      <div style="text-align: center;">
        <a href="${upgradeUrl}" class="cta-button">
          🚀 Reactivate Your AI Receptionist
        </a>
      </div>

      <p style="font-size: 14px; color: #666; margin-top: 40px; text-align: center; border-top: 1px solid #e9ecef; padding-top: 20px;">
        Need help deciding? Text us: <strong><a href="sms:+15055573160" style="color: #667eea; text-decoration: none;">(505) 557-3160</a></strong>
      </p>
    </div>

    <div class="footer">
      <p style="margin: 0 0 10px 0;"><strong>CallBird AI</strong> - Never Miss Another Call</p>
      <p style="margin: 0;"><a href="https://callbirdai.com">callbirdai.com</a></p>
    </div>
  </div>
</body>
</html>
    `
  };
}

function getPaymentConfirmationEmail(clientData) {
  const { business_name, first_name, email, phone_number, plan_type } = clientData;
  const dashboardUrl = 'https://app.callbirdai.com/dashboard';

  // Map plan types to readable names
  const planNames = {
    'starter': 'Starter ($49/month)',
    'professional': 'Professional ($99/month)',
    'enterprise': 'Enterprise ($199/month)'
  };

  return {
    to: email,
    subject: `Welcome to CallBird! Your ${plan_type || 'subscription'} is active`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to CallBird</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      padding: 40px 20px;
      text-align: center;
      color: white;
    }
    .header h1 {
      margin: 0;
      font-size: 32px;
      font-weight: 600;
    }
    .checkmark {
      font-size: 64px;
      margin: 10px 0;
    }
    .content {
      padding: 40px 30px;
    }
    .success-box {
      background: #d1fae5;
      border-left: 4px solid #10b981;
      padding: 20px;
      margin: 25px 0;
      border-radius: 6px;
    }
    .info-box {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      margin: 25px 0;
    }
    .info-box h4 {
      margin-top: 0;
      color: #667eea;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #e9ecef;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .info-label {
      color: #666;
      font-weight: 500;
    }
    .info-value {
      color: #333;
      font-weight: 600;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px 40px;
      text-decoration: none;
      border-radius: 8px;
      font-size: 18px;
      font-weight: 600;
      margin: 25px 0;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    }
    .next-steps {
      background: #fff3cd;
      padding: 25px;
      border-radius: 8px;
      margin: 25px 0;
    }
    .next-steps h3 {
      margin-top: 0;
      color: #856404;
    }
    .next-steps ol {
      margin: 0;
      padding-left: 20px;
    }
    .next-steps li {
      margin: 12px 0;
      color: #555;
    }
    .footer {
      background: #f8f9fa;
      padding: 30px;
      text-align: center;
      color: #666;
      font-size: 14px;
      border-top: 1px solid #e9ecef;
    }
    .footer a {
      color: #667eea;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="checkmark">✅</div>
      <h1>You're All Set!</h1>
    </div>
    
    <div class="content">
      <p style="font-size: 18px; color: #555;">
        Hi ${first_name || 'there'},
      </p>

      <div class="success-box">
        <p style="margin: 0; font-size: 16px;">
          <strong>Payment confirmed!</strong> Your CallBird AI receptionist is now active and ready to answer calls 24/7.
        </p>
      </div>

      <div class="info-box">
        <h4>Your Account Details:</h4>
        <div class="info-row">
          <span class="info-label">Business:</span>
          <span class="info-value">${business_name}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Phone Number:</span>
          <span class="info-value">${phone_number || 'Check your dashboard'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Plan:</span>
          <span class="info-value">${planNames[plan_type] || 'Active'}</span>
        </div>
      </div>

      <div style="text-align: center;">
        <a href="${dashboardUrl}" class="cta-button">
          📊 Go to Your Dashboard
        </a>
      </div>

      <div class="next-steps">
        <h3>📋 Next Steps:</h3>
        <ol>
          <li><strong>Test your AI:</strong> Call your CallBird number to hear your AI receptionist in action</li>
          <li><strong>Review your knowledge base:</strong> Update business hours, services, and FAQs in Settings</li>
          <li><strong>Monitor calls:</strong> Check your dashboard for call transcripts and recordings</li>
          <li><strong>Get notified:</strong> You'll receive SMS alerts for every incoming call</li>
        </ol>
      </div>

      <p style="font-size: 16px; color: #555; margin-top: 30px;">
        Your AI is trained on your website and ready to handle customer inquiries. Every call is saved to your dashboard with full transcripts.
      </p>

      <p style="font-size: 14px; color: #666; margin-top: 30px;">
        Questions? We're here to help! Text us at <strong><a href="sms:+15055573160" style="color: #667eea; text-decoration: none;">(505) 557-3160</a></strong> or reply to this email.
      </p>
    </div>

    <div class="footer">
      <p><strong>CallBird AI</strong> - Your 24/7 Phone Receptionist</p>
      <p>
        <a href="https://app.callbirdai.com">Dashboard</a> • 
        <a href="https://callbirdai.com">Website</a>
      </p>
    </div>
  </div>
</body>
</html>
    `
  };
}

module.exports = {
  getTrialReminderEmail,
  getTrialExpiredEmail,
  getPaymentConfirmationEmail
};