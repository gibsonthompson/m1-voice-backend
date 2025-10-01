const axios = require('axios');

async function sendSMS(to, message) {
  try {
    const response = await axios.post(
      'https://api.telnyx.com/v2/messages',
      {
        from: process.env.NOTIFICATION_PHONE || '+15054317109',
        to: to,
        text: message
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.TELNYX_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ SMS sent successfully:', response.data.data.id);
    return response.data;
  } catch (error) {
    console.error('❌ SMS error:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = { sendSMS };
