const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

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

// NEW: Extract customer name from transcript
function extractCustomerName(transcript) {
  const text = transcript.toLowerCase();
  
  // Look for common name patterns
  const patterns = [
    /my name is ([a-z\s]+?)(?:\.|,|$|user:|ai:)/i,
    /this is ([a-z\s]+?)(?:\.|,|$|user:|ai:)/i,
    /i'm ([a-z\s]+?)(?:\.|,|$|user:|ai:)/i,
    /([a-z]+\s+[a-z]+)\s+\d+\s+at\s+gmail/i, // Name before email
  ];
  
  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      // Capitalize first letter of each word
      return name.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
  }
  
  return null;
}

// NEW: Extract phone number from transcript
function extractPhoneNumber(transcript) {
  // Look for phone patterns (including spoken digit by digit)
  const patterns = [
    /(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/,  // Standard format
    /(\d\s+\d\s+\d\s+\d\s+\d\s+\d\s+\d\s+\d\s+\d\s+\d)/,  // Digit by digit
  ];
  
  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (match) {
      // Clean up the number
      return match[1].replace(/\s+/g, '').replace(/[^\d]/g, '');
    }
  }
  
  return null;
}

// NEW: Extract service requested from transcript
function extractServiceRequested(transcript) {
  const text = transcript.toLowerCase();
  
  // Service keywords
  const serviceKeywords = {
    'Plumbing': ['plumb', 'pipe', 'leak', 'drain', 'water', 'faucet', 'toilet', 'sink'],
    'Electrical': ['electric', 'outlet', 'wire', 'power', 'breaker', 'light'],
    'HVAC': ['hvac', 'ac', 'air condition', 'heat', 'furnace', 'cooling', 'heating'],
    'General Repair': ['repair', 'fix', 'broken', 'maintenance'],
    'Emergency Service': ['emergency', 'urgent', 'asap', 'flooding'],
    'Estimate/Consultation': ['estimate', 'quote', 'consultation', 'appointment', 'schedule']
  };
  
  const services = [];
  for (const [service, keywords] of Object.entries(serviceKeywords)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      services.push(service);
    }
  }
  
  return services.length > 0 ? services.join(', ') : null;
}

// NEW: Determine urgency level
function extractUrgencyLevel(transcript) {
  const text = transcript.toLowerCase();
  const urgentKeywords = ['emergency', 'urgent', 'asap', 'immediately', 'flooding', 'burst', 'leak'];
  
  return urgentKeywords.some(keyword => text.includes(keyword)) ? 'high' : 'normal';
}

// NEW: Extract appointment information
function extractAppointmentInfo(transcript) {
  const text = transcript.toLowerCase();
  
  // Check if appointment was discussed
  const appointmentKeywords = ['appointment', 'schedule', 'book', 'friday', 'monday', 'tuesday'];
  const hasAppointment = appointmentKeywords.some(keyword => text.includes(keyword));
  
  if (!hasAppointment) {
    return { booked: false, time: null };
  }
  
  // Try to extract time/date
  const timePattern = /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)[,\s]+([^.]+)/i;
  const match = transcript.match(timePattern);
  
  return {
    booked: true,
    time: match ? match[0].trim() : null
  };
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
        console.log('No client found');
        return res.status(200).json({ received: true });
      }

      const transcript = message.transcript || '';
      const callerPhone = call.customer?.number || 'unknown';
      
      // ENHANCED: Extract all information from transcript
      const customerName = extractCustomerName(transcript);
      const customerPhone = extractPhoneNumber(transcript) || callerPhone;
      const serviceRequested = extractServiceRequested(transcript);
      const urgencyLevel = extractUrgencyLevel(transcript);
      const appointmentInfo = extractAppointmentInfo(transcript);
      
      // Calculate duration
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
        // NEW: Add extracted fields
        customer_name: customerName,
        customer_phone: customerPhone,
        service_requested: serviceRequested,
        urgency_level: urgencyLevel,
        appointment_booked: appointmentInfo.booked,
        appointment_time: appointmentInfo.time
      };

      await supabase.from('calls').insert([callRecord]);
      console.log('✅ Call saved with extracted data:', {
        name: customerName,
        service: serviceRequested,
        urgency: urgencyLevel
      });

      if (client.owner_phone) {
        const contactId = await getOrCreateGHLContact(client.owner_phone, client.owner_name || client.business_name);
        
        if (contactId) {
          // Enhanced SMS message with extracted data
          const smsMessage = `New ${urgencyLevel === 'high' ? '🚨 URGENT' : ''} call for ${client.business_name}\n\nCaller: ${customerName || 'Unknown'}\nPhone: ${customerPhone}\nService: ${serviceRequested || 'Not specified'}\nDuration: ${duration}s\n${appointmentInfo.booked ? `Appointment: ${appointmentInfo.time}\n` : ''}\nTranscript: ${transcript.substring(0, 150)}...`;
          
          const smsSent = await sendGHLSMS(contactId, smsMessage);
          
          if (smsSent) {
            console.log('✅ SMS sent via GHL');
          }
        }
      }

      return res.status(200).json({ received: true });
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

module.exports = { handleVapiWebhook };
