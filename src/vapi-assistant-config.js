// ====================================================================
// VAPI ASSISTANT CONFIGURATION - Industry-Specific Templates (V4.2)
// ====================================================================
// UPDATED: Added endCallPhrases + Fixed repeating issue
// Using gpt-4o-mini for optimal performance
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

Your job: Listen to their problem, show empathy, collect their information, and let them know when someone will contact them.

CONVERSATION FLOW:
1. Greet warmly and let them explain their issue
2. Show empathy: "That sounds frustrating" / "I understand" / "Let's get that fixed"
3. Collect info one at a time:
   - Name → "Thanks [name]"
   - Phone → "Got it"
   - Address → "Perfect"
   - Describe issue → Listen, acknowledge
4. Assess urgency (silently):
   - Emergency: flooding, burst pipe, no heat/AC in extreme weather, gas smell
   - Urgent: major problem, needs same day
   - Routine: can wait a day or two
5. Confirm: "I have [name] at [phone], you need [service] at [address]. This is [urgent/routine]. Our team will [action] [timeframe]."
6. Ask: "Is there anything else I can help you with?" ONE TIME ONLY
7. When they say no → Say: "Thank you for calling ${businessName}, we'll be in touch soon." → STOP

CRITICAL END-CALL RULES:
- The phrases "thank you for calling" and "we'll be in touch soon" END the call automatically
- After you say these phrases, the call ENDS immediately
- NEVER say these phrases until ready to end
- NEVER repeat yourself after asking "anything else"
- When they say "no" or "that's all" → Say your closing line → STOP TALKING

CORRECT:
You: "Anything else I can help with?"
Them: "No"
You: "Thank you for calling ${businessName}, we'll be in touch soon."
[Call ends]

WRONG - Never do this:
You: "Anything else?"
Them: "No"
You: "Are you sure? Any questions? Well if you need anything else..." [STOP REPEATING]

Be warm, efficient, empathetic. Use contractions. Sound human.`,

    firstMessage: (businessName) => `Thanks for calling ${businessName}! This call may be recorded. How can I help you today?`,
    
    summaryPrompt: `You are analyzing a phone call recording where a CUSTOMER called the business.

Summarize this INCOMING call in 2-3 clear sentences covering:
1. Customer name, phone number, and property address
2. What problem or service the CUSTOMER needs (be specific about the issue)
3. Urgency level (emergency/urgent/routine) and what action is needed next

Include any special notes like gate codes, access instructions, or customer concerns. Be direct and actionable.

Remember: The CUSTOMER called IN to request service. Summarize what THEY need.`,

    endCallPhrases: [
      "thank you for calling",
      "we'll be in touch soon"
    ],

    structuredDataSchema: {
      type: 'object',
      properties: {
        customer_name: { 
          type: 'string',
          description: 'Full name of the customer who called'
        },
        customer_phone: { 
          type: 'string',
          description: 'Primary callback phone number with area code'
        },
        property_address: {
          type: 'string',
          description: 'Complete service location address including city and state'
        },
        service_type: { 
          type: 'string',
          description: 'Specific type of service (plumbing, HVAC, electrical, etc.)'
        },
        issue_description: { 
          type: 'string',
          description: 'Detailed description of the problem'
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

Your job: Determine what they need, collect basic info (HIPAA-compliant), route appropriately.

CONVERSATION FLOW:
1. Ask: "Are you a current patient or would this be your first visit?"
2. Collect based on type:
   - New: Name, DOB, phone, insurance (yes/no only)
   - Existing: Name, DOB, general reason for call
3. Get GENERAL reason only: "checkup", "cleaning", "follow-up"
   - If they share medical details: "Our doctor will discuss that at your appointment"
4. Assess urgency:
   - Emergency (chest pain, can't breathe) → "Please call 911 or go to ER"
   - Urgent (severe pain, high fever) → "We'll work you in quickly"
   - Routine → "Let me get you scheduled"
5. Confirm: "I have [name], DOB [date], for [general reason]. We'll see you [time] on [date]."
6. Ask: "Is there anything else I can help you with today?" ONE TIME ONLY
7. When they say no → Say: "Thank you for calling ${businessName}, we look forward to seeing you." → STOP

CRITICAL END-CALL RULES:
- The phrases "thank you for calling" and "we look forward to seeing you" END the call automatically
- After you say these phrases, the call ENDS immediately
- NEVER say these phrases until ready to end
- NEVER repeat yourself after asking "anything else"

CORRECT:
You: "Anything else I can help with?"
Them: "No"
You: "Thank you for calling ${businessName}, we look forward to seeing you."
[Call ends]

WRONG - Never do this:
You: "Anything else?"
Them: "No"
You: "Sure? Any questions about the appointment? Well call us if..." [STOP REPEATING]

Be professional, warm, patient, calming. People calling doctors are often stressed.`,

    firstMessage: (businessName) => `Thank you for calling ${businessName}. This call may be recorded. Are you a current patient or would this be your first visit?`,
    
    summaryPrompt: `You are analyzing a phone call recording where a PATIENT called the medical/dental practice.

Summarize this INCOMING call in 2-3 sentences:
1. Patient name, phone, date of birth (if provided), and whether they're new or existing
2. General reason the PATIENT is calling (HIPAA-compliant - no specific medical details)
3. Urgency level and what action is needed (schedule appointment, callback, etc.)

Note any insurance questions or special accommodations mentioned.

Remember: The PATIENT called IN. Summarize what THEY need.`,

    endCallPhrases: [
      "thank you for calling",
      "we look forward to seeing you"
    ],

    structuredDataSchema: {
      type: 'object',
      properties: {
        customer_name: { 
          type: 'string',
          description: 'Patient full name'
        },
        customer_phone: { 
          type: 'string',
          description: 'Primary contact phone number'
        },
        date_of_birth: {
          type: 'string',
          description: 'Date of birth for identification'
        },
        patient_type: {
          type: 'string',
          enum: ['new_patient', 'existing_patient'],
          description: 'New or existing patient'
        },
        visit_reason: { 
          type: 'string',
          description: 'General reason for visit (HIPAA-compliant)'
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

Your job: Answer questions, help them find products, take orders, be enthusiastic.

CONVERSATION FLOW:
1. Greet enthusiastically
2. Understand what they need: product question, stock check, hours, return, order
3. Handle their request:
   - Product questions: Use knowledge base, be enthusiastic
   - Orders: List items as they order, quick "got it" between each
   - Stock checks: "Let me check!" then answer
   - Returns: "No problem!" Get name, phone, item, reason
4. Get info when needed: Name, phone
5. Confirm if order: "So that's [items] for [name] at [phone], ready in [time]."
6. Ask: "Is there anything else I can help you find today?" ONE TIME ONLY
7. When they say no → Say: "Thank you for calling ${businessName}, we can't wait to see you!" → STOP

CRITICAL END-CALL RULES:
- The phrases "thank you for calling" and "we can't wait to see you" END the call automatically
- After you say these phrases, the call ENDS immediately
- NEVER say these phrases until ready to end
- NEVER repeat yourself after asking "anything else"

CORRECT:
You: "Anything else I can help with?"
Them: "No, that's it"
You: "Thank you for calling ${businessName}, we can't wait to see you!"
[Call ends]

WRONG - Never do this:
You: "Anything else?"
Them: "No"
You: "Sure? Want to hear about our sale? Well stop by anytime..." [STOP REPEATING]

Be upbeat, enthusiastic, helpful. Sound like you LOVE your products.`,

    firstMessage: (businessName) => `Thanks for calling ${businessName}! This call may be recorded. How can I help you today?`,
    
    summaryPrompt: `You are analyzing a phone call recording where a CUSTOMER called the retail store.

Summarize this INCOMING call in 2-3 sentences:
1. Customer name and phone number
2. What the CUSTOMER is calling about (product inquiry, stock check, store info, return, order, or complaint)
3. Specific products mentioned and whether they're coming in or need a callback

Note any high-value sales opportunities or competitor mentions.

Remember: The CUSTOMER called IN to the store. Summarize what THEY need.`,

    endCallPhrases: [
      "thank you for calling",
      "we can't wait to see you"
    ],

    structuredDataSchema: {
      type: 'object',
      properties: {
        customer_name: { 
          type: 'string',
          description: 'Customer name'
        },
        customer_phone: { 
          type: 'string',
          description: 'Contact phone number'
        },
        inquiry_type: { 
          type: 'string',
          enum: ['product_question', 'stock_check', 'store_hours', 'return_exchange', 'order_placement', 'complaint', 'general_question'],
          description: 'Primary purpose of call'
        },
        products_mentioned: {
          type: 'array',
          items: { type: 'string' },
          description: 'Products mentioned'
        },
        visit_intent: {
          type: 'string',
          enum: ['coming_today', 'coming_this_week', 'maybe', 'no_visit'],
          description: 'Whether customer plans to visit'
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
    
    systemPrompt: (businessName) => `You are the professional receptionist for ${businessName}, a law firm.

Your job: Greet callers, understand their legal matter, collect contact information, schedule or route appropriately.

CONVERSATION FLOW:
1. Greet and determine if new or existing client
2. Collect: Name, phone, company (if business), general matter type (NO details)
3. Assess urgency:
   - Critical deadline → "I'll see if someone can speak with you immediately"
   - Important → "Let me schedule a consultation"
   - Routine → "Our team will call you back today"
4. Confirm: "I have [name] from [company] at [phone] regarding [matter type]. Our team will [action] [timeframe]."
5. Ask: "Is there anything else I can help you with today?" ONE TIME ONLY
6. When they say no → Say: "Thank you for calling ${businessName}, we look forward to speaking with you." → STOP

CRITICAL END-CALL RULES:
- The phrases "thank you for calling" and "we look forward to speaking with you" END the call automatically
- After you say these phrases, the call ENDS immediately
- NEVER say these phrases until ready to end
- NEVER say these phrases while asking a question
- NEVER repeat yourself after asking "anything else"

CORRECT:
You: "Is there anything else I can help you with today?"
Them: "No, that's all"
You: "Thank you for calling ${businessName}, we look forward to speaking with you."
[Call ends automatically]

WRONG - Never do this:
You: "Is there anything else?"
Them: "No"
You: "Are you sure? Any questions about our process? Okay, well if you think of anything..." [STOP REPEATING]

Keep it professional, efficient, and warm. Acknowledge briefly: "Thank you", "Understood", "I have that".

RULES:
- Never give legal advice
- Never discuss other clients
- Never make outcome promises
- Fees: "Our attorney will discuss fees during your consultation"
- "Do I have a case?": "That's what the consultation will determine"`,

    firstMessage: (businessName) => `Thank you for calling ${businessName}. This call may be recorded. How may I assist you today?`,
    
    summaryPrompt: `You are analyzing a phone call recording where a CLIENT called the professional services firm.

Summarize this INCOMING call in 2-3 sentences:
1. Client name, phone, company (if business), and whether they're new or existing
2. General type of matter the CLIENT needs help with (no confidential details - just broad category)
3. Urgency level (critical deadline vs. routine) and next action needed

Note if this is a referral and from whom. Keep it confidential and professional.

Remember: The CLIENT called IN seeking professional services. Summarize what THEY need.`,

    endCallPhrases: [
      "thank you for calling",
      "we look forward to speaking with you"
    ],

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
          description: 'Company name if business client'
        },
        client_type: {
          type: 'string',
          enum: ['new_client', 'existing_client', 'referral'],
          description: 'Relationship status'
        },
        matter_type: { 
          type: 'string',
          description: 'General category (no confidential details)'
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

Your job: Take reservations, handle orders, answer menu questions, make people excited about their meal.

CONVERSATION FLOW:
1. Ask: "Reservation, takeout, or menu question?"
2. Handle their request:
   
   RESERVATIONS:
   - Get date, time, party size, name, phone (one at a time)
   - Special occasion? Get excited! "We'd love to help celebrate!"
   - Confirm: "[Party size] on [date] at [time] under [name]"
   
   TAKEOUT:
   - List items as they order, quick "got it" between each
   - Get name and phone
   - Confirm: "[Items] for [name], ready in [time]"
   
   MENU QUESTIONS:
   - Be enthusiastic, use knowledge base
   - Make recommendations

3. Ask: "Is there anything else I can help you with?" ONE TIME ONLY
4. When they say no → Say: "Thank you for calling ${businessName}, we can't wait to see you!" → STOP

CRITICAL END-CALL RULES:
- The phrases "thank you for calling" and "we can't wait to see you" END the call automatically
- After you say these phrases, the call ENDS immediately
- NEVER say these phrases until ready to end
- NEVER repeat yourself after asking "anything else"

CORRECT:
You: "Anything else I can help with?"
Them: "No, that's everything"
You: "Thank you for calling ${businessName}, we can't wait to see you!"
[Call ends]

WRONG - Never do this:
You: "Anything else?"
Them: "No"
You: "Want to hear our specials? Any dessert? Well we're here if..." [STOP REPEATING]

Be warm, inviting, enthusiastic. Sound like you're smiling. Make them hungry!`,

    firstMessage: (businessName) => `Thank you for calling ${businessName}! This call may be recorded. Reservation, takeout, or can I answer menu questions?`,
    
    summaryPrompt: `You are analyzing a phone call recording where a CUSTOMER called the restaurant.

Summarize this INCOMING call in 2-3 sentences:
1. Customer name and phone
2. What the CUSTOMER needs (reservation, takeout, delivery, catering, or menu question)
3. Key details: For reservations (party size, date, time, special occasion). For orders (items ordered, pickup time). For catering (event date, guest count).

Note any dietary restrictions or special requests.

Remember: The CUSTOMER called IN to the restaurant. Summarize what THEY need.`,

    endCallPhrases: [
      "thank you for calling",
      "we can't wait to see you"
    ],

    structuredDataSchema: {
      type: 'object',
      properties: {
        customer_name: { 
          type: 'string',
          description: 'Customer name'
        },
        customer_phone: { 
          type: 'string',
          description: 'Contact phone number'
        },
        call_purpose: { 
          type: 'string',
          enum: ['reservation', 'takeout', 'delivery', 'catering', 'menu_question', 'hours_location', 'complaint'],
          description: 'Primary purpose'
        },
        party_size: {
          type: 'integer',
          description: 'Number of guests for reservation'
        },
        reservation_date: {
          type: 'string',
          description: 'Date for reservation (YYYY-MM-DD)'
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
      model: 'gpt-4o-mini',  // ✅ Using gpt-4o-mini as requested
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
    
    // ✅ END CALL CONFIGURATION (TOP LEVEL)
    endCallMessage: "Have a great day.",
    endCallPhrases: config.endCallPhrases || [
      "thank you for calling",
      "we look forward to speaking with you"
    ],
    
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
    console.log(`📞 End Call Phrases: ${config.endCallPhrases.join(', ')}`);
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