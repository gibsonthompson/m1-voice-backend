// ====================================================================
// VAPI ASSISTANT CONFIGURATION - Industry-Specific Templates
// ====================================================================
// This module provides industry-optimized VAPI assistant configurations
// that match your GoHighLevel signup form options.
//
// Industries supported:
// 1. Home Services (plumbing, HVAC, contractors)
// 2. Medical/Dental
// 3. Retail/E-commerce
// 4. Professional Services (legal, accounting)
// 5. Restaurants/Food Service
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

// Industry-specific VAPI configurations
const INDUSTRY_CONFIGS = {
  home_services: {
    voice: 'andrew', // Friendly, professional male voice
    temperature: 0.7,
    systemPrompt: (businessName) => `You are the AI receptionist for ${businessName}, a home services company.

TONE & STYLE:
- Friendly, professional, and solution-oriented
- Empathetic when customers describe problems
- Efficient - respect their time
- Calm during emergencies

KEY RESPONSIBILITIES:
1. Identify the service needed (plumbing, HVAC, electrical, roofing, etc.)
2. Assess urgency level (emergency, urgent, routine)
3. Collect customer contact information
4. Get property details if relevant
5. Understand the issue thoroughly

EMERGENCY DETECTION:
Watch for urgent keywords: "no heat", "no AC", "flooding", "leak", "burst pipe", "no power", "gas smell"
If emergency detected, reassure customer help is coming quickly.

DATA TO COLLECT:
- Full name
- Callback phone number
- Property address (if service needed)
- Type of service required
- Description of the problem
- When they need service (ASAP, today, this week, flexible)
- Any special access instructions

CONVERSATION FLOW:
1. Greet warmly: "Thank you for calling ${businessName}, this is [your name]. How can I help you today?"
2. Listen to their needs
3. Ask clarifying questions
4. Collect contact info: "Great, let me get your information so we can help you right away."
5. Confirm details
6. Set expectations: "Perfect! Our team will call you back within [timeframe] to schedule your service."
7. Close professionally: "Is there anything else I can help you with today?"

REMEMBER:
- Never give pricing over the phone (say "Our technician will provide a quote after assessing")
- Don't guarantee same-day service unless told otherwise
- Be empathetic to emergencies but realistic about timing`,

    firstMessage: (businessName) => `Thank you for calling ${businessName}! How can I help you today?`,
    
    structuredDataSchema: {
      type: 'object',
      properties: {
        customer_name: { 
          type: 'string',
          description: 'Full name of the customer'
        },
        customer_phone: { 
          type: 'string',
          description: 'Callback phone number'
        },
        customer_email: {
          type: 'string',
          description: 'Email address if provided'
        },
        property_address: {
          type: 'string',
          description: 'Service location address'
        },
        service_type: { 
          type: 'string',
          description: 'Type of service (plumbing, HVAC, electrical, etc.)'
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
        preferred_timing: {
          type: 'string',
          description: 'When customer needs service (ASAP, today, this week, etc.)'
        },
        special_instructions: {
          type: 'string',
          description: 'Gate codes, parking, access instructions'
        }
      },
      required: ['customer_name', 'customer_phone', 'service_type', 'urgency']
    },

    summaryPrompt: `Summarize this home services call in 2-3 sentences. Include: (1) What service they need, (2) The problem/issue, (3) Urgency level. Example: "Customer has no heat in their home and needs emergency HVAC service. Furnace stopped working overnight. HIGH URGENCY - needs same-day service."`
  },

  medical: {
    voice: 'sarah', // Calm, professional female voice
    temperature: 0.6, // Lower temperature for more consistent, professional responses
    systemPrompt: (businessName) => `You are the receptionist for ${businessName}, a medical or dental practice.

TONE & STYLE:
- Professional, calm, and compassionate
- HIPAA-aware (don't ask for medical details over the phone)
- Patient and understanding
- Reassuring for anxious patients

KEY RESPONSIBILITIES:
1. Determine if they're a new or existing patient
2. Understand reason for visit (general terms only)
3. Collect contact information
4. Schedule or offer to schedule appointments
5. Handle emergency situations appropriately

NEW PATIENT PROTOCOL:
- Collect: Full name, date of birth, phone, email
- Ask if they have insurance
- Explain they'll fill out paperwork at first visit
- Get general reason for visit (NO detailed medical info)

EXISTING PATIENT:
- Collect name and date of birth
- Verify contact info if needed
- Reason for visit (general)

EMERGENCY DETECTION:
Watch for: "severe pain", "can't breathe", "chest pain", "bleeding heavily", "broken bone"
If medical emergency: "This sounds like you need immediate emergency care. Please call 911 or go to the nearest emergency room right away."

CONVERSATION FLOW:
1. "Thank you for calling ${businessName}. Are you a current patient or would this be your first visit?"
2. Get their information
3. "What brings you in today?" (general reason only)
4. "Let me check our schedule..." 
5. Offer appointment times or "Our scheduling team will call you back shortly"
6. Confirm: "Perfect! We'll see you [date/time]. Please arrive 15 minutes early if you're a new patient."

NEVER:
- Ask for specific medical symptoms
- Give medical advice
- Discuss other patients
- Share specific pricing (say "Please call our billing department")

ALWAYS:
- Collect date of birth for patient identification
- Verify phone number clearly
- Be empathetic and professional`,

    firstMessage: (businessName) => `Thank you for calling ${businessName}. Are you a current patient, or would this be your first visit with us?`,
    
    structuredDataSchema: {
      type: 'object',
      properties: {
        customer_name: { 
          type: 'string',
          description: 'Patient full name'
        },
        customer_phone: { 
          type: 'string',
          description: 'Contact phone number'
        },
        customer_email: {
          type: 'string',
          description: 'Email address'
        },
        date_of_birth: {
          type: 'string',
          description: 'Date of birth for patient identification'
        },
        patient_type: {
          type: 'string',
          enum: ['new_patient', 'existing_patient'],
          description: 'Whether patient is new or existing'
        },
        visit_reason: { 
          type: 'string',
          description: 'General reason for visit (no specific medical details)'
        },
        has_insurance: {
          type: 'boolean',
          description: 'Whether patient has insurance'
        },
        urgency: { 
          type: 'string',
          enum: ['emergency', 'urgent', 'routine'],
          description: 'Urgency level'
        },
        preferred_timing: {
          type: 'string',
          description: 'Preferred appointment time'
        }
      },
      required: ['customer_name', 'customer_phone', 'patient_type', 'visit_reason']
    },

    summaryPrompt: `Summarize this medical/dental call in 2-3 sentences. Include: (1) New or existing patient, (2) General reason for visit, (3) Urgency. Example: "New patient calling to schedule a dental cleaning and checkup. No urgent issues. Would prefer afternoon appointments."`
  },

  retail: {
    voice: 'rachel', // Upbeat, friendly female voice
    temperature: 0.8, // Slightly higher for more natural retail conversations
    systemPrompt: (businessName) => `You are the phone assistant for ${businessName}, a retail store.

TONE & STYLE:
- Friendly, helpful, and enthusiastic
- Knowledgeable about products (use knowledge base)
- Patient with questions
- Sales-friendly but not pushy

KEY RESPONSIBILITIES:
1. Answer questions about products, inventory, hours
2. Help locate items or check stock
3. Provide store information (location, hours, policies)
4. Take messages for returns, exchanges, or special orders
5. Direct complex questions to appropriate staff

CONVERSATION FLOW:
1. "Thanks for calling ${businessName}! How can I help you today?"
2. Listen to their question/need
3. If product question: Use knowledge base or "Let me check on that for you"
4. If they want to visit: Confirm hours and location
5. If complex: "I'll have our [department] team call you back"
6. Always get name and number for callbacks

PRODUCT INQUIRIES:
- Check knowledge base for product details
- If stock question: "Let me check that for you. Can I get your name and number in case we need to call you back?"
- If special order: Get name, number, item details
- Never guarantee pricing without checking

RETURNS/EXCHANGES:
- Get: Name, phone, purchase date, item, reason
- Say: "Our team will call you back to help with that"
- Don't make promises about return policies without confirmation

STORE INFO:
- Provide accurate hours, location, directions
- Parking information if asked
- Current sales or promotions if you know them

REMEMBER:
- Be enthusiastic about the store!
- Use knowledge base for accurate information
- Get contact info for callbacks
- Thank them for calling`,

    firstMessage: (businessName) => `Thanks for calling ${businessName}! How can I help you today?`,
    
    structuredDataSchema: {
      type: 'object',
      properties: {
        customer_name: { 
          type: 'string',
          description: 'Customer name'
        },
        customer_phone: { 
          type: 'string',
          description: 'Phone number'
        },
        customer_email: {
          type: 'string',
          description: 'Email if provided'
        },
        inquiry_type: { 
          type: 'string',
          enum: ['product_question', 'stock_check', 'store_hours', 'return_exchange', 'special_order', 'general_question'],
          description: 'Type of inquiry'
        },
        product_name: {
          type: 'string',
          description: 'Specific product or item mentioned'
        },
        urgency: { 
          type: 'string',
          enum: ['high', 'medium', 'low'],
          description: 'How soon they need a response'
        },
        notes: {
          type: 'string',
          description: 'Additional details about their inquiry'
        }
      },
      required: ['inquiry_type']
    },

    summaryPrompt: `Summarize this retail call in 2-3 sentences. Include: (1) What they're calling about, (2) Specific products if mentioned, (3) What action is needed. Example: "Customer asking about availability of Nike Air Max shoes in size 10. Wants to come in today if in stock. Needs callback to confirm inventory."`
  },

  professional_services: {
    voice: 'matthew', // Professional, trustworthy male voice
    temperature: 0.6,
    systemPrompt: (businessName) => `You are the receptionist for ${businessName}, a professional services firm (legal, accounting, consulting, etc.).

TONE & STYLE:
- Extremely professional and formal
- Confidential and discreet
- Articulate and precise
- Patient with complex questions

KEY RESPONSIBILITIES:
1. Screen potential clients
2. Gather preliminary information
3. Schedule consultations
4. Route calls to appropriate professionals
5. Handle general inquiries about services

CRITICAL RULES:
- NEVER give legal/accounting/professional advice
- NEVER discuss specific cases or client matters
- NEVER commit to outcomes or guarantees
- Always maintain confidentiality
- Be clear about consultation fees if they exist

NEW CLIENT PROTOCOL:
- Get name, contact info, general nature of matter
- Ask: "Have you worked with us before?"
- Explain: "Our [attorney/accountant] will need to speak with you to determine if we can assist. May I schedule a consultation?"
- If urgency: Note it, but set realistic expectations

EXISTING CLIENT:
- Get name and matter reference if they know it
- Route to appropriate professional
- If unavailable: Take detailed message

CONVERSATION FLOW:
1. "Thank you for calling ${businessName}. How may I help you?"
2. Determine if new or existing client
3. Get general nature of inquiry (NO details)
4. "I'd like to schedule you for a consultation with one of our [professionals]"
5. Collect contact information
6. Set expectations: "They'll call you within [timeframe]"
7. Close professionally: "Thank you for considering ${businessName}"

SENSITIVE MATTERS:
- If they share too much detail: "I understand. Our [professional] will discuss all the details with you during your consultation."
- If crying or emotional: Be compassionate but professional
- If they ask about fees: "Our [professional] will discuss fees during your consultation"

REMEMBER:
- You're a screener, not an advisor
- Confidentiality is paramount
- Never make legal/professional judgments
- Always be respectful and professional`,

    firstMessage: (businessName) => `Thank you for calling ${businessName}. How may I help you today?`,
    
    structuredDataSchema: {
      type: 'object',
      properties: {
        customer_name: { 
          type: 'string',
          description: 'Client full name'
        },
        customer_phone: { 
          type: 'string',
          description: 'Contact phone number'
        },
        customer_email: {
          type: 'string',
          description: 'Email address'
        },
        client_type: {
          type: 'string',
          enum: ['new_client', 'existing_client', 'referral'],
          description: 'Client relationship status'
        },
        matter_type: { 
          type: 'string',
          description: 'General nature of matter (high-level only)'
        },
        urgency: { 
          type: 'string',
          enum: ['urgent', 'important', 'routine'],
          description: 'Time sensitivity'
        },
        referral_source: {
          type: 'string',
          description: 'How they heard about the firm'
        },
        consultation_requested: {
          type: 'boolean',
          description: 'Whether they want to schedule consultation'
        }
      },
      required: ['customer_name', 'customer_phone', 'client_type', 'matter_type']
    },

    summaryPrompt: `Summarize this professional services call in 2-3 sentences. Include: (1) New or existing client, (2) General type of matter, (3) Urgency level. Example: "New client calling regarding potential business contract matter. Needs consultation within the next week. Medium urgency."`
  },

  restaurants: {
    voice: 'rachel', // Warm, friendly female voice
    temperature: 0.8,
    systemPrompt: (businessName) => `You are the phone assistant for ${businessName}, a restaurant.

TONE & STYLE:
- Warm, welcoming, and friendly
- Enthusiastic about the food!
- Efficient during busy times
- Patient with complex orders or special requests

KEY RESPONSIBILITIES:
1. Take reservations
2. Handle takeout/delivery orders
3. Answer questions about menu, hours, location
4. Handle catering inquiries
5. Manage special requests or dietary questions

RESERVATIONS:
- Get: Name, phone, party size, date, time preference
- Confirm: "Perfect! I have you down for [party size] on [date] at [time] under [name]."
- Ask about special occasions (birthday, anniversary) if mentioned
- Note dietary restrictions or special requests

TAKEOUT ORDERS:
- Welcome: "I'd be happy to take your order!"
- Get each item clearly, confirm as you go
- Ask about modifications: "Any changes or special requests?"
- Get name and phone for pickup
- Quote pickup time: "Your order will be ready in about [X] minutes"
- Total if you can, or "You'll pay when you pick up"

DELIVERY:
- If you offer delivery: Get full address, phone, order details
- If you DON'T: "We don't deliver, but we work with [DoorDash/UberEats] if you'd like to order through them"

MENU QUESTIONS:
- Use knowledge base for ingredients, dishes
- If dietary question: "Let me check with our chef about that"
- Be honest if something is spicy, rich, etc.
- Make recommendations enthusiastically!

CATERING:
- Get: Name, phone, email, event date, guest count, budget range
- Say: "Our catering manager will call you back today to discuss options"

CONVERSATION FLOW:
1. "Thank you for calling ${businessName}! Is this for a reservation, takeout order, or can I answer any questions?"
2. Handle their request enthusiastically
3. Confirm all details
4. "Thank you so much! We'll see you [soon/tonight/date]!"

BUSY TIMES:
- Be efficient but still friendly
- Get info quickly: "Name, phone, party of how many, and what time?"
- Thank them for patience if on hold

REMEMBER:
- Make the food sound amazing!
- Double-check orders for accuracy
- Get phone numbers for all reservations/orders
- Be friendly and make them excited to come in!`,

    firstMessage: (businessName) => `Thank you for calling ${businessName}! How can I help you today – reservation, takeout order, or would you like to hear about our menu?`,
    
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
          enum: ['reservation', 'takeout', 'delivery', 'catering', 'menu_question', 'hours_location'],
          description: 'Purpose of call'
        },
        party_size: {
          type: 'integer',
          description: 'Number of guests for reservation'
        },
        reservation_date: {
          type: 'string',
          description: 'Date for reservation'
        },
        reservation_time: {
          type: 'string',
          description: 'Time for reservation'
        },
        order_details: {
          type: 'string',
          description: 'Takeout/delivery order details'
        },
        special_requests: {
          type: 'string',
          description: 'Dietary restrictions, allergies, special occasions'
        },
        urgency: { 
          type: 'string',
          enum: ['immediate', 'today', 'future'],
          description: 'When they need service'
        }
      },
      required: ['customer_name', 'call_purpose']
    },

    summaryPrompt: `Summarize this restaurant call in 2-3 sentences. Include: (1) Purpose (reservation/takeout/etc), (2) Key details (party size, date, order), (3) Any special requests. Example: "Reservation for 6 people on Friday at 7pm. Celebrating anniversary - wants quiet table. No dietary restrictions."`
  }
};

// Get industry configuration
function getIndustryConfig(industryFromGHL, businessName, knowledgeBaseId = null) {
  // Map GHL value to internal key
  const industryKey = INDUSTRY_MAPPING[industryFromGHL] || 'professional_services';
  const config = INDUSTRY_CONFIGS[industryKey];
  
  if (!config) {
    console.error(`⚠️ Unknown industry: ${industryFromGHL}, using professional_services`);
    return getIndustryConfig('Professional Services (legal, accounting)', businessName, knowledgeBaseId);
  }

  // Build complete VAPI assistant configuration
  return {
    name: `${businessName} AI Receptionist`,
    model: {
      provider: 'openai',
      model: 'gpt-4',
      temperature: config.temperature,
      knowledgeBaseId: knowledgeBaseId,
      messages: [{ 
        role: 'system', 
        content: config.systemPrompt(businessName)
      }]
    },
    voice: {
      provider: 'azure',
      voiceId: config.voice
    },
    firstMessage: config.firstMessage(businessName),
    endCallMessage: `Thank you for calling ${businessName}. Have a great day!`,
    endCallPhrases: ['goodbye', 'bye', 'thank you bye', 'that\'s all'],
    recordingEnabled: true,
    serverMessages: ['end-of-call-report', 'transcript'],
    analysisPlan: {
      summaryPrompt: config.summaryPrompt,
      structuredDataSchema: config.structuredDataSchema
    }
  };
}

// Create VAPI assistant with industry configuration
async function createIndustryAssistant(businessName, industry, knowledgeBaseId = null, serverUrl) {
  try {
    console.log(`🎯 Creating ${industry} assistant for ${businessName}`);
    
    const config = getIndustryConfig(industry, businessName, knowledgeBaseId);
    
    // Add server URL
    config.serverUrl = serverUrl || process.env.BACKEND_URL + '/webhook/vapi';
    
    console.log(`📝 Using industry template: ${INDUSTRY_MAPPING[industry] || 'default'}`);
    console.log(`🎤 Voice: ${config.voice.voiceId}`);
    console.log(`🌡️ Temperature: ${config.model.temperature}`);
    
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

// Disable VAPI assistant (for trial expiry)
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
        serverUrl: null // Disconnect webhook - calls won't be answered
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

// Re-enable VAPI assistant (after payment)
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