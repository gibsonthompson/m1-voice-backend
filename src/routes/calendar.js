const express = require('express');
const router = express.Router();
const { getAvailableSlots, bookAppointment } = require('../calendar-booking');

// VAPI Tool: Check availability
router.post('/availability/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { message } = req.body;
    
    // Extract date from VAPI tool call
    const toolCall = message?.toolCalls?.[0];
    const args = toolCall?.function?.arguments;
    
    let date;
    if (args) {
      const parsed = typeof args === 'string' ? JSON.parse(args) : args;
      date = parsed.date;
    }
    
    if (!date) {
      return res.json({ 
        results: [{ result: 'What date would you like to check availability for?' }] 
      });
    }

    console.log(`📅 Checking availability for client ${clientId} on ${date}`);
    const result = await getAvailableSlots(clientId, date);
    
    if (!result.success) {
      return res.json({ 
        results: [{ result: result.error }] 
      });
    }

    if (result.slots.length === 0) {
      return res.json({ 
        results: [{ result: `No availability on ${date}. ${result.message || 'Would you like to try another date?'}` }] 
      });
    }

    return res.json({ 
      results: [{ 
        result: `Available times on ${date}: ${result.slots.join(', ')}. Which time works best for you?` 
      }] 
    });

  } catch (error) {
    console.error('Calendar availability error:', error);
    return res.json({ 
      results: [{ result: 'I\'m having trouble checking the calendar. Let me take your information and have someone call you back to schedule.' }] 
    });
  }
});

// VAPI Tool: Book appointment
router.post('/book/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { message } = req.body;
    
    const toolCall = message?.toolCalls?.[0];
    const args = toolCall?.function?.arguments;
    
    if (!args) {
      return res.json({ 
        results: [{ result: 'I need your name, phone number, and preferred date and time to book the appointment.' }] 
      });
    }

    const { 
      customer_name, 
      customer_phone, 
      date, 
      time, 
      service_type, 
      notes 
    } = typeof args === 'string' ? JSON.parse(args) : args;

    if (!customer_name || !customer_phone || !date || !time) {
      const missing = [];
      if (!customer_name) missing.push('your name');
      if (!customer_phone) missing.push('your phone number');
      if (!date) missing.push('the date');
      if (!time) missing.push('the time');
      return res.json({ 
        results: [{ result: `I still need ${missing.join(' and ')} to complete the booking.` }] 
      });
    }

    console.log(`📅 Booking for client ${clientId}: ${customer_name} on ${date} at ${time}`);
    const result = await bookAppointment(
      clientId, 
      customer_name, 
      customer_phone, 
      date, 
      time, 
      service_type, 
      notes
    );

    return res.json({ 
      results: [{ result: result.success ? result.message : result.error }] 
    });

  } catch (error) {
    console.error('Calendar booking error:', error);
    return res.json({ 
      results: [{ result: 'I\'m having trouble with the booking system. I have your information and someone will call you back to confirm the appointment.' }] 
    });
  }
});

module.exports = router;
