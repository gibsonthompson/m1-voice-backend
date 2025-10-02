const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Industry-specific service keywords
const INDUSTRY_KEYWORDS = {
  'plumbing': {
    'Emergency Plumbing': ['emergency', 'burst', 'flooding', 'leak', 'urgent'],
    'Drain Services': ['drain', 'clog', 'backed up', 'slow drain'],
    'Water Heater': ['water heater', 'hot water', 'no hot water'],
    'Installation': ['install', 'replace', 'new fixture'],
    'Repair': ['repair', 'fix', 'broken'],
    'Estimate': ['estimate', 'quote', 'consultation', 'free estimate']
  },
  'dental': {
    'Emergency': ['emergency', 'pain', 'toothache', 'broken tooth', 'urgent'],
    'Cleaning': ['cleaning', 'hygiene', 'checkup', 'exam'],
    'Cosmetic': ['whitening', 'veneers', 'cosmetic', 'smile'],
    'Restoration': ['filling', 'crown', 'implant', 'root canal'],
    'Consultation': ['consultation', 'estimate', 'quote', 'appointment']
  },
  'hvac': {
    'Emergency': ['emergency', 'no heat', 'no cooling', 'urgent'],
    'AC Service': ['ac', 'air conditioning', 'cooling', 'cold'],
    'Heating': ['heat', 'furnace', 'heater', 'warm'],
    'Installation': ['install', 'new unit', 'replace'],
    'Maintenance': ['maintenance', 'tune up', 'service', 'checkup'],
    'Repair': ['repair', 'fix', 'broken', 'not working']
  },
  'electrical': {
    'Emergency': ['emergency', 'sparking', 'fire', 'urgent', 'no power'],
    'Outlet/Switch': ['outlet', 'switch', 'plug', 'receptacle'],
    'Lighting': ['light', 'fixture', 'chandelier', 'lamp'],
    'Panel/Breaker': ['panel', 'breaker', 'circuit'],
    'Installation': ['install', 'new', 'add'],
    'Repair': ['repair', 'fix', 'not working']
  },
  'legal': {
    'Consultation': ['consultation', 'advice', 'discuss', 'meeting'],
    'Family Law': ['divorce', 'custody', 'family', 'separation'],
    'Criminal': ['criminal', 'charges', 'arrest', 'defense'],
    'Business': ['business', 'contract', 'llc', 'incorporation'],
    'Personal Injury': ['injury', 'accident', 'hurt', 'lawsuit']
  },
  'general': {
    'Service Request': ['help', 'service', 'need', 'request'],
    'Estimate': ['estimate', 'quote', 'price', 'cost'],
    'Appointment': ['appointment', 'schedule', 'book', 'meeting'],
    'Emergency': ['emergency', 'urgent', 'asap']
  }
};

async function getPhoneNumberFromVapi(phoneNumberId) {
  try {
    const response = await axios.get(
      `https://api.vapi.ai/phone-number/${phoneNumberId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.VAPI_API_KEY}`
        }
      }
    );
    return response.data.number;
  } catch (error) {
    console.error('Error fetching phone number:', error.message);
    return null;
  }
}

// REGEX EXTRACTION FUNCTIONS
function extractCustomerName(transcript) {
  const patterns = [
    /(?:my name is|name is|i'm|i am|this is|call me)\s+([a-z\s]{3,50})(?:\.|,|$|user:|ai:|and|with|\d)/i,
    /(?:^|\n)user:?\s*([a-z]+\s+[a-z]+)(?:\s|\.|\n)/i,
    /([a-z]+\s+[a-z]+)\s+\d+\s+at\s+gmail/i,
  ];
  
  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      if (name.length < 3 || name.length > 50) continue;
      const lowerName = name.toLowerCase();
      if (['hello', 'thanks', 'thank you', 'sorry', 'alright', 'perfect'].includes(lowerName)) continue;
      
      return name.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
  }
  
  return null;
}

function extractEmail(transcript) {
  const patterns = [
    /([a-z0-9._-]+\s*@\s*[a-z0-9.-]+\.[a-z]{2,})/i,
    /([a-z0-9._-]+)\s+at\s+([a-z0-9.-]+)\s+dot\s+([a-z]{2,})/i,
  ];
  
  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (match) {
      if (pattern.source.includes('at')) {
        // Spoken format: "name at domain dot com"
        return `${match[1].replace(/\s/g, '')}@${match[2].replace(/\s/g, '')}.${match[3]}`;
      } else {
        // Standard format
        return match[1].replace(/\s/g, '');
      }
    }
  }
  
  return null;
}

function extractPhoneNumber(transcript) {
  const patterns = [
    /(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/,
    /(\d\s+\d\s+\d\s+\d\s+\d\s+\d\s+\d\s+\d\s+\d\s+\d)/,
    /(\d{3})\D*(\d{3})\D*(\d{4})/,
  ];
  
  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (match) {
      const cleaned = match[0].replace(/\s+/g, '').replace(/[^\d]/g, '');
      if (cleaned.length === 10) {
        return `+1${cleaned}`;
      }
    }
  }
  
  return null;
}

function extractAddress(transcript) {
  const patterns = [
    /(\d+\s+[a-z0-9\s]+(?:street|st|avenue|ave|road|rd|lane|ln|drive|dr|court|ct|circle|cir|way))/i,
    /address\s+is\s+([^\n.]+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return null;
}

function extractServiceRequested(transcript, industry) {
  const text = transcript.toLowerCase();
  const keywords = INDUSTRY_KEYWORDS[industry] || INDUSTRY_KEYWORDS['general'];
  
  const services = [];
  for (const [service, terms] of Object.entries(keywords)) {
    if (terms.some(term => text.includes(term))) {
      services.push(service);
    }
  }
  
  return services.slice(0, 2).join(', ') || null;
}

function extractUrgencyLevel(transcript) {
  const text = transcript.toLowerCase();
  const urgentKeywords = [
    'emergency', 'urgent', 'asap', 'immediately', 'right now',
    'flooding', 'burst', 'sparking', 'fire', 'no power', 'no heat',
    'severe pain', 'can\'t wait'
  ];
  
  return urgentKeywords.some(keyword => text.includes(keyword)) ? 'high' : 'normal';
}

function extractAppointmentInfo(transcript) {
  const text = transcript.toLowerCase();
  
  const appointmentKeywords = ['appointment', 'schedule', 'book'];
  const hasAppointment = appointmentKeywords.some(keyword => text.includes(keyword));
  
  if (!hasAppointment) {
    return { booked: false, time: null };
  }
  
  const timePatterns = [
    /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)[,\s]+[^.\n]+/i,
    /(tomorrow|today|next week)[,\s]+[^.\n]+/i,
    /(\d{1,2}\s*(?:am|pm))/i
  ];
  
  let appointmentTime = null;
  for (const pattern of timePatterns) {
    const match = transcript.match(pattern);
    if (match) {
      appointmentTime = match[0].trim();
      break;
    }
  }
  
  return {
    booked: true,
    time: appointmentTime
  };
}

// AI EXTRACTION FALLBACK
async function extractWithAI(transcript) {
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a data extraction assistant. Extract information from call transcripts and return ONLY valid JSON. If a field cannot be found, use null.'
          },
          {
            role: 'user',
            content: `Extract the following information from this call transcript and return ONLY a JSON object:

{
  "customer_name": "full name of the caller",
  "customer_email": "email address",
  "customer_phone": "phone number in format +1XXXXXXXXXX",
  "customer_address": "street address if mentioned"
}

Transcript:
${transcript}

Remember: Return ONLY the JSON object, no other text.`
          }
        ],
        temperature: 0.1,
        max_tokens: 200
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const aiResponse = response.data.choices[0].message.content.trim();
    // Remove markdown code blocks if present
    const jsonString = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const extracted = JSON.parse(jsonString);
    
    return extracted;
  } catch (error) {
    console.error('AI extraction error:', error.message);
    return null;
  }
}

async function getOrCreateGHLContact(phone, name) {
  try {
    const searchResponse = await axios.get(
      `https://services.leadconnectorhq.com/contacts/search/duplicate?locationId=${process.env.GHL_LOCATION_ID}&number=${encodeURIComponent(phone)}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
          'Version': '2021-07-28'
        }
      }
    );

    if (searchResponse.data.contact) {
      return searchResponse.data.contact.id;
    }

    const createResponse = await axios.post(
      'https://services.leadconnectorhq.com/contacts/',
      {
        locationId: process.env.GHL_LOCATION_ID,
        phoneNumber: phone,
        name: name || 'Business Owner'
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        }
      }
    );

    return createResponse.data.contact.id;
  } catch (error) {
    console.error('GHL contact error:', error.response?.data || error.message);
    return null;
  }
}

async function sendGHLSMS(contactId, message) {
  try {
    await axios.post(
      'https://services.leadconnectorhq.com/conversations/messages',
      {
        type: 'SMS',
        contactId: contactId,
        message: message
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        }
      }
    );
    return true;
  } catch (error) {
    console.error('GHL SMS error:', error.response?.data || error.message);
    return false;
  }
}

async function handleVapiWebhook(req, res) {
  try {
    const message = req.body.message;
    
    if (message?.type === 'end-of-call-report') {
      const call = message.call;
      const phoneNumberId = call.phoneNumberId;
      
      const phoneNumber = await getPhoneNumberFromVapi(phoneNumberId);

      if (!phoneNumber) {
        return res.status(200).json({ received: true });
      }

      const { data: client } = await supabase
        .from('clients')
        .select('*')
        .eq('phone_number', phoneNumber)
        .single();

      if (!client) {
        console.log('No client found for phone:', phoneNumber);
        return res.status(200).json({ received: true });
      }

      const transcript = message.transcript || '';
      const callerPhone = call.customer?.number || 'unknown';
      
      // STEP 1: Try regex extraction first
      let customerName = extractCustomerName(transcript);
      let customerEmail = extractEmail(transcript);
      let customerPhone = extractPhoneNumber(transcript) || callerPhone;
      let customerAddress = extractAddress(transcript);
      let extractionMethod = 'regex';
      
      // STEP 2: If critical fields are missing, use AI fallback
      if (!customerName || !customerPhone || !customerEmail) {
        console.log('⚠️ Regex extraction incomplete, trying AI...');
        const aiExtracted = await extractWithAI(transcript);
        
        if (aiExtracted) {
          customerName = customerName || aiExtracted.customer_name;
          customerEmail = customerEmail || aiExtracted.customer_email;
          customerPhone = customerPhone || aiExtracted.customer_phone;
          customerAddress = customerAddress || aiExtracted.customer_address;
          extractionMethod = 'ai';
          console.log('✅ AI extraction completed');
        }
      }
      
      // STEP 3: Extract service, urgency, and appointment (regex only)
      const serviceRequested = extractServiceRequested(transcript, client.industry || 'general');
      const urgencyLevel = extractUrgencyLevel(transcript);
      const appointmentInfo = extractAppointmentInfo(transcript);
      
      const duration = call.endedAt && call.startedAt 
        ? Math.round((new Date(call.endedAt) - new Date(call.startedAt)) / 1000) 
        : 0;
      
      const callRecord = {
        client_id: client.id,
        conversation_id: call.id,
        caller_phone: callerPhone,
        duration_seconds: duration,
        started_at: call.startedAt || new Date().toISOString(),
        ended_at: call.endedAt || new Date().toISOString(),
        transcript: transcript,
        call_status: 'completed',
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        customer_address: customerAddress,
        service_requested: serviceRequested,
        urgency_level: urgencyLevel,
        appointment_booked: appointmentInfo.booked,
        appointment_time: appointmentInfo.time ? String(appointmentInfo.time) : null,
        extraction_method: extractionMethod
      };

      const { error: insertError } = await supabase.from('calls').insert([callRecord]);
      
      if (insertError) {
        console.error('Error inserting call:', insertError);
        return res.status(500).json({ error: 'Failed to save call' });
      }
      
      console.log('✅ Call saved:', {
        client: client.business_name,
        industry: client.industry,
        extraction: extractionMethod,
        name: customerName,
        email: customerEmail,
        service: serviceRequested,
        urgency: urgencyLevel
      });

      if (client.owner_phone) {
        const contactId = await getOrCreateGHLContact(
          client.owner_phone, 
          client.owner_name || client.business_name
        );
        
        if (contactId) {
          const urgencyFlag = urgencyLevel === 'high' ? '🚨 URGENT ' : '';
          const smsMessage = `${urgencyFlag}New call for ${client.business_name}\n\n` +
            `Caller: ${customerName || 'Unknown'}\n` +
            `Phone: ${customerPhone}\n` +
            (customerEmail ? `Email: ${customerEmail}\n` : '') +
            `Service: ${serviceRequested || 'Not specified'}\n` +
            `Duration: ${duration}s\n` +
            (appointmentInfo.booked ? `Appointment: ${appointmentInfo.time}\n` : '') +
            `\nTranscript: ${transcript.substring(0, 150)}...`;
          
          const smsSent = await sendGHLSMS(contactId, smsMessage);
          
          if (smsSent) {
            console.log('✅ SMS notification sent');
          }
        }
      }

      return res.status(200).json({ received: true });
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: error.message });
  }
}

module.exports = { handleVapiWebhook };
