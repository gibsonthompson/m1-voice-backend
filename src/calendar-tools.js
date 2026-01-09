const fetch = require('node-fetch');

async function updateAssistantCalendar(assistantId, clientId, enabled) {
  try {
    console.log(`📅 ${enabled ? 'Enabling' : 'Disabling'} calendar for assistant: ${assistantId}`);
    
    const backendUrl = process.env.BACKEND_URL || 'https://dolphin-app-fohdg.ondigitalocean.app';
    
    // Get current assistant config
    const getResponse = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.VAPI_API_KEY}`
      }
    });

    if (!getResponse.ok) {
      throw new Error(`Failed to get assistant: ${await getResponse.text()}`);
    }

    const assistant = await getResponse.json();
    
    // Get existing toolIds
    let existingToolIds = assistant.model?.toolIds || [];
    
    if (enabled) {
      // Create check_availability tool via VAPI API
      console.log('🔧 Creating check_availability tool...');
      const availabilityToolRes = await fetch('https://api.vapi.ai/tool', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'function',
          function: {
            name: 'check_availability',
            description: 'Check available appointment times for a specific date. Use this when a customer wants to book an appointment.',
            parameters: {
              type: 'object',
              properties: {
                date: { 
                  type: 'string', 
                  description: 'Date to check in YYYY-MM-DD format (e.g., 2026-01-15)' 
                }
              },
              required: ['date']
            }
          },
          server: { 
            url: `${backendUrl}/api/calendar/availability/${clientId}` 
          }
        })
      });

      if (!availabilityToolRes.ok) {
        const errText = await availabilityToolRes.text();
        console.error('❌ Failed to create availability tool:', errText);
        throw new Error(`Failed to create availability tool: ${errText}`);
      }
      
      const availabilityTool = await availabilityToolRes.json();
      console.log(`✅ check_availability tool created: ${availabilityTool.id}`);

      // Create book_appointment tool via VAPI API
      console.log('🔧 Creating book_appointment tool...');
      const bookingToolRes = await fetch('https://api.vapi.ai/tool', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'function',
          function: {
            name: 'book_appointment',
            description: 'Book an appointment after confirming availability and collecting customer details.',
            parameters: {
              type: 'object',
              properties: {
                customer_name: { 
                  type: 'string', 
                  description: 'Full name of the customer' 
                },
                customer_phone: { 
                  type: 'string', 
                  description: 'Customer phone number' 
                },
                date: { 
                  type: 'string', 
                  description: 'Appointment date in YYYY-MM-DD format' 
                },
                time: { 
                  type: 'string', 
                  description: 'Appointment time (e.g., 2:00 PM)' 
                },
                service_type: { 
                  type: 'string', 
                  description: 'Type of service or reason for appointment' 
                },
                notes: { 
                  type: 'string', 
                  description: 'Any special requests or notes' 
                }
              },
              required: ['customer_name', 'customer_phone', 'date', 'time']
            }
          },
          server: { 
            url: `${backendUrl}/api/calendar/book/${clientId}` 
          }
        })
      });

      if (!bookingToolRes.ok) {
        const errText = await bookingToolRes.text();
        console.error('❌ Failed to create booking tool:', errText);
        throw new Error(`Failed to create booking tool: ${errText}`);
      }
      
      const bookingTool = await bookingToolRes.json();
      console.log(`✅ book_appointment tool created: ${bookingTool.id}`);

      // Add new tool IDs to existing ones
      existingToolIds = [...existingToolIds, availabilityTool.id, bookingTool.id];
      
      // Update system prompt with calendar instructions
      let systemPrompt = assistant.model?.messages?.[0]?.content || '';
      const calendarInstructions = `

## APPOINTMENT BOOKING
You can book appointments directly to the business calendar.
1. When a customer wants to book, ask for their preferred date
2. Use check_availability to see available times for that date
3. Tell them the available slots and let them pick
4. Collect: name, phone number, service type
5. Use book_appointment to confirm the booking
6. Confirm the details back to them

If no slots are available, offer alternative dates or take their info for a callback.`;

      if (!systemPrompt.includes('APPOINTMENT BOOKING')) {
        systemPrompt += calendarInstructions;
      }

      // Update assistant with new toolIds
      const updateResponse = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: {
            ...assistant.model,
            toolIds: existingToolIds,
            messages: [{ role: 'system', content: systemPrompt }]
          }
        })
      });

      if (!updateResponse.ok) {
        throw new Error(`Failed to update assistant: ${await updateResponse.text()}`);
      }

      console.log(`✅ Calendar enabled for assistant: ${assistantId}`);
      console.log(`   Tools: ${availabilityTool.id}, ${bookingTool.id}`);
      return true;

    } else {
      // Disabling - remove calendar instructions from prompt
      let systemPrompt = assistant.model?.messages?.[0]?.content || '';
      const calendarInstructions = `

## APPOINTMENT BOOKING
You can book appointments directly to the business calendar.
1. When a customer wants to book, ask for their preferred date
2. Use check_availability to see available times for that date
3. Tell them the available slots and let them pick
4. Collect: name, phone number, service type
5. Use book_appointment to confirm the booking
6. Confirm the details back to them

If no slots are available, offer alternative dates or take their info for a callback.`;

      systemPrompt = systemPrompt.replace(calendarInstructions, '');

      const updateResponse = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: {
            ...assistant.model,
            messages: [{ role: 'system', content: systemPrompt }]
          }
        })
      });

      if (!updateResponse.ok) {
        throw new Error(`Failed to update assistant: ${await updateResponse.text()}`);
      }

      console.log(`✅ Calendar disabled for assistant: ${assistantId}`);
      return true;
    }
  } catch (error) {
    console.error('❌ Error updating assistant calendar:', error);
    return false;
  }
}

module.exports = { updateAssistantCalendar };
