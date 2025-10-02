const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// GET /api/calls/:clientId - Get all calls for a client
async function getClientCalls(req, res) {
  try {
    const { clientId } = req.params;

    const { data: calls, error } = await supabase
      .from('calls')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching calls:', error);
      return res.status(500).json({ error: 'Failed to fetch calls' });
    }

    return res.status(200).json({ calls: calls || [] });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// GET /api/call/:callId - Get single call details
async function getCallDetail(req, res) {
  try {
    const { callId } = req.params;

    const { data: call, error } = await supabase
      .from('calls')
      .select('*')
      .eq('id', callId)
      .single();

    if (error) {
      console.error('Error fetching call:', error);
      return res.status(404).json({ error: 'Call not found' });
    }

    return res.status(200).json({ call });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

module.exports = { getClientCalls, getCallDetail };
