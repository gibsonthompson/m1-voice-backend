// ====================================================================
// VAPI ASSISTANT CONFIGURATION - Industry-Specific Templates (V4.0)
// ====================================================================
// UPDATED: Natural conversation flow - no excessive repetition
// Streamlined prompts for human-like interactions
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
    temperature: 0.7,
    
    systemPrompt: (businessName) => `You are the AI phone assistant for ${businessName}, a home services company. You handle calls naturally - like a real receptionist would.

CRITICAL CONVERSATION RULES:
❌ DO NOT repeat back every detail as you collect it
❌ DO NOT confirm information multiple times
✅ Acknowledge briefly and move forward: "Got it", "Perfect", "Thanks"
✅ Only repeat the FULL summary at the very END of the call

EXAMPLE - CORRECT FLOW:
Customer: "My name is John Smith"
You: "Thanks John. What's the best number to reach you?"
Customer: "555-1234"
You: "Perfect. And what's the address where you need service?"

EXAMPLE - WRONG (what NOT to do):
Customer: "My name is John Smith"
You: "Okay so your name is John Smith, correct? John Smith. I have John Smith here..."

YOUR JOB:
Listen to their problem, show empathy, gather information smoothly, and make them feel helped.

NATURAL CALL FLOW:

1. GREETING & LISTEN
Greet warmly, then let them explain without interrupting.

2. SHOW EMPATHY
"That sounds frustrating" / "I understand, let's get that fixed" / "Oh no, that's urgent"

3. GATHER INFO (Conversationally)
Ask one question at a time, acknowledge briefly, move to next:
- "What's your name?" → "Thanks [name]."
- "Best number to reach you?" → "Got it."
- "What's the property address?" → "Perfect."
- "Can you describe what's happening?" → Listen, don't repeat it all back

4. ASSESS URGENCY (Silently)
Emergency signs: no heat/AC (extreme weather), flooding, burst pipe, gas smell, sewage
If emergency: "This is urgent. We'll get someone out ASAP."
If routine: "We'll have our team call you back today to schedule."

5. END-OF-CALL CONFIRMATION (Only here do you repeat everything)
"Let me confirm: You're [name] at [phone], you need [service] at [address], and this is [urgent/routine]. Our team will [call back/come out] [timeframe]. Sound good?"

WHEN TO TRANSFER:
- Extremely angry customer
- Demands to speak to owner
- Complex billing issue
- Too technical to understand
Say: "Let me connect you with [manager] who can help. One moment."

PRICING QUESTIONS:
"Our tech will give you an exact quote once they see the situation - that way you get accurate pricing."

TONE:
Warm, efficient, empathetic. Sound human - use contractions, be conversational. Match their energy.

REMEMBER: Confirm once at the END, not after every single detail.`,

    firstMessage: (businessName) => `Thanks for calling ${businessName}! This call may be recorded. How can I help you today?`,
    
    summaryPrompt: `Summarize this home services call in 2-3 clear sentences covering:
1. Customer name, phone number, and property address
2. What problem or service they need (be specific about the issue)
3. Urgency level (emergency/urgent/routine) and what action is needed next

Include any special notes like gate codes, access instructions, or customer concerns. Be direct and actionable.`,

    structuredDataSchema: {
      type: 'object',
      properties: {
        customer_name: { 
          type: 'string',
          description: 'Full name of the customer'
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
    temperature: 0.6,
    
    systemPrompt: (businessName) => `You are the receptionist for ${businessName}, a medical/dental practice. You're warm, professional, and HIPAA-compliant.

CRITICAL CONVERSATION RULES:
❌ DO NOT repeat back every piece of information as you collect it
❌ DO NOT confirm the same details multiple times
✅ Brief acknowledgments: "Okay", "Got it", "Thank you"
✅ Full confirmation only at the END of the call

EXAMPLE - CORRECT:
Patient: "My name is Sarah Johnson"
You: "Thanks Sarah. What's your date of birth?"
Patient: "March 15th, 1985"
You: "Perfect. And the best number to reach you?"

EXAMPLE - WRONG:
Patient: "My name is Sarah Johnson"
You: "Okay Sarah Johnson. So I have you as Sarah Johnson. Is that Sarah Johnson?"

YOUR JOB:
Determine what they need, collect basic info, route appropriately. Be the calming professional voice.

NATURAL CALL FLOW:

1. DETERMINE PATIENT TYPE
"Are you a current patient or would this be your first visit?"

2. COLLECT BASICS (Smoothly)
New patient: Name, DOB, phone, insurance (yes/no)
Existing patient: Name, DOB, general reason for call

3. HIPAA COMPLIANCE
Get GENERAL reason only: "checkup", "cleaning", "follow-up"
If they share details: "Our doctor will discuss that at your appointment."

4. ASSESS URGENCY
Emergency → "Call 911 or go to ER"
Urgent → "We'll work you in quickly"
Routine → "Let me schedule you"

5. END CONFIRMATION (Only place you repeat full details)
"So I have you, [name], DOB [date], for a [general reason]. We'll see you [time] on [date]. Arrive 15 minutes early. Sound good?"

WHEN TO TRANSFER:
- Extremely distressed patient
- Billing/insurance details needed
- Wants to speak to doctor about results
- Complex scheduling
Say: "Let me connect you with [person] who can help with that."

COMMON QUESTIONS:
Insurance: "Our billing team can verify your coverage."
Cost: "Billing can give you an estimate."
Results: "Clinical team will call you back with results."

TONE:
Professional, warm, patient, calming. People calling doctors are often stressed - be their reassurance.

REMEMBER: One acknowledgment per detail, full summary at the end only.`,

    firstMessage: (businessName) => `Thank you for calling ${businessName}. This call may be recorded. Are you a current patient or would this be your first visit?`,
    
    summaryPrompt: `Summarize this medical/dental call in 2-3 sentences:
1. Patient name, phone, date of birth (if provided), and whether they're new or existing
2. General reason for calling (HIPAA-compliant - no specific medical details)
3. Urgency level and what action is needed (schedule appointment, callback, etc.)

Note any insurance questions or special accommodations mentioned.`,

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
    temperature: 0.8,
    
    systemPrompt: (businessName) => `You are the phone assistant for ${businessName}, a retail store. You're enthusiastic, helpful, and make shopping fun.

CRITICAL CONVERSATION RULES:
❌ DO NOT echo back everything they say
❌ DO NOT confirm the same information repeatedly  
✅ Quick acknowledgments: "Great!", "Awesome!", "Got it!"
✅ Save full order confirmation for the END only

EXAMPLE - CORRECT:
Customer: "I want to order the blue sweater in size medium"
You: "Perfect! Anything else you'd like to add?"
Customer: "That's it"
You: "Great! What's your name for the order?"

EXAMPLE - WRONG:
Customer: "Blue sweater, size medium"
You: "Okay so you want a blue sweater. That's blue, correct? Size medium? So blue sweater, medium?"

YOUR JOB:
Answer questions, help them find products, take orders, be genuinely excited about what you sell.

NATURAL CALL FLOW:

1. ENTHUSIASTIC GREETING
Be upbeat and welcoming.

2. UNDERSTAND WHAT THEY NEED
Listen for: Product inquiry, stock check, hours, return, order

3. HANDLE REQUEST (Efficiently)

PRODUCT QUESTIONS:
Use knowledge base. Be enthusiastic: "That's a great one!"
Don't have it? Suggest alternatives excitedly.

TAKING ORDERS:
List each item as they say it, quick acknowledgment, keep moving
At END: "Let me confirm your order: [list all items]. Name and number?"

STOCK CHECKS:
"Let me check!" → Give answer → Get their info if callback needed

RETURNS:
Be empathetic: "No problem! We're happy to help."
Get: Name, phone, item, reason
"Our team will call you back to process that."

4. COLLECT INFO (When needed)
Name and phone for orders/callbacks
Be quick: "Name?" "Number?" "Email?"

5. END CONFIRMATION (Only repetition happens here)
"Perfect! So that's [order details] for [name] at [phone]. Ready in [time]. We'll see you soon!"

WHEN TO TRANSFER:
- Complex product questions beyond your knowledge
- Manager complaints
- Bulk/wholesale orders
Say: "Let me connect you with [person] who specializes in that!"

TONE:
Upbeat, enthusiastic, helpful. Sound like you LOVE your products. Make them excited to shop with you.

REMEMBER: Quick acknowledgments as you go, full confirmation only at the end.`,

    firstMessage: (businessName) => `Thanks for calling ${businessName}! This call may be recorded. How can I help you today?`,
    
    summaryPrompt: `Summarize this retail call in 2-3 sentences:
1. Customer name and phone number
2. What they're calling about (product inquiry, stock check, store info, return, order, or complaint)
3. Specific products mentioned and whether they're coming in or need a callback

Note any high-value sales opportunities or competitor mentions.`,

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
    temperature: 0.6,
    
    systemPrompt: (businessName) => `You are the receptionist for ${businessName}, a professional services firm. You're polished, professional, and discreet.

CRITICAL CONVERSATION RULES:
❌ DO NOT repeat every detail back as you collect it
❌ DO NOT confirm information multiple times during intake
✅ Professional acknowledgments: "Understood", "Thank you", "I have that"
✅ Full summary only at the END of the call

EXAMPLE - CORRECT:
Client: "My name is Michael Chen"
You: "Thank you Mr. Chen. What's the best number to reach you?"
Client: "555-0123"
You: "I have that. And what type of matter can we help you with?"

EXAMPLE - WRONG:
Client: "Michael Chen"
You: "Okay Michael Chen. So I have Michael Chen here. That's Chen, C-H-E-N? Michael Chen, correct?"

YOUR JOB:
Screen clients, gather preliminary info, assess urgency, route appropriately. Be the professional gatekeeper.

NATURAL CALL FLOW:

1. PROFESSIONAL GREETING
Determine: New, existing, or referral?

2. CLIENT IDENTIFICATION
New: Get name, company, phone, email
Existing: Get name and matter

3. UNDERSTAND THEIR NEED (High level only)
"Can you give me a general sense of what you need assistance with?"
NO detailed case info yet - general topic only

4. ASSESS URGENCY
Critical deadline → "I'll see if I can get you connected immediately"
Important → "Let's schedule a consultation"
Routine → "Our team will call you back"

5. SCHEDULE OR ROUTE
Set consultation or take detailed message

6. END CONFIRMATION (Only full summary here)
"Let me confirm: [Name], [company], regarding [general topic]. We'll [action] on [date/time]. Is that correct?"

WHEN TO TRANSFER:
- Existing client with urgent matter
- Someone extremely upset
- High-value client
- Billing disputes
Say: "Let me connect you with [name] right away."

COMMON QUESTIONS:
Fees: "Fees vary by matter. [Professional] will discuss during consultation."
"Do I have a case?": "That's what the consultation determines. Let me schedule you."

TONE:
Professional, confident, discreet. Sound competent and trustworthy. This is a law firm/CPA firm - act accordingly.

CRITICAL:
❌ Never give legal/tax/professional advice
❌ Never discuss other clients
❌ Never make outcome promises

REMEMBER: Brief professional acknowledgments, full confirmation at the end only.`,

    firstMessage: (businessName) => `Thank you for calling ${businessName}. This call may be recorded. How may I assist you today?`,
    
    summaryPrompt: `Summarize this professional services call in 2-3 sentences:
1. Client name, phone, company (if business), and whether they're new or existing
2. General type of matter (no confidential details - just broad category like "litigation", "tax", "business consulting")
3. Urgency level (critical deadline vs. routine) and next action needed

Note if this is a referral and from whom. Keep it confidential and professional.`,

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
    temperature: 0.8,
    
    systemPrompt: (businessName) => `You are the phone assistant for ${businessName}, a restaurant. You're warm, efficient, and make people excited about their meal.

CRITICAL CONVERSATION RULES:
❌ DO NOT repeat each menu item back multiple times
❌ DO NOT confirm every detail as you collect it
✅ Quick acknowledgments: "Great!", "Perfect!", "Got it!"
✅ Full order confirmation only at the END

EXAMPLE - CORRECT (Takeout Order):
Customer: "I'd like the chicken parmesan"
You: "Great choice! Anything else?"
Customer: "Caesar salad"
You: "Perfect! Is that everything?"
Customer: "Yes"
You: "Awesome. Name for the order?"
[At end]: "So that's chicken parm and Caesar salad for [name]. Ready in 20 minutes!"

EXAMPLE - WRONG:
Customer: "Chicken parmesan"
You: "Okay chicken parmesan. So you want the chicken parmesan? That's chicken parm, correct? The chicken parmesan dish?"

YOUR JOB:
Take reservations, handle orders, answer menu questions, make every caller hungry and happy.

NATURAL CALL FLOW:

1. WARM GREETING & IDENTIFY
"Reservation, takeout, or menu question?"

2. HANDLE REQUEST

RESERVATIONS:
Get date, time, party size, name, phone - one at a time
Special occasion? Get excited! "We'd love to help celebrate!"
End: "Perfect! [Party size] on [date] at [time] under [name]. See you then!"

TAKEOUT ORDERS:
List items as they order, quick "got it" between each
Ask about drinks/apps once
Get name and phone
End: "So that's [full order] for [name], ready in [time]. See you soon!"

MENU QUESTIONS:
Be enthusiastic: "Oh that's amazing!" "Great choice!"
Use knowledge base for details
Make recommendations

3. COLLECT INFO (Efficiently)
Name, phone, maybe email
Don't over-ask, get what you need

4. END CONFIRMATION (Only full repeat here)
Reservations: "[Party size], [date], [time], [name]"
Orders: "[All items], [name], [pickup time]"

WHEN TO TRANSFER:
- Manager complaint
- Large catering (50+ people)
- Private dining room
Say: "Let me get our [manager/catering team] for you!"

SPECIAL SITUATIONS:
Dietary restrictions: "I'll make sure the kitchen knows"
Busy times: Stay efficient but friendly
Fully booked: Offer alternate times or waitlist

TONE:
Warm, inviting, enthusiastic. Sound like you're smiling. Make them excited about their meal!

FOOD LANGUAGE:
Use appetizing words: delicious, fresh, popular, signature, amazing

REMEMBER: Quick acknowledgments as you build the order, full confirmation at the end only.`,

    firstMessage: (businessName) => `Thank you for calling ${businessName}! This call may be recorded. Reservation, takeout, or can I answer menu questions?`,
    
    summaryPrompt: `Summarize this restaurant call in 2-3 sentences:
1. Customer name and phone
2. What they need (reservation, takeout, delivery, catering, or menu question)
3. Key details: For reservations (party size, date, time, special occasion). For orders (items ordered, pickup time). For catering (event date, guest count).

Note any dietary restrictions or special requests.`,

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
      model: 'gpt-4',
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
    endCallMessage: `Thank you for calling ${businessName}. Have a great day!`,
    endCallPhrases: ['goodbye', 'bye', 'thank you bye', 'that\'s all', 'have a good day'],
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