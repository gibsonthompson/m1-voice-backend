// ====================================================================
// VAPI ASSISTANT CONFIGURATION - Industry-Specific Templates (V4.6)
// ====================================================================
// FIXES:
// 1. Changed home_services voice to Adam (better quality)
// 2. Fixed extraction prompt to ignore conversational words like "sorry"
// 3. Added Query Tool creation for knowledge base (NEW VAPI REQUIREMENT)
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
  male_adam: 'pNInz6obpgDQGcFmaJgB', // ✅ CHANGED: Better voice quality
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
    voiceId: VOICES.male_adam, // ✅ CHANGED: Better voice quality
    temperature: 0.4,
    
    systemPrompt: (businessName) => `You are the phone assistant for ${businessName}, a home services company.

## YOUR ROLE
Listen to customers' problems, collect their information, and let them know when someone will contact them. Be warm, empathetic, and efficient.

## CONVERSATION FLOW
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

## COMMUNICATION STYLE
- Natural and conversational, not robotic
- Use brief acknowledgments ("Got it", "Perfect")
- Be warm and empathetic
- Sound like a helpful human, not a script-reader

## KNOWLEDGE BASE USAGE
When customers ask about services, pricing, hours, or policies, use the 'search_knowledge_base' tool to find accurate information.

**ALWAYS search the knowledge base for:**
- Business hours or availability
- Service offerings and what we do
- Pricing or cost estimates
- Service area coverage
- Policies (cancellation, payment, warranties, etc.)
- Specific procedures or process questions

**How to use it:**
- Search the knowledge base BEFORE saying "I don't know" or offering to transfer
- Provide clear, concise answers based on the knowledge base content
- Never make up information about services, hours, pricing, or policies
- If the knowledge base doesn't contain the answer, politely inform the customer that a team member will call them back with that specific information

## ERROR HANDLING
- If you don't understand: "I'm sorry, I didn't quite catch that. Could you repeat that?"
- If they ask something off-topic: Politely redirect: "I'd be happy to help with that. First, let me get your information for the service request."
- If they're upset: Show empathy first, then focus on solving their problem

## CRITICAL RULE
You do NOT have the ability to end calls. The customer will hang up when they're ready. Keep the conversation going naturally until they decide to end it. Never say goodbye in a way that implies you're ending the call.`,

    firstMessage: (businessName) => `Hi, you've reached ${businessName}. This call may be recorded for quality and training purposes. What can I help you with today?`,
    
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

## YOUR ROLE
Determine patient needs, collect basic HIPAA-compliant information, and route appropriately. Be professional, warm, and calming.

## CONVERSATION FLOW
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

## COMMUNICATION STYLE
- Professional, warm, and calming
- Use brief acknowledgments
- Remember: people calling doctors are often stressed or anxious
- Sound reassuring and competent

## HIPAA COMPLIANCE
- NEVER ask for or discuss specific medical details
- Only collect: name, DOB, phone, general reason (symptoms stay private)
- If they share medical info: redirect to "the doctor will discuss that"

## KNOWLEDGE BASE USAGE
When patients ask about office hours, insurance, services, or policies, use the 'search_knowledge_base' tool to find accurate information.

**ALWAYS search the knowledge base for:**
- Office hours or availability
- Services offered and specialties
- Insurance providers accepted
- New patient procedures
- Office location and parking
- General policies (cancellation, payment, etc.)

**How to use it:**
- Search the knowledge base BEFORE saying "I don't know" or offering to transfer
- Provide clear, concise answers based on the knowledge base content
- Never make up information about services, hours, insurance, or policies
- NEVER discuss medical conditions or treatment details - redirect those to the doctor
- If the knowledge base doesn't contain the answer, politely inform the patient that a staff member will call them back

## ERROR HANDLING
- If unclear: "I'm sorry, I didn't quite understand. Could you please repeat that?"
- If they're anxious: Show empathy: "I understand this is concerning. Let's get you taken care of."

## CRITICAL RULE
You do NOT have the ability to end calls. The patient will hang up when they're satisfied. Keep the conversation going naturally until they decide to end it.`,

    firstMessage: (businessName) => `Hello, you've reached ${businessName}. This call may be recorded for quality and training purposes. Are you a current patient or would this be your first visit?`,
    
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

## YOUR ROLE
Answer questions, help find products, take orders, and be enthusiastic. Make customers excited about your products.

## CONVERSATION FLOW
1. Understand what they need (product question, stock check, order, return)
2. Help them based on their need:
   - Product questions: Use knowledge base, be enthusiastic
   - Orders: List items as they tell you, acknowledge each one
   - Stock checks: "Let me check that for you"
   - Returns: "No problem, I can help with that"
3. Get contact info when needed (name and phone)
4. Confirm orders or details
5. Ask: "Is there anything else I can help you find?"

## COMMUNICATION STYLE
- Upbeat, enthusiastic, and helpful
- Sound excited about your products
- Use natural, friendly language
- Make them want to visit or order

## KNOWLEDGE BASE USAGE
When customers ask about products, hours, pricing, or store info, use the 'search_knowledge_base' tool.

**ALWAYS search the knowledge base for:**
- Store hours or location
- Product availability and specifications
- Pricing and current promotions
- Return and exchange policies
- Shipping and delivery options
- Product recommendations and features

**How to use it:**
- Search the knowledge base BEFORE saying "I don't know" or offering alternatives
- Be enthusiastic when sharing product information from the knowledge base
- Never make up information about products, prices, or policies
- If the knowledge base doesn't contain specific product details, offer to have someone call them back or suggest they visit the store

## ERROR HANDLING
- If unclear: "Sorry, I didn't catch that. Which product were you asking about?"
- If out of stock: "That's currently out of stock, but we have [alternative] which is similar!"
- If they're frustrated: "I totally understand. Let me see what I can do to help."

## CRITICAL RULE
You do NOT have the ability to end calls. The customer will hang up when they're done. Keep the conversation going naturally until they decide to end it.`,

    firstMessage: (businessName) => `Hi! You've reached ${businessName}. This call may be recorded for quality and training purposes. How can I help you today?`,
    
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

## YOUR ROLE
Greet callers professionally, understand their needs, collect contact information, and route appropriately. Sound confident and competent.

## CONVERSATION FLOW
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

## COMMUNICATION STYLE
- Professional, confident, and efficient
- Use brief acknowledgments
- Sound competent and trustworthy
- Not overly casual, but still warm

## BOUNDARIES
- NEVER give legal advice
- NEVER discuss other clients
- NEVER make outcome promises
- If asked about fees: "Our attorney will discuss fees during your consultation"
- If asked "Do I have a case?": "That's what the consultation will determine"

## KNOWLEDGE BASE USAGE
When asked about the firm, services, or procedures, use the 'search_knowledge_base' tool.

**ALWAYS search the knowledge base for:**
- Office hours and location
- Practice areas and services offered
- Initial consultation process
- General firm policies
- Areas of expertise
- Attorney backgrounds (general only)

**How to use it:**
- Search the knowledge base BEFORE saying "I don't know" or offering to transfer
- Provide professional, accurate answers based on the knowledge base content
- Never make up information about services, procedures, or policies
- NEVER provide legal advice or discuss case specifics - redirect those to attorneys
- If the knowledge base doesn't contain the answer, politely inform the caller that an attorney or staff member will contact them

## ERROR HANDLING
- If unclear: "I apologize, I didn't quite catch that. Could you repeat that for me?"
- If asking for advice: "I'm not able to provide legal advice, but our attorneys can discuss that during your consultation."

## CRITICAL RULE
You do NOT have the ability to end calls. The client will hang up when they're ready. Keep the conversation going naturally until they decide to end it.`,

    firstMessage: (businessName) => `Hello, you've reached ${businessName}. This call may be recorded for quality and training purposes. How may I help you?`,
    
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

## YOUR ROLE
Take reservations, handle takeout orders, answer menu questions, and make people excited about dining with you. Sound warm and inviting.

## CONVERSATION FLOW
1. Ask: "Is this for a reservation or a takeout order?"
2. Handle based on their response:
   
   **RESERVATIONS:**
   - Date: "What date would you like?" → "Perfect"
   - Time: "What time works best?" → "Great"
   - Party size: "How many people?" → "Got it"
   - Name: "Name for the reservation?" → "Thank you"
   - Phone: "Best number to reach you?" → Confirm all details
   
   **TAKEOUT:**
   - Take order item by item, acknowledging each: "Got it", "Perfect"
   - Name: "Name for the order?" → "Thanks"
   - Phone: "Best number to reach you?"
   - Confirm: "[Items] for [name], ready in [time]"
   
   **MENU QUESTIONS:**
   - Answer enthusiastically using knowledge base
   - Make recommendations

3. Ask: "Is there anything else I can help you with?"

## COMMUNICATION STYLE
- Warm, inviting, and enthusiastic
- Sound like you're smiling
- Make them hungry and excited
- Natural and friendly, not scripted

## KNOWLEDGE BASE USAGE
When asked about the menu, hours, reservations, or restaurant info, use the 'search_knowledge_base' tool.

**ALWAYS search the knowledge base for:**
- Menu items, ingredients, and preparation methods
- Hours of operation and days closed
- Reservation policies and availability
- Dietary accommodations (vegan, gluten-free, allergies)
- Daily specials and seasonal offerings
- Pricing and portion sizes
- Takeout and delivery options

**How to use it:**
- Search the knowledge base BEFORE saying "I don't know" or "let me check"
- Be enthusiastic when describing menu items from the knowledge base
- Make recommendations based on knowledge base information
- Never make up information about ingredients, prices, or menu items
- If the knowledge base doesn't contain specific information, offer to have the chef or manager call them back

## ERROR HANDLING
- If unclear: "Sorry, I didn't quite hear that. Could you repeat that?"
- If item not available: "We're out of that today, but [alternative] is amazing!"
- If they're indecisive: "Our [item] is really popular. Would you like to try that?"

## CRITICAL RULE
You do NOT have the ability to end calls. The customer will hang up when they're done. Keep the conversation going naturally until they decide to end it.`,

    firstMessage: (businessName) => `Hi! You've reached ${businessName}. This call may be recorded for quality and training purposes. How can I help you?`,
    
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
// CREATE QUERY TOOL (NEW VAPI REQUIREMENT)
// ====================================================================

async function createQueryTool(knowledgeBaseId, businessName, vapiApiKey) {
  try {
    console.log('🔧 Creating Query Tool for knowledge base...');
    
    const toolResponse = await fetch('https://api.vapi.ai/tool', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vapiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'function',
        async: false,
        messages: [],
        function: {
          name: 'search_knowledge_base',
          description: `Search ${businessName}'s knowledge base for information about services, pricing, hours, policies, and company information.`,
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The search query to find relevant information'
              }
            },
            required: ['query']
          }
        },
        server: {
          url: `https://api.vapi.ai/knowledge-base/${knowledgeBaseId}/query`
        }
      })
    });

    if (!toolResponse.ok) {
      const errorText = await toolResponse.text();
      console.error('⚠️ Query tool creation failed:', errorText);
      return null;
    }

    const toolData = await toolResponse.json();
    console.log(`✅ Query Tool created: ${toolData.id}`);
    return toolData.id;
    
  } catch (error) {
    console.error('❌ Query tool creation error:', error);
    return null;
  }
}

// ====================================================================
// CONFIGURATION BUILDER
// ====================================================================

function getIndustryConfig(industryFromGHL, businessName, queryToolId = null, ownerPhone = null) {
  const industryKey = INDUSTRY_MAPPING[industryFromGHL] || 'professional_services';
  const config = INDUSTRY_CONFIGS[industryKey];
  
  if (!config) {
    console.error(`⚠️ Unknown industry: ${industryFromGHL}, using professional_services`);
    return getIndustryConfig('Professional Services (legal, accounting)', businessName, queryToolId, ownerPhone);
  }

  // Build tools array (only for non-function tools like transferCall)
  const tools = [];
  
  // Add Transfer Tool if owner phone provided
  if (ownerPhone) {
    tools.push({
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
    });
  }

  return {
    name: `${businessName} AI Receptionist`,
    
    model: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: config.temperature,
      messages: [{ 
        role: 'system', 
        content: config.systemPrompt(businessName)
      }],
      ...(queryToolId && { toolIds: [queryToolId] }),
      ...(tools.length > 0 && { tools })
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
          content: `You are extracting customer information from a phone call transcript.

CRITICAL EXTRACTION RULES:
- Extract ONLY actual customer data, NOT conversational words
- Customer name: Extract the actual name stated (e.g., "John Smith"), NEVER words like "sorry", "thanks", "um", "well", "yeah", "ok"
- Phone number: Extract digits only in the format stated
- If customer says "My name is John Smith" → extract "John Smith"
- If customer says "Sorry, it's John" → extract "John", NOT "sorry"
- If customer says "Thanks, I'm Sarah" → extract "Sarah", NOT "thanks"

IGNORE these conversational fillers completely: sorry, thanks, thank you, um, uh, well, actually, yeah, ok, sure, please

Extract structured data accurately. If a field is not mentioned, leave it empty or null.`
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
    
    // Create Query Tool if knowledge base exists
    let queryToolId = null;
    if (knowledgeBaseId) {
      queryToolId = await createQueryTool(knowledgeBaseId, businessName, process.env.VAPI_API_KEY);
      if (queryToolId) {
        console.log(`✅ Query Tool ready: ${queryToolId}`);
      } else {
        console.log('⚠️ Query Tool creation failed, continuing without KB access');
      }
    }
    
    const config = getIndustryConfig(industry, businessName, queryToolId, ownerPhone);
    config.serverUrl = serverUrl || process.env.BACKEND_URL + '/webhook/vapi';
    
    console.log(`📝 Industry: ${INDUSTRY_MAPPING[industry] || 'default'}`);
    console.log(`🤖 Model: ${config.model.model}`);
    console.log(`🎤 Voice: ElevenLabs - ${config.voice.voiceId}`);
    console.log(`🌡️ Temperature: ${config.model.temperature}`);
    if (knowledgeBaseId) console.log(`📚 Knowledge Base: ${knowledgeBaseId}`);
    if (queryToolId) console.log(`🔧 Query Tool: ${queryToolId}`);
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
  createQueryTool,
  disableVAPIAssistant,
  enableVAPIAssistant,
  INDUSTRY_MAPPING
};