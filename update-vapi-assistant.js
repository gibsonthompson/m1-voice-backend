const axios = require('axios');

const VAPI_API_KEY = 'b8900800-802f-4fd8-9307-bda05baf08a8';
const ASSISTANT_ID = '460f4a28-0e6b-4971-b3b9-3bd8ac92d7be';

async function updateAssistant() {
  try {
    console.log('🔄 Updating VAPI assistant...');
    
    const response = await axios.patch(
      `https://api.vapi.ai/assistant/${ASSISTANT_ID}`,
      {
        endCallMessage: "Thank you for calling Quick Fix Plumbing. Have a great day!",
        analysisPlan: {
          summaryPrompt: `Create a professional 2-3 sentence summary of this call including:
- What the customer needed or inquired about  
- Key details discussed (service type, urgency, timing preference)
- Next steps or outcome

Be specific and actionable. DO NOT write generic summaries like "thanks for calling" - provide actual detail about the conversation.`,
          
          structuredDataPrompt: `Extract the following information from the call transcript:
- Customer's full name (look for "my name is", "this is", "I'm" followed by their name)
- Customer's phone number if they provided it (in any format)
- Type of service they need (be specific: "drain cleaning", "water heater repair", etc.)
- Urgency level (emergency, urgent, routine, or inquiry)
- Whether they requested an appointment

Only extract information that was clearly stated. If not mentioned, leave blank.`,
          
          structuredDataSchema: {
            type: "object",
            properties: {
              customerName: {
                type: "string",
                description: "The full name as the customer stated it"
              },
              customerPhone: {
                type: "string",
                description: "Phone number in any format the customer provided"
              },
              serviceType: {
                type: "string",
                description: "Specific plumbing service needed"
              },
              urgency: {
                type: "string",
                enum: ["emergency", "urgent", "routine", "inquiry"],
                description: "Urgency level of the request"
              },
              appointmentRequested: {
                type: "boolean",
                description: "Whether they want to schedule service"
              }
            },
            required: ["customerName"]
          }
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${VAPI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Assistant updated successfully!');
    console.log('📋 Next: Update system prompt in VAPI dashboard');
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

updateAssistant();