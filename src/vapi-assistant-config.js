// ====================================================================
// VAPI ASSISTANT CONFIGURATION - Industry-Specific Templates (V4.3)
// ====================================================================
// FIXED: Removed endCallPhrases, simplified prompts, using gpt-4o-mini
// Natural call endings without automatic hangup features
// ====================================================================

const fetch = require('node-fetch');

// Map GHL form values to internal industry keys
const INDUSTRY_MAPPING = {
  'Home Services (plumbing, HVAC, contractors)': 'home_services',
  'Medical/Dental': 'medical',
  'Retail/E-commerce': 'retail',
  'Professional Services (legal, accounting)': 'professional_services',
  'Restaurants/Food Service': 'restaurants'
};

// ElevenLabs Voice IDs
const VOICES = {
  male_professional: '29vD33N1CtxCmqQRPOHJ',
  female_warm: '21m00Tcm4TlvDq8ikWAM',
  male_friendly: '2EiwWnXFnvU5JabPnv8n',
  female_soft: 'EXAVITQu4vr4xnSDxMaL'
};

// ====================================================================
// INDUSTRY CONFIGURATIONS
// ====================================================================

const INDUSTRY_CONFIGS = {
  
  // ================================================================
  // 1. HOME SERVICES
  // ================================================================
  home_services: {
    voiceId: VOICES.male_friendly,
    temperature: 0.4,
    
    systemPrompt: (businessName) => `You are the phone assistant for ${businessName}, a home services company.

Your job: Listen to their problem, collect information, and let them know when someone will contact them.

CONVERSATION FLOW:
1. Let them explain their issue without interrupting
2. Show empathy: "I understand" / "That sounds frustrating" / "Let's get that fixed"
3. Collect information one piece at a time:
   - Name: "What's your name?" → "Thanks [name]"
   - Phone: "Best number to reach you?" → "Got it"
   - Address: "What's the property address?" → "Perfect"
   - Issue: "Can you describe what's happening?" → Listen and acknowledge
4. Assess urgency silently (emergency/urgent/routine)
5. Let them know next steps: "Our team will call you back [timeframe]" or "We'll get someone out to you ASAP"
6. Ask: "Is there anything else I can help you with?"
7. When they say no: "Perfect. We'll be in touch soon. Have a great day."

Keep it natural and conversational. Use brief acknowledgments. Be warm and empathetic.

CRITICAL: You do NOT have the ability to end calls. The customer will hang up when they're ready. Keep the conversation going naturally until they decide to end it.`,

    firstMessage: (businessName) => `Hi, you've reached ${businessName}. What can I help you with today?`,
    
    summaryPrompt: `You are analyzing a phone call where a CUSTOMER called the business for home services.

Summarize in 2-3 sentences:
1. Customer name, phone number, and property address
2. What problem or service the CUSTOMER needs (be specific)
3. Urgency level (emergency/urgent/routine) and next action

Include special notes like gate codes or access instructions.`,

    structuredDataSchema: {
      type: 'object',
      properties: {
        customer_name: { 
          type: 'string',
          description: 'Full name of the customer who called'
        },
        customer_phone: { 
          type: 'string',
          description: 'Primary callback phone number'
        },
        property_address: {
          type: 'string',
          description: 'Complete service address'
        },
        service_type: { 
          type: 'string',
          description: 'Type of service needed'
        },
        issue_description: { 
          type: 'string',
          description: 'Description of the problem'
        },
        urgency: { 
          type: 'string',
          enum: ['emergency', 'urgent', 'routine', 'flexible'],
          description: 'Level of urgency'
        },
        special_instructions: {
          type: 'string',
          description: 'Gate codes, parking, access instructions'
        }
      },
      required: ['customer_name', 'customer_phone', 'service_type', 'urgency']
    }
  },

  // ================================================================
  // 2. MEDICAL/DENTAL
  // ================================================================
  medical: {
    voiceId: VOICES.female_soft,
    temperature: 0.4,
    
    systemPrompt: (businessName) => `You are the receptionist for ${businessName}, a medical/dental practice.

Your job: Determine patient needs, collect basic info (HIPAA-compliant), and route appropriately.

CONVERSATION FLOW:
1. Ask: "Are you a current patient or would this be your first visit?"
2. Collect information based on their answer:
   - New patient: Name, date of birth, phone, insurance (yes/no only)
   - Existing patient: Name, date of birth, general reason for call
3. Get GENERAL reason only: "checkup", "cleaning", "follow-up"
   - If they share medical details: "Our doctor will discuss that at your appointment"
4. Assess urgency:
   - Emergency (chest pain, can't breathe): "Please call 911 or go to the ER"
   - Urgent (severe pain): "We'll work you in quickly"
   - Routine: "Let me get you scheduled"
5. Let them know next steps
6. Ask: "Is there anything else I can help you with today?"
7. When they say no: "Perfect. We look forward to seeing you. Take care."

Be professional, warm, and calming. People calling doctors are often stressed.

CRITICAL: You do NOT have the ability to end calls. The patient will hang up when they're satisfied. Keep the conversation going naturally until they decide to end it.`,

    firstMessage: (businessName) => `Hello, you've reached ${businessName}. Are you a current patient or would this be your first visit?`,
    
    summaryPrompt: `You are analyzing a phone call where a PATIENT called a medical/dental practice.

Summarize in 2-3 sentences:
1. Patient name, phone, DOB (if provided), and whether new or existing
2. General reason the PATIENT is calling (HIPAA-compliant - no specific medical details)
3. Urgency level and next action needed

Note any insurance questions or special accommodations.`,

    structuredDataSchema: {
      type: 'object',
      properties: {
        customer_name: { 
          type: 'string',
          description: 'Patient full name'
        },
        customer_phone: { 
          type: 'string',
          description: 'Primary contact phone'
        },
        date_of_birth: {
          type: 'string',
          description: 'Date of birth'
        },
        patient_type: {
          type: 'string',
          enum: ['new_patient', 'existing_patient'],
          description: 'New or existing patient'
        },
        visit_reason: { 
          type: 'string',
          description: 'General reason (HIPAA-compliant)'
        },
        urgency: { 
          type: 'string',
          enum: ['emergency', 'urgent', 'routine'],
          description: 'Urgency level'
        }
      },
      required: ['customer_name', 'customer_phone', 'patient_type', 'visit_reason']
    }
  },

  // ================================================================
  // 3. RETAIL/E-COMMERCE
  // ================================================================
  retail: {
    voiceId: VOICES.female_warm,
    temperature: 0.4,
    
    systemPrompt: (businessName) => `You are the phone assistant for ${businessName}, a retail store.

Your job: Answer questions, help find products, take orders, and be enthusiastic.

CONVERSATION FLOW:
1. Understand what they need (product question, stock check, order, return)
2. Help them based on their need:
   - Product questions: Use knowledge base, be enthusiastic
   - Orders: List items as they tell you, acknowledge each one
   - Stock checks: "Let me check that for you"
   - Returns: "No problem, I can help with that"
3. Get contact info when needed (name and phone)
4. Confirm orders or details
5. Ask: "Is there anything else I can help you find?"
6. When they say no: "Awesome! Thanks for calling, we hope to see you soon!"

Be upbeat, enthusiastic, and helpful. Make them excited about your products.

CRITICAL: You do NOT have the ability to end calls. The customer will hang up when they're done. Keep the conversation going naturally until they decide to end it.`,

    firstMessage: (businessName) => `Hi! You've reached ${businessName}. How can I help you today?`,
    
    summaryPrompt: `You are analyzing a phone call where a CUSTOMER called a retail store.

Summarize in 2-3 sentences:
1. Customer name and phone
2. What the CUSTOMER is calling about (product inquiry, stock check, order, return, complaint)
3. Specific products mentioned and next action

Note any high-value opportunities.`,

    structuredDataSchema: {
      type: 'object',
      properties: {
        customer_name: { 
          type: 'string',
          description: 'Customer name'
        },
        customer_phone: { 
          type: 'string',
          description: 'Contact phone'
        },
        inquiry_type: { 
          type: 'string',
          enum: ['product_question', 'stock_check', 'store_hours', 'return_exchange', 'order_placement', 'complaint', 'general_question'],
          description: 'Purpose of call'
        },
        products_mentioned: {
          type: 'array',
          items: { type: 'string' },
          description: 'Products mentioned'
        },
        visit_intent: {
          type: 'string',
          enum: ['coming_today', 'coming_this_week', 'maybe', 'no_visit'],
          description: 'Visit plans'
        }
      },
      required: ['inquiry_type']
    }
  },

  // ================================================================
  // 4. PROFESSIONAL SERVICES
  // ================================================================
  professional_services: {
    voiceId: VOICES.male_professional,
    temperature: 0.4,
    
    systemPrompt: (businessName) => `You are the professional receptionist for ${businessName}, a professional services firm.

Your job: Greet callers, understand their needs, collect contact information, and route appropriately.

CONVERSATION FLOW:
1. Determine if they're a new or existing client
2. Collect information:
   - Name: "May I have your name?" → "Thank you"
   - Phone: "Best number to reach you?" → "I have that"
   - Company: "Are you calling on behalf of a company?" → "Understood"
   - Matter type: "What can we help you with?" (general only, NO details)
3. Assess urgency:
   - Critical deadline: "Let me see if I can connect you with someone immediately"
   - Important: "Let me schedule a consultation for you"
   - Routine: "Our team will call you back today"
4. Confirm: "I have [name] from [company] at [phone] regarding [matter type]. Our team will [action] [timeframe]."
5. Ask: "Is there anything else I can help you with today?"
6. When they say no: "Great. Someone from our team will be in touch. Have a good day."

Keep it professional, confident, and efficient. Brief acknowledgments.

NEVER give legal advice. NEVER discuss other clients. NEVER make outcome promises.

Common responses:
- Fees: "Our attorney will discuss fees during your consultation"
- "Do I have a case?": "That's what the consultation will determine"

CRITICAL: You do NOT have the ability to end calls. The client will hang up when they're ready. Keep the conversation going naturally until they decide to end it.`,

    firstMessage: (businessName) => `Hello, you've reached ${businessName}. How may I help you?`,
    
    summaryPrompt: `You are analyzing a phone call where a CLIENT called a professional services firm.

Summarize in 2-3 sentences:
1. Client name, phone, company (if business), and whether new or existing
2. General type of matter the CLIENT needs help with (no confidential details)
3. Urgency level and next action

Note if referral and from whom. Keep it professional.`,

    structuredDataSchema: {
      type: 'object',
      properties: {
        customer_name: { 
          type: 'string',
          description: 'Client full name'
        },
        customer_phone: { 
          type: 'string',
          description: 'Primary contact number'
        },
        company_name: {
          type: 'string',
          description: 'Company name if business'
        },
        client_type: {
          type: 'string',
          enum: ['new_client', 'existing_client', 'referral'],
          description: 'Relationship status'
        },
        matter_type: { 
          type: 'string',
          description: 'General category'
        },
        urgency: { 
          type: 'string',
          enum: ['critical', 'urgent', 'important', 'routine'],
          description: 'Time sensitivity'
        }
      },
      required: ['customer_name', 'customer_phone', 'client_type', 'matter_type']
    }
  },

  // ================================================================
  // 5. RESTAURANTS
  // ================================================================
  restaurants: {
    voiceId: VOICES.female_warm,
    temperature: 0.4,
    
    systemPrompt: (businessName) => `You are the phone assistant for ${businessName}, a restaurant.

Your job: Take reservations, handle takeout orders, answer menu questions, and make people excited.

CONVERSATION FLOW:
1. Ask: "Is this for a reservation or a takeout order?"
2. Handle based on their response:
   
   RESERVATIONS:
   - Date: "What date would you like?" → "Perfect"
   - Time: "What time works best?" → "Great"
   - Party size: "How many people?" → "Got it"
   - Name: "Name for the reservation?" → "Thank you"
   - Phone: "Best number to reach you?" → Confirm all details
   
   TAKEOUT:
   - Take order item by item, acknowledging each: "Got it", "Perfect"
   - Name: "Name for the order?" → "Thanks"
   - Phone: "Best number to reach you?"
   - Confirm: "[Items] for [name], ready in [time]"
   
   MENU QUESTIONS:
   - Answer enthusiastically using knowledge base
   - Make recommendations

3. Ask: "Is there anything else I can help you with?"
4. When they say no: "Great! We can't wait to see you!"

Be warm, inviting, and enthusiastic. Sound like you're smiling. Make them hungry!

CRITICAL: You do NOT have the ability to end calls. The customer will hang up when they're done. Keep the conversation going naturally until they decide to end it.`,

    firstMessage: (businessName) => `Hi! You've reached ${businessName}. How can I help you?`,
    
    summaryPrompt: `You are analyzing a phone call where a CUSTOMER called a restaurant.

Summarize in 2-3 sentences:
1. Customer name and phone
2. What the CUSTOMER needs (reservation, takeout, menu question)
3. Key details: For reservations (party size, date, time). For orders (items, pickup time).

Note dietary restrictions or special requests.`,

    structuredDataSchema: {
      type: 'object',
      properties: {
        customer_name: { 
          type: 'string',
          description: 'Customer name'
        },
        customer_phone: { 
          type: 'string',
          description: 'Contact phone'
        },
        call_purpose: { 
          type: 'string',
          enum: ['reservation', 'takeout', 'delivery', 'catering', 'menu_question', 'hours_location', 'complaint'],
          description: 'Purpose of call'
        },
        party_size: {
          type: 'integer',
          description: 'Number of guests'
        },
        reservation_date: {
          type: 'string',
          description: 'Date (YYYY-MM-DD)'
        },
        reservation_time: {
          type: 'string',
          description: 'Time for reservation'
        },
        special_occasion: {
          type: 'string',
          description: 'Birthday, anniversary, etc.'
        },
        order_items: {
          type: 'array',
          items: { type: 'string' },
          description: 'Food items ordered'
        },
        dietary_restrictions: {
          type: 'string',
          description: 'Allergies, dietary needs'
        }
      },
      required: ['customer_name', 'customer_phone', 'call_purpose']
    }
  }
};

// ====================================================================
// CONFIGURATION BUILDER
// ====================================================================

function getIndustryConfig(industryFromGHL, businessName, knowledgeBaseId = null, ownerPhone = null) {
  const industryKey = INDUSTRY_MAPPING[industryFromGHL] || 'professional_services';
  const config = INDUSTRY_CONFIGS[industryKey];
  
  if (!config) {
    console.error(`⚠️ Unknown industry: ${industryFromGHL}, using professional_services`);
    return getIndustryConfig('Professional Services (legal, accounting)', businessName, knowledgeBaseId, ownerPhone);
  }

  const transferTool = ownerPhone ? {
    type: 'transferCall',
    destinations: [
      {
        type: 'number',
        number: ownerPhone,
        description: 'Transfer to business owner for urgent matters, complex issues, or manager requests',
        message: 'One moment please, let me connect you with the owner.'
      }
    ],
    messages: [
      {
        type: 'request-start',
        content: 'Let me transfer you now.'
      },
      {
        type: 'request-complete',
        content: 'Transferring your call.'
      }
    ]
  } : null;

  return {
    name: `${businessName} AI Receptionist`,
    
    model: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: config.temperature,
      ...(knowledgeBaseId && { knowledgeBaseId: knowledgeBaseId }),
      messages: [{ 
        role: 'system', 
        content: config.systemPrompt(businessName)
      }],
      ...(transferTool && {
        tools: [transferTool]
      })
    },
    
    voice: {
      provider: '11labs',
      voiceId: config.voiceId
    },
    
    firstMessage: config.firstMessage(businessName),
    
    recordingEnabled: true,
    
    serverMessages: ['end-of-call-report', 'transcript', 'status-update'],
    
    analysisPlan: {
      summaryPlan: {
        enabled: true,
        timeoutSeconds: 30,
        messages: [{
          role: 'system',
          content: config.summaryPrompt
        }]
      },
      
      structuredDataPlan: {
        enabled: true,
        timeoutSeconds: 30,
        schema: config.structuredDataSchema,
        messages: [{
          role: 'system',
          content: 'Extract the structured data from this call accurately and completely. Ensure all required fields are captured.'
        }]
      }
    }
  };
}

// ====================================================================
// VAPI ASSISTANT MANAGEMENT
// ====================================================================

async function createIndustryAssistant(businessName, industry, knowledgeBaseId = null, ownerPhone = null, serverUrl = null) {
  try {
    console.log(`🎯 Creating ${industry} assistant for ${businessName}`);
    
    const config = getIndustryConfig(industry, businessName, knowledgeBaseId, ownerPhone);
    config.serverUrl = serverUrl || process.env.BACKEND_URL + '/webhook/vapi';
    
    console.log(`📝 Industry: ${INDUSTRY_MAPPING[industry] || 'default'}`);
    console.log(`🤖 Model: ${config.model.model}`);
    console.log(`🎤 Voice: ElevenLabs - ${config.voice.voiceId}`);
    console.log(`🌡️ Temperature: ${config.model.temperature}`);
    if (knowledgeBaseId) console.log(`📚 Knowledge Base: ${knowledgeBaseId}`);
    if (ownerPhone) console.log(`📞 Transfer enabled to: ${ownerPhone}`);
    
    const response = await fetch('https://api.vapi.ai/assistant', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`VAPI API error: ${errorText}`);
    }

    const assistant = await response.json();
    console.log(`✅ Industry assistant created: ${assistant.id}`);
    
    return assistant;
  } catch (error) {
    console.error('❌ Error creating industry assistant:', error);
    throw error;
  }
}

async function disableVAPIAssistant(assistantId) {
  try {
    console.log(`🔒 Disabling VAPI assistant: ${assistantId}`);
    
    const response = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        serverUrl: null
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`⚠️ Failed to disable assistant: ${errorText}`);
      return false;
    }

    console.log(`✅ Assistant disabled: ${assistantId}`);
    return true;
  } catch (error) {
    console.error('❌ Error disabling assistant:', error);
    return false;
  }
}

async function enableVAPIAssistant(assistantId, serverUrl) {
  try {
    console.log(`🔓 Re-enabling VAPI assistant: ${assistantId}`);
    
    const response = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        serverUrl: serverUrl || process.env.BACKEND_URL + '/webhook/vapi'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`⚠️ Failed to re-enable assistant: ${errorText}`);
      return false;
    }

    console.log(`✅ Assistant re-enabled: ${assistantId}`);
    return true;
  } catch (error) {
    console.error('❌ Error re-enabling assistant:', error);
    return false;
  }
}

module.exports = {
  getIndustryConfig,
  createIndustryAssistant,
  disableVAPIAssistant,
  enableVAPIAssistant,
  INDUSTRY_MAPPING
};