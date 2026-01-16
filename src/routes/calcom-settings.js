// ====================================================================
// CAL.COM SETTINGS - Connection Management Routes
// ====================================================================
// Dashboard endpoints for connecting/disconnecting Cal.com
// ====================================================================

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { verifyApiKey, getEventTypes } = require('../integrations/calcom');
const { updateAssistantCalcom } = require('../calcom-tools');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ============================================
// CONNECT CAL.COM - Save API key and verify
// ============================================
router.post('/connect', async (req, res) => {
  try {
    const { clientId, apiKey } = req.body;

    if (!clientId || !apiKey) {
      return res.status(400).json({ error: 'Missing clientId or apiKey' });
    }

    console.log(`🔗 Connecting Cal.com for client: ${clientId}`);

    // Verify the API key is valid
    const verification = await verifyApiKey(apiKey);
    if (!verification.success) {
      return res.status(400).json({ error: verification.error || 'Invalid API key' });
    }

    // Get event types so client can choose default
    const eventTypesResult = await getEventTypes(apiKey);
    
    // Update client record
    const { error: updateError } = await supabase
      .from('clients')
      .update({
        calcom_connected: true,
        calcom_api_key: apiKey,
        calcom_username: verification.user.username,
        calcom_user_id: verification.user.id?.toString(),
        calendar_provider: 'calcom',
        // Disconnect Google Calendar if it was active
        google_calendar_connected: false
      })
      .eq('id', clientId);

    if (updateError) {
      console.error('❌ Failed to save Cal.com credentials:', updateError);
      return res.status(500).json({ error: 'Failed to save credentials' });
    }

    console.log(`✅ Cal.com connected for client: ${clientId}`);

    res.json({
      success: true,
      user: verification.user,
      eventTypes: eventTypesResult.success ? eventTypesResult.eventTypes : [],
      message: 'Cal.com connected successfully'
    });

  } catch (error) {
    console.error('❌ Cal.com connect error:', error);
    res.status(500).json({ error: 'Failed to connect Cal.com' });
  }
});

// ============================================
// SET EVENT TYPE - Choose default booking type
// ============================================
router.post('/set-event-type', async (req, res) => {
  try {
    const { clientId, eventTypeId } = req.body;

    if (!clientId || !eventTypeId) {
      return res.status(400).json({ error: 'Missing clientId or eventTypeId' });
    }

    console.log(`📅 Setting Cal.com event type for client ${clientId}: ${eventTypeId}`);

    // Get client to check if Cal.com is connected
    const { data: client, error: fetchError } = await supabase
      .from('clients')
      .select('calcom_connected, calcom_api_key, vapi_assistant_id')
      .eq('id', clientId)
      .single();

    if (fetchError || !client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    if (!client.calcom_connected) {
      return res.status(400).json({ error: 'Cal.com not connected' });
    }

    // Verify the event type exists
    const eventTypesResult = await getEventTypes(client.calcom_api_key);
    if (!eventTypesResult.success) {
      return res.status(500).json({ error: 'Failed to verify event type' });
    }

    const eventType = eventTypesResult.eventTypes.find(et => et.id.toString() === eventTypeId.toString());
    if (!eventType) {
      return res.status(400).json({ error: 'Event type not found' });
    }

    // Update client record
    const { error: updateError } = await supabase
      .from('clients')
      .update({
        calcom_event_type_id: eventTypeId.toString()
      })
      .eq('id', clientId);

    if (updateError) {
      console.error('❌ Failed to save event type:', updateError);
      return res.status(500).json({ error: 'Failed to save event type' });
    }

    // Enable Cal.com tools on the VAPI assistant
    if (client.vapi_assistant_id) {
      const toolResult = await updateAssistantCalcom(client.vapi_assistant_id, clientId, true);
      if (!toolResult.success) {
        console.warn('⚠️ Failed to update VAPI assistant:', toolResult.error);
        // Don't fail the request, just log it
      }
    }

    console.log(`✅ Event type set for client ${clientId}: ${eventType.title}`);

    res.json({
      success: true,
      eventType: eventType,
      message: `Default appointment type set to "${eventType.title}"`
    });

  } catch (error) {
    console.error('❌ Set event type error:', error);
    res.status(500).json({ error: 'Failed to set event type' });
  }
});

// ============================================
// GET CALCOM STATUS - Check connection status
// ============================================
router.get('/status/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;

    const { data: client, error } = await supabase
      .from('clients')
      .select('calcom_connected, calcom_username, calcom_event_type_id, calcom_api_key, calendar_provider')
      .eq('id', clientId)
      .single();

    if (error || !client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const response = {
      connected: client.calcom_connected || false,
      username: client.calcom_username,
      eventTypeId: client.calcom_event_type_id,
      isActiveProvider: client.calendar_provider === 'calcom'
    };

    // If connected, fetch event types
    if (client.calcom_connected && client.calcom_api_key) {
      const eventTypesResult = await getEventTypes(client.calcom_api_key);
      if (eventTypesResult.success) {
        response.eventTypes = eventTypesResult.eventTypes;
        
        // Find the selected event type details
        if (client.calcom_event_type_id) {
          const selectedType = eventTypesResult.eventTypes.find(
            et => et.id.toString() === client.calcom_event_type_id
          );
          response.selectedEventType = selectedType;
        }
      }
    }

    res.json(response);

  } catch (error) {
    console.error('❌ Cal.com status error:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// ============================================
// DISCONNECT CAL.COM - Remove integration
// ============================================
router.post('/disconnect', async (req, res) => {
  try {
    const { clientId } = req.body;

    if (!clientId) {
      return res.status(400).json({ error: 'Missing clientId' });
    }

    console.log(`🔓 Disconnecting Cal.com for client: ${clientId}`);

    // Get client to get assistant ID
    const { data: client, error: fetchError } = await supabase
      .from('clients')
      .select('vapi_assistant_id')
      .eq('id', clientId)
      .single();

    if (fetchError) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Disable Cal.com tools on VAPI assistant
    if (client?.vapi_assistant_id) {
      await updateAssistantCalcom(client.vapi_assistant_id, clientId, false);
    }

    // Clear Cal.com credentials
    const { error: updateError } = await supabase
      .from('clients')
      .update({
        calcom_connected: false,
        calcom_api_key: null,
        calcom_event_type_id: null,
        calcom_username: null,
        calcom_user_id: null,
        calendar_provider: null
      })
      .eq('id', clientId);

    if (updateError) {
      console.error('❌ Failed to disconnect Cal.com:', updateError);
      return res.status(500).json({ error: 'Failed to disconnect' });
    }

    console.log(`✅ Cal.com disconnected for client: ${clientId}`);

    res.json({
      success: true,
      message: 'Cal.com disconnected successfully'
    });

  } catch (error) {
    console.error('❌ Cal.com disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect Cal.com' });
  }
});

// ============================================
// REFRESH EVENT TYPES - Get latest from Cal.com
// ============================================
router.get('/event-types/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;

    const { data: client, error } = await supabase
      .from('clients')
      .select('calcom_connected, calcom_api_key')
      .eq('id', clientId)
      .single();

    if (error || !client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    if (!client.calcom_connected || !client.calcom_api_key) {
      return res.status(400).json({ error: 'Cal.com not connected' });
    }

    const result = await getEventTypes(client.calcom_api_key);
    
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      eventTypes: result.eventTypes
    });

  } catch (error) {
    console.error('❌ Get event types error:', error);
    res.status(500).json({ error: 'Failed to get event types' });
  }
});

module.exports = router;