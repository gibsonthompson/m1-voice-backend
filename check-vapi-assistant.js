const axios = require('axios');

const VAPI_API_KEY = 'b8900800-802f-4fd8-9307-bda05baf08a8';
const ASSISTANT_ID = '460f4a28-0e6b-4971-b3b9-3bd8ac92d7be';

async function checkAssistant() {
  try {
    const response = await axios.get(
      `https://api.vapi.ai/assistant/${ASSISTANT_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${VAPI_API_KEY}`
        }
      }
    );

    console.log('📋 Current Assistant Configuration:');
    console.log('');
    console.log('Analysis Plan:', JSON.stringify(response.data.analysisPlan, null, 2));
    console.log('');
    console.log('System Prompt (first 500 chars):', response.data.model?.messages?.[0]?.content?.substring(0, 500));
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

checkAssistant();