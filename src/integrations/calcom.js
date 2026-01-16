// ====================================================================
// CAL.COM BOOKING - API Integration
// ====================================================================
// Matches the pattern of calendar-booking.js for Google Calendar
// Docs: https://cal.com/docs/api-reference/v1
// ====================================================================

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const CALCOM_BASE_URL = process.env.CALCOM_BASE_URL || 'https://api.cal.com/v1';

// ============================================
// HELPER: Make authenticated Cal.com API request
// ============================================
async function calcomRequest(endpoint, apiKey, options = {}) {
  const url = `${CALCOM_BASE_URL}${endpoint}`;
  const separator = endpoint.includes('?') ? '&' : '?';
  const fullUrl = `${url}${separator}apiKey=${apiKey}`;

  const response = await fetch(fullUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Cal.com API error (${response.status}):`, errorText);
    throw new Error(`Cal.com API failed: ${response.status}`);
  }

  return response.json();
}

// ============================================
// GET EVENT TYPES - For initial setup
// ============================================
async function getEventTypes(apiKey) {
  try {
    console.log('📅 Fetching Cal.com event types...');
    const data = await calcomRequest('/event-types', apiKey);
    
    // Return simplified list for client selection
    const eventTypes = (data.event_types || []).map(et => ({
      id: et.id,
      title: et.title,
      slug: et.slug,
      length: et.length, // duration in minutes
      description: et.description
    }));

    console.log(`✅ Found ${eventTypes.length} event types`);
    return { success: true, eventTypes };
  } catch (error) {
    console.error('❌ Failed to get event types:', error.message);
    return { success: false, error: error.message };
  }
}

// ============================================
// GET AVAILABLE SLOTS - For VAPI tool
// ============================================
async function getAvailableSlots(clientId, date) {
  try {
    console.log(`📅 Checking Cal.com availability for client ${clientId} on ${date}`);

    // Get client with Cal.com credentials
    const { data: client, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (error || !client) {
      console.error('❌ Client not found:', clientId);
      return { success: false, error: 'Client not found' };
    }

    if (!client.calcom_connected || !client.calcom_api_key) {
      console.log('⚠️ Cal.com not connected for client:', clientId);
      return { success: false, error: 'Cal.com calendar not connected' };
    }

    if (!client.calcom_event_type_id) {
      console.log('⚠️ No event type configured for client:', clientId);
      return { success: false, error: 'No appointment type configured' };
    }

    // Get the event type details first (for username/slug)
    const eventTypeData = await calcomRequest(
      `/event-types/${client.calcom_event_type_id}`,
      client.calcom_api_key
    );

    const eventType = eventTypeData.event_type;
    if (!eventType) {
      return { success: false, error: 'Event type not found' };
    }

    // Cal.com availability endpoint requires date range
    // We'll check the specific date requested
    const startTime = `${date}T00:00:00.000Z`;
    const endTime = `${date}T23:59:59.999Z`;

    // Get user info for the username
    const userData = await calcomRequest('/me', client.calcom_api_key);
    const username = userData.user?.username;

    if (!username) {
      return { success: false, error: 'Could not determine Cal.com username' };
    }

    // Get availability slots
    // Endpoint: /slots?startTime=...&endTime=...&eventTypeId=...&username=...
    const slotsData = await calcomRequest(
      `/slots?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}&eventTypeId=${client.calcom_event_type_id}&username=${username}`,
      client.calcom_api_key
    );

    // Cal.com returns slots grouped by date
    const slotsForDate = slotsData.slots?.[date] || [];
    
    // Format slots for voice (e.g., "9 AM", "2:30 PM")
    const formattedSlots = slotsForDate.map(slot => {
      const slotTime = new Date(slot.time);
      const hours = slotTime.getHours();
      const minutes = slotTime.getMinutes();
      const hour12 = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const minStr = minutes === 0 ? '' : `:${minutes.toString().padStart(2, '0')}`;
      return `${hour12}${minStr} ${ampm}`;
    });

    console.log(`✅ Found ${formattedSlots.length} available slots for ${date}`);
    
    return {
      success: true,
      slots: formattedSlots,
      date,
      eventType: eventType.title
    };

  } catch (error) {
    console.error('❌ Cal.com availability error:', error.message);
    return { success: false, error: 'Failed to check availability' };
  }
}

// ============================================
// BOOK APPOINTMENT - For VAPI tool
// ============================================
async function bookAppointment(clientId, customerName, customerPhone, date, time, serviceType, notes) {
  try {
    console.log('📅 Booking Cal.com appointment:', { clientId, customerName, date, time });

    // Get client with Cal.com credentials
    const { data: client, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (error || !client) {
      return { success: false, error: 'Client not found' };
    }

    if (!client.calcom_connected || !client.calcom_api_key) {
      return { success: false, error: 'Cal.com not connected - appointment request noted for callback' };
    }

    if (!client.calcom_event_type_id) {
      return { success: false, error: 'No appointment type configured' };
    }

    // Parse time to 24hr format
    const time24 = parseTimeTo24Hr(time);
    if (!time24) {
      console.error('Failed to parse time:', time);
      return { success: false, error: 'Invalid time format' };
    }

    console.log(`📅 Parsed time: "${time}" -> "${time24}"`);

    // Get event type for duration
    const eventTypeData = await calcomRequest(
      `/event-types/${client.calcom_event_type_id}`,
      client.calcom_api_key
    );
    const eventType = eventTypeData.event_type;
    const duration = eventType?.length || 30;

    // Get user info
    const userData = await calcomRequest('/me', client.calcom_api_key);
    const username = userData.user?.username;

    if (!username) {
      return { success: false, error: 'Could not determine Cal.com username' };
    }

    // Build start time in ISO format
    const timezone = client.timezone || 'America/New_York';
    const startDateTime = `${date}T${time24}:00`;

    // Calculate end time
    const [hr, min] = time24.split(':').map(Number);
    const totalMinutes = hr * 60 + min + duration;
    const endHr = Math.floor(totalMinutes / 60);
    const endMin = totalMinutes % 60;
    const endDateTime = `${date}T${endHr.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}:00`;

    console.log(`📅 Booking: ${startDateTime} to ${endDateTime} (${timezone})`);

    // Split customer name into first/last
    const nameParts = customerName.trim().split(/\s+/);
    const firstName = nameParts[0] || customerName;
    const lastName = nameParts.slice(1).join(' ') || '';

    // Create booking via Cal.com API
    // POST /bookings
    const bookingPayload = {
      eventTypeId: parseInt(client.calcom_event_type_id),
      start: startDateTime,
      end: endDateTime,
      responses: {
        name: customerName,
        email: `${customerPhone.replace(/\D/g, '')}@phone.callbirdai.com`, // Cal.com requires email
        phone: customerPhone,
        notes: notes || `Service: ${serviceType || 'General'}\nBooked via CallBird AI`
      },
      timeZone: timezone,
      language: 'en',
      metadata: {
        source: 'callbird_ai',
        customerPhone: customerPhone,
        serviceType: serviceType,
        notes: notes
      }
    };

    const bookingResult = await calcomRequest('/bookings', client.calcom_api_key, {
      method: 'POST',
      body: JSON.stringify(bookingPayload)
    });

    if (!bookingResult.booking) {
      console.error('❌ Cal.com booking failed:', bookingResult);
      return { success: false, error: 'Failed to create appointment' };
    }

    const booking = bookingResult.booking;
    console.log('✅ Cal.com appointment booked:', booking.id || booking.uid);

    // Save to our database
    await supabase.from('appointments').insert({
      client_id: clientId,
      calcom_booking_id: booking.id || booking.uid,
      customer_name: customerName,
      customer_phone: customerPhone,
      appointment_time: new Date(startDateTime).toISOString(),
      duration,
      service_type: serviceType || eventType?.title,
      notes,
      status: 'confirmed',
      booking_source: 'calcom'
    });

    // Format confirmation nicely
    const dateObj = new Date(date + 'T12:00:00');
    const formattedDate = dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });

    // Format time for confirmation
    const hr12 = hr > 12 ? hr - 12 : (hr === 0 ? 12 : hr);
    const ampm = hr >= 12 ? 'PM' : 'AM';
    const formattedTime = min === 0 ? `${hr12} ${ampm}` : `${hr12}:${min.toString().padStart(2, '0')} ${ampm}`;

    return {
      success: true,
      message: `Appointment confirmed for ${customerName} on ${formattedDate} at ${formattedTime}`,
      appointment: {
        date: formattedDate,
        time: formattedTime,
        service: serviceType || eventType?.title
      }
    };

  } catch (error) {
    console.error('❌ Cal.com booking error:', error.message);
    return { success: false, error: 'Server error while booking' };
  }
}

// ============================================
// HELPER: Parse time string to 24hr format
// ============================================
function parseTimeTo24Hr(timeStr) {
  const normalized = timeStr.trim().toLowerCase();
  
  // Already 24hr format
  if (/^\d{1,2}:\d{2}$/.test(normalized) && !normalized.includes('m')) {
    return normalized.padStart(5, '0');
  }
  
  const match = normalized.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!match) return null;
  
  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const period = match[3]?.toLowerCase();
  
  if (period === 'pm' && hours !== 12) hours += 12;
  if (period === 'am' && hours === 12) hours = 0;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

// ============================================
// VERIFY API KEY - For connection setup
// ============================================
async function verifyApiKey(apiKey) {
  try {
    console.log('🔑 Verifying Cal.com API key...');
    const userData = await calcomRequest('/me', apiKey);
    
    if (userData.user) {
      console.log('✅ Cal.com API key valid for:', userData.user.username);
      return {
        success: true,
        user: {
          id: userData.user.id,
          username: userData.user.username,
          email: userData.user.email,
          name: userData.user.name
        }
      };
    }
    
    return { success: false, error: 'Invalid API key' };
  } catch (error) {
    console.error('❌ Cal.com API key verification failed:', error.message);
    return { success: false, error: 'Invalid or expired API key' };
  }
}

// ============================================
// CANCEL BOOKING - Optional utility
// ============================================
async function cancelBooking(clientId, bookingId, reason) {
  try {
    const { data: client, error } = await supabase
      .from('clients')
      .select('calcom_api_key')
      .eq('id', clientId)
      .single();

    if (error || !client?.calcom_api_key) {
      return { success: false, error: 'Client not found or Cal.com not connected' };
    }

    await calcomRequest(`/bookings/${bookingId}/cancel`, client.calcom_api_key, {
      method: 'DELETE',
      body: JSON.stringify({ reason: reason || 'Cancelled via CallBird AI' })
    });

    // Update our database
    await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('calcom_booking_id', bookingId);

    return { success: true, message: 'Booking cancelled' };
  } catch (error) {
    console.error('❌ Cancel booking error:', error.message);
    return { success: false, error: 'Failed to cancel booking' };
  }
}

module.exports = {
  getAvailableSlots,
  bookAppointment,
  getEventTypes,
  verifyApiKey,
  cancelBooking,
  parseTimeTo24Hr
};