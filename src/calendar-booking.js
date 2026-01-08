// ====================================================================
// GOOGLE CALENDAR BOOKING - VAPI Tool Handler
// ====================================================================
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Refresh access token if expired
async function refreshAccessToken(client) {
  if (!client.google_refresh_token) {
    console.error('No refresh token available');
    return null;
  }

  const expiresAt = new Date(client.google_token_expires_at);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000;

  if (expiresAt.getTime() - now.getTime() > bufferMs) {
    return client.google_access_token;
  }

  console.log('🔄 Refreshing Google access token...');

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID,
        client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
        refresh_token: client.google_refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      console.error('Token refresh failed:', await response.text());
      return null;
    }

    const tokens = await response.json();
    const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await supabase
      .from('clients')
      .update({
        google_access_token: tokens.access_token,
        google_token_expires_at: newExpiresAt,
      })
      .eq('id', client.id);

    return tokens.access_token;
  } catch (err) {
    console.error('Token refresh error:', err);
    return null;
  }
}

// Get available time slots
async function getAvailableSlots(clientId, date) {
  try {
    const { data: client, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (error || !client || !client.google_calendar_connected) {
      return { success: false, error: 'Calendar not connected' };
    }

    const accessToken = await refreshAccessToken(client);
    if (!accessToken) {
      return { success: false, error: 'Calendar authentication failed' };
    }

    const businessHours = client.business_hours || {
      monday: { open: '09:00', close: '17:00' },
      tuesday: { open: '09:00', close: '17:00' },
      wednesday: { open: '09:00', close: '17:00' },
      thursday: { open: '09:00', close: '17:00' },
      friday: { open: '09:00', close: '17:00' },
      saturday: null,
      sunday: null
    };

    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayOfWeek = dayNames[new Date(date).getDay()];
    const hours = businessHours[dayOfWeek];

    if (!hours || !hours.open || !hours.close) {
      return { success: true, slots: [], message: 'Closed on this day' };
    }

    // Get existing events
    const calendarId = client.google_calendar_id || 'primary';
    const startOfDay = `${date}T00:00:00Z`;
    const endOfDay = `${date}T23:59:59Z`;

    const eventsResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
      new URLSearchParams({
        timeMin: startOfDay,
        timeMax: endOfDay,
        singleEvents: 'true',
        orderBy: 'startTime',
      }),
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const eventsData = await eventsResponse.json();
    const busyTimes = (eventsData.items || []).map(event => ({
      start: new Date(event.start.dateTime || event.start.date),
      end: new Date(event.end.dateTime || event.end.date),
    }));

    // Generate available slots
    const duration = client.appointment_duration || 30;
    const slots = [];
    let currentTime = new Date(`${date}T${hours.open}:00`);
    const closeTime = new Date(`${date}T${hours.close}:00`);

    while (currentTime.getTime() + duration * 60000 <= closeTime.getTime()) {
      const slotEnd = new Date(currentTime.getTime() + duration * 60000);
      
      const hasConflict = busyTimes.some(busy =>
        (currentTime >= busy.start && currentTime < busy.end) ||
        (slotEnd > busy.start && slotEnd <= busy.end) ||
        (currentTime <= busy.start && slotEnd >= busy.end)
      );

      if (!hasConflict) {
        slots.push(currentTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }));
      }

      currentTime = new Date(currentTime.getTime() + 30 * 60000);
    }

    return { success: true, slots, date };
  } catch (err) {
    console.error('Get slots error:', err);
    return { success: false, error: 'Failed to get availability' };
  }
}

// Book an appointment
async function bookAppointment(clientId, customerName, customerPhone, date, time, serviceType, notes) {
  try {
    console.log('📅 Booking appointment:', { clientId, customerName, date, time, serviceType });

    const { data: client, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (error || !client) {
      return { success: false, error: 'Client not found' };
    }

    if (!client.google_calendar_connected) {
      return { success: false, error: 'Calendar not connected - appointment request noted for callback' };
    }

    const accessToken = await refreshAccessToken(client);
    if (!accessToken) {
      return { success: false, error: 'Calendar authentication failed' };
    }

    // Parse date and time
    const appointmentDate = new Date(`${date} ${time}`);
    if (isNaN(appointmentDate.getTime())) {
      return { success: false, error: 'Invalid date or time format' };
    }

    const duration = client.appointment_duration || 30;
    const endDate = new Date(appointmentDate.getTime() + duration * 60000);
    const timezone = client.timezone || 'America/New_York';

    const event = {
      summary: `${serviceType || 'Appointment'} - ${customerName}`,
      description: `Customer: ${customerName}\nPhone: ${customerPhone}\n${notes ? `Notes: ${notes}` : ''}\n\nBooked via CallBird AI`,
      start: {
        dateTime: appointmentDate.toISOString(),
        timeZone: timezone,
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: timezone,
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 60 },
          { method: 'popup', minutes: 30 },
        ],
      },
    };

    const calendarId = client.google_calendar_id || 'primary';
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to create event:', errorText);
      return { success: false, error: 'Failed to create appointment' };
    }

    const createdEvent = await response.json();
    console.log('✅ Appointment booked:', createdEvent.id);

    // Save to our database
    await supabase.from('appointments').insert({
      client_id: clientId,
      google_event_id: createdEvent.id,
      customer_name: customerName,
      customer_phone: customerPhone,
      appointment_time: appointmentDate.toISOString(),
      duration,
      service_type: serviceType,
      notes,
      status: 'confirmed',
    });

    const formattedDate = appointmentDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });

    return {
      success: true,
      message: `Appointment confirmed for ${customerName} on ${formattedDate} at ${time}`,
      appointment: {
        date: formattedDate,
        time,
        service: serviceType
      }
    };

  } catch (err) {
    console.error('Booking error:', err);
    return { success: false, error: 'Server error while booking' };
  }
}

module.exports = {
  getAvailableSlots,
  bookAppointment,
  refreshAccessToken
};
