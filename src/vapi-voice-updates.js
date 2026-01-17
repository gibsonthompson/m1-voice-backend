// ====================================================================
// VAPI VOICE UPDATE HELPERS - m1-voice-backend/src/vapi-voice-updates.js
// ====================================================================
// Import this in your existing files or add these functions to vapi-assistant.js
// ====================================================================

const fetch = require('node-fetch');

// ====================================================================
// VOICES - ElevenLabs official premade voice IDs
// ====================================================================
const VOICES = {
  // Female voices
  rachel: '21m00Tcm4TlvDq8ikWAM',
  sarah: 'EXAVITQu4vr4xnSDxMaL',
  serena: 'pMsXgVXv3BLzUgSXRplE',
  matilda: 'XrExE9yKIg1WjnnlVkGX',
  lily: 'pFZP5JQG7iQjIQuC4Bku',
  alice: 'Xb7hH8MSUJpSbSDYk0k2',
  emily: 'LcfcDJNUP1GQjkzn1xUU',
  
  // Male voices
  charlie: 'IKne3meq5aSn9XLyUdCD',
  chris: 'iP95p4xoKVk53GoZ742B',
  brian: 'nPczCjzI2devNBz1zQrb',
  adam: 'pNInz6obpgDQGcFmaJgB',
  drew: '29vD33N1CtxCmqQRPOHJ',
  daniel: 'onwK4e9ZLuTAKqWW03F9',
  josh: 'TxGEqnHWrfWFTfGW9XjX',
  george: 'JBFqnCBsd6RMkjVDRZzb',
  liam: 'TX3LPaxmHKxFdv7VOQHJ',
  
  // Legacy mappings (backwards compatibility with existing industry configs)
  male_professional: '29vD33N1CtxCmqQRPOHJ',
  female_warm: '21m00Tcm4TlvDq8ikWAM',
  male_adam: 'pNInz6obpgDQGcFmaJgB',
  female_soft: 'EXAVITQu4vr4xnSDxMaL',
};

const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel

// ====================================================================
// Industry to Default Voice Mapping
// ====================================================================
const INDUSTRY_DEFAULT_VOICES = {
  home_services: VOICES.chris,
  medical: VOICES.sarah,
  retail: VOICES.matilda,
  professional_services: VOICES.brian,
  restaurants: VOICES.serena,
  salon_spa: VOICES.rachel,
};

// ====================================================================
// Get all valid voice IDs
// ====================================================================
function getAllVoiceIds() {
  return Object.values(VOICES);
}

// ====================================================================
// Validate voice ID
// ====================================================================
function isValidVoiceId(voiceId) {
  return getAllVoiceIds().includes(voiceId);
}

// ====================================================================
// Get voice ID for client (priority: custom > industry default > global default)
// ====================================================================
function getVoiceIdForClient(clientVoiceId, industryKey) {
  if (clientVoiceId && isValidVoiceId(clientVoiceId)) {
    return clientVoiceId;
  }
  
  if (industryKey && INDUSTRY_DEFAULT_VOICES[industryKey]) {
    return INDUSTRY_DEFAULT_VOICES[industryKey];
  }
  
  return DEFAULT_VOICE_ID;
}

// ====================================================================
// Update VAPI assistant voice
// ====================================================================
async function updateAssistantVoice(assistantId, newVoiceId) {
  try {
    console.log(`🎤 Updating assistant ${assistantId} voice to ${newVoiceId}`);
    
    if (!isValidVoiceId(newVoiceId)) {
      console.error(`⚠️ Invalid voice ID: ${newVoiceId}`);
      return false;
    }

    const response = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        voice: {
          provider: '11labs',
          voiceId: newVoiceId,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`⚠️ VAPI voice update failed: ${errorText}`);
      return false;
    }

    const updatedAssistant = await response.json();
    console.log(`✅ Voice updated: ${updatedAssistant.voice?.voiceId}`);
    return true;

  } catch (error) {
    console.error('❌ Error updating assistant voice:', error);
    return false;
  }
}

// ====================================================================
// Get current voice from VAPI assistant
// ====================================================================
async function getAssistantVoice(assistantId) {
  try {
    const response = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const assistant = await response.json();
    return assistant.voice?.voiceId || null;

  } catch (error) {
    console.error('Error fetching assistant voice:', error);
    return null;
  }
}

// ====================================================================
// EXPORTS
// ====================================================================
module.exports = {
  VOICES,
  DEFAULT_VOICE_ID,
  INDUSTRY_DEFAULT_VOICES,
  getAllVoiceIds,
  isValidVoiceId,
  getVoiceIdForClient,
  updateAssistantVoice,
  getAssistantVoice,
};