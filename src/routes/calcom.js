// ====================================================================
// CAL.COM BOOKING - VAPI Tool Handler Routes
// ====================================================================
// Matches the pattern of routes/calendar.js for Google Calendar
// These endpoints receive VAPI tool calls and return responses
// ====================================================================

const express = require('express');
const router = express.Router();
const { getAvailableSlots, bookAppointment } = require('../integrations/calcom');

// ============================================
// VAPI Tool: Check Cal.com availability
// ============================================
router.post('/availability/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { message } = req.body;
    
    // Extract tool call data from VAPI payload
    const toolCall = message?.toolCallList?.[0] || message?.toolCalls?.[0];
    const toolCallId = toolCall?.id;
    const args = toolCall?.arguments || toolCall?.function?.arguments;
    
    let date;
    if (args) {
      const parsed = typeof args === 'string' ? JSON.parse(args) : args;
      date = parsed.date;
    }
    
    // If no date provided, ask for it
    if (!date) {
      return res.json({ 
        results: [{ toolCallId, result: 'What date would you like to check availability for?' }] 
      });
    }

    console.log(`📅 [Cal.com] Checking availability for client ${clientId} on ${date}`);
    const result = await getAvailableSlots(clientId, date);
    
    // Handle errors
    if (!result.success) {
      return res.json({ 
        results: [{ toolCallId, result: result.error }] 
      });
    }

    // Handle no availability
    if (result.slots.length === 0) {
      return res.json({ 
        results: [{ toolCallId, result: `No availability on ${date}. Would you like to try another date?` }] 
      });
    }

    // Suggest a selection of slots (not all of them for voice UX)
    const slots = result.slots;
    let suggested = [];
    
    if (slots.length <= 4) {
      suggested = slots;
    } else {
      // Pick morning (first), midday (middle), and afternoon (last few)
      suggested.push(slots[0]); // First available (morning)
      suggested.push(slots[Math.floor(slots.length / 2)]); // Midday
      suggested.push(slots[Math.floor(slots.length * 0.75)]); // Afternoon
      if (slots.length > 10) {
        suggested.push(slots[slots.length - 2]); // Late afternoon
      }
    }

    return res.json({ 
      results: [{ 
        toolCallId,
        result: `I have openings at ${suggested.join(', ')}. Which works best for you? I also have other times if none of those work.`
      }] 
    });

  } catch (error) {
    console.error('❌ Cal.com availability error:', error);
    return res.json({ 
      results: [{ result: 'I\'m having trouble checking the calendar. Let me take your information and have someone call you back to schedule.' }] 
    });
  }
});

// ============================================
// VAPI Tool: Book Cal.com appointment
// ============================================
router.post('/book/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { message } = req.body;
    
    // Extract tool call data from VAPI payload
    const toolCall = message?.toolCallList?.[0] || message?.toolCalls?.[0];
    const toolCallId = toolCall?.id;
    const args = toolCall?.arguments || toolCall?.function?.arguments;
    
    // If no arguments, ask for required info
    if (!args) {
      return res.json({ 
        results: [{ toolCallId, result: 'I need your name, phone number, and preferred date and time to book the appointment.' }] 
      });
    }

    const parsed = typeof args === 'string' ? JSON.parse(args) : args;
    const { customer_name, customer_phone, date, time, service_type, notes } = parsed;

    // Validate required fields
    if (!customer_name || !customer_phone || !date || !time) {
      const missing = [];
      if (!customer_name) missing.push('your name');
      if (!customer_phone) missing.push('your phone number');
      if (!date) missing.push('the date');
      if (!time) missing.push('the time');
      return res.json({ 
        results: [{ toolCallId, result: `I still need ${missing.join(' and ')} to complete the booking.` }] 
      });
    }

    console.log(`📅 [Cal.com] Booking for client ${clientId}: ${customer_name} on ${date} at ${time}`);
    const result = await bookAppointment(clientId, customer_name, customer_phone, date, time, service_type, notes);

    return res.json({ 
      results: [{ toolCallId, result: result.success ? result.message : result.error }] 
    });

  } catch (error) {
    console.error('❌ Cal.com booking error:', error);
    return res.json({ 
      results: [{ result: 'I\'m having trouble with the booking system. I have your information and someone will call you back to confirm the appointment.' }] 
    });
  }
});

module.exports = router;