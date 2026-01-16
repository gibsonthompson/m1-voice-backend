// ====================================================================
// CAL.COM TOOLS - VAPI Assistant Integration
// ====================================================================
// Matches the pattern of calendar-tools.js for Google Calendar
// Creates/removes Cal.com booking tools from VAPI assistants
// ====================================================================

const fetch = require('node-fetch');

// ============================================
// UPDATE ASSISTANT WITH CAL.COM TOOLS
// ============================================
async function updateAssistantCalcom(assistantId, clientId, enabled) {
  try {
    console.log(`📅 ${enabled ? 'Enabling' : 'Disabling'} Cal.com for assistant: ${assistantId}`);
    
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
    
    // Get existing toolIds - preserve non-Cal.com tools
    let existingToolIds = assistant.model?.toolIds || [];
    
    // Preserve existing inline tools (like transferCall)
    const existingInlineTools = assistant.model?.tools || [];
    console.log(`📋 Existing toolIds: ${existingToolIds.length}, inline tools: ${existingInlineTools.length}`);
    
    if (enabled) {
      // Check if Cal.com tools already exist to avoid duplicates
      const toolsListRes = await fetch('https://api.vapi.ai/tool', {
        headers: { 'Authorization': `Bearer ${process.env.VAPI_API_KEY}` }
      });
      const allTools = await toolsListRes.json();
      
      // Find existing Cal.com tools for this client
      const existingAvailabilityTool = allTools.find(t => 
        t.function?.name === 'check_calcom_availability' && 
        t.server?.url?.includes(clientId)
      );
      const existingBookingTool = allTools.find(t => 
        t.function?.name === 'book_calcom_appointment' && 
        t.server?.url?.includes(clientId)
      );
      
      let availabilityToolId, bookingToolId;
      
      // Create or reuse check_calcom_availability tool
      if (existingAvailabilityTool) {
        console.log(`📋 Using existing check_calcom_availability tool: ${existingAvailabilityTool.id}`);
        availabilityToolId = existingAvailabilityTool.id;
      } else {
        console.log('🔧 Creating check_calcom_availability tool...');
        const availabilityToolRes = await fetch('https://api.vapi.ai/tool', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: 'function',
            function: {
              name: 'check_calcom_availability',
              description: 'Check available appointment times for a specific date using Cal.com. Use this when a customer wants to book an appointment.',
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
              url: `${backendUrl}/api/calcom/availability/${clientId}` 
            }
          })
        });

        if (!availabilityToolRes.ok) {
          throw new Error(`Failed to create Cal.com availability tool: ${await availabilityToolRes.text()}`);
        }
        const availabilityTool = await availabilityToolRes.json();
        availabilityToolId = availabilityTool.id;
        console.log(`✅ check_calcom_availability tool created: ${availabilityToolId}`);
      }

      // Create or reuse book_calcom_appointment tool
      if (existingBookingTool) {
        console.log(`📋 Using existing book_calcom_appointment tool: ${existingBookingTool.id}`);
        bookingToolId = existingBookingTool.id;
      } else {
        console.log('🔧 Creating book_calcom_appointment tool...');
        const bookingToolRes = await fetch('https://api.vapi.ai/tool', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: 'function',
            function: {
              name: 'book_calcom_appointment',
              description: 'Book an appointment via Cal.com after confirming availability and collecting customer details.',
              parameters: {
                type: 'object',
                properties: {
                  customer_name: { type: 'string', description: 'Full name of the customer' },
                  customer_phone: { type: 'string', description: 'Customer phone number' },
                  date: { type: 'string', description: 'Appointment date in YYYY-MM-DD format' },
                  time: { type: 'string', description: 'Appointment time (e.g., 2:00 PM)' },
                  service_type: { type: 'string', description: 'Type of service or reason for appointment' },
                  notes: { type: 'string', description: 'Any special requests or notes' }
                },
                required: ['customer_name', 'customer_phone', 'date', 'time']
              }
            },
            server: { 
              url: `${backendUrl}/api/calcom/book/${clientId}` 
            }
          })
        });

        if (!bookingToolRes.ok) {
          throw new Error(`Failed to create Cal.com booking tool: ${await bookingToolRes.text()}`);
        }
        const bookingTool = await bookingToolRes.json();
        bookingToolId = bookingTool.id;
        console.log(`✅ book_calcom_appointment tool created: ${bookingToolId}`);
      }

      // Build new toolIds - remove any old Cal.com tools, add new ones
      const calcomToolIds = [availabilityToolId, bookingToolId];
      const filteredToolIds = existingToolIds.filter(id => 
        !allTools.some(t => 
          t.id === id && 
          (t.function?.name === 'check_calcom_availability' || t.function?.name === 'book_calcom_appointment')
        )
      );
      const newToolIds = [...new Set([...filteredToolIds, ...calcomToolIds])];
      
      console.log(`📋 Final toolIds: ${newToolIds.length}`);
      
      // Update system prompt with Cal.com booking instructions
      let systemPrompt = assistant.model?.messages?.[0]?.content || '';
      const calcomInstructions = `

## APPOINTMENT BOOKING (CAL.COM)
You can book appointments directly to the business calendar via Cal.com.
1. When a customer wants to book, ask for their preferred date
2. Use check_calcom_availability to see available times for that date
3. Suggest a few good times rather than listing all available slots
4. Collect: name, phone number, service type
5. Use book_calcom_appointment to confirm the booking
6. Confirm the details back to them

If no slots are available, offer alternative dates or take their info for a callback.`;

      if (!systemPrompt.includes('APPOINTMENT BOOKING (CAL.COM)')) {
        systemPrompt += calcomInstructions;
      }

      // Build update payload - preserve inline tools
      const updatePayload = {
        model: {
          provider: assistant.model?.provider || 'openai',
          model: assistant.model?.model || 'gpt-4o-mini',
          temperature: assistant.model?.temperature,
          toolIds: newToolIds,
          tools: existingInlineTools,
          messages: [{ role: 'system', content: systemPrompt }]
        }
      };

      const updateResponse = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatePayload)
      });

      if (!updateResponse.ok) {
        throw new Error(`Failed to update assistant: ${await updateResponse.text()}`);
      }

      console.log(`✅ Cal.com enabled for assistant: ${assistantId}`);
      console.log(`   Tools: ${availabilityToolId}, ${bookingToolId}`);
      return { success: true, toolIds: [availabilityToolId, bookingToolId] };

    } else {
      // Disabling - remove Cal.com instructions from system prompt
      let systemPrompt = assistant.model?.messages?.[0]?.content || '';
      const calcomInstructions = `

## APPOINTMENT BOOKING (CAL.COM)
You can book appointments directly to the business calendar via Cal.com.
1. When a customer wants to book, ask for their preferred date
2. Use check_calcom_availability to see available times for that date
3. Suggest a few good times rather than listing all available slots
4. Collect: name, phone number, service type
5. Use book_calcom_appointment to confirm the booking
6. Confirm the details back to them

If no slots are available, offer alternative dates or take their info for a callback.`;

      systemPrompt = systemPrompt.replace(calcomInstructions, '');

      // Remove Cal.com tool IDs from assistant
      const toolsListRes = await fetch('https://api.vapi.ai/tool', {
        headers: { 'Authorization': `Bearer ${process.env.VAPI_API_KEY}` }
      });
      const allTools = await toolsListRes.json();
      
      const filteredToolIds = existingToolIds.filter(id => 
        !allTools.some(t => 
          t.id === id && 
          (t.function?.name === 'check_calcom_availability' || t.function?.name === 'book_calcom_appointment')
        )
      );

      const updateResponse = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: {
            provider: assistant.model?.provider || 'openai',
            model: assistant.model?.model || 'gpt-4o-mini',
            toolIds: filteredToolIds.length > 0 ? filteredToolIds : undefined,
            tools: existingInlineTools,
            messages: [{ role: 'system', content: systemPrompt }]
          }
        })
      });

      if (!updateResponse.ok) {
        throw new Error(`Failed to update assistant: ${await updateResponse.text()}`);
      }

      console.log(`✅ Cal.com disabled for assistant: ${assistantId}`);
      return { success: true };
    }
  } catch (error) {
    console.error('❌ Error updating assistant Cal.com tools:', error);
    return { success: false, error: error.message };
  }
}

module.exports = { updateAssistantCalcom };