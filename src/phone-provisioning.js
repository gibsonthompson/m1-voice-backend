// ============================================
// LOCAL PHONE PROVISIONING WITH STATE FALLBACK
// ============================================

const { getAreaCodesForCity } = require('./city-area-codes');

async function provisionLocalPhone(city, state, assistantId, businessName) {
  console.log(`\n📞 Provisioning phone for ${businessName} in ${city}, ${state}`);
  
  // Get city-specific codes and all state codes
  const cityAreaCodes = require('./city-area-codes');
  const localCodes = getAreaCodesForCity(city, state);
  
  if (localCodes.length === 0) {
    throw new Error(`No area codes found for ${city}, ${state}`);
  }
  
  console.log(`📍 Trying ${localCodes.length} local area codes: ${localCodes.join(', ')}`);
  
  // STEP 1: Try local codes first
  for (let i = 0; i < localCodes.length; i++) {
    const areaCode = localCodes[i];
    
    try {
      console.log(`📞 Local attempt ${i + 1}/${localCodes.length}: ${areaCode}...`);
      
      const phoneData = await buyVAPIPhoneNumber(areaCode, assistantId, businessName);
      
      console.log(`✅ SUCCESS! Local phone: ${phoneData.number}`);
      return phoneData;
      
    } catch (error) {
      console.log(`❌ ${areaCode} unavailable`);
    }
  }
  
  // STEP 2: If all local codes failed, try ALL state codes
  console.log(`⚠️  All local codes unavailable. Trying all ${state} area codes...`);
  
  // Import state codes
  const { stateAreaCodes } = require('./city-area-codes');
  const stateUpper = state.toUpperCase().length === 2 ? state.toUpperCase() : 
    // Convert full name to abbreviation if needed
    (state.toUpperCase() === 'GEORGIA' ? 'GA' : state.toUpperCase());
  
  const allStateCodes = stateAreaCodes[stateUpper] || [];
  
  // Filter out codes we already tried
  const remainingCodes = allStateCodes.filter(code => !localCodes.includes(code));
  
  if (remainingCodes.length === 0) {
    throw new Error(
      `Failed to provision phone after trying all ${state} area codes`
    );
  }
  
  console.log(`📍 Trying ${remainingCodes.length} additional ${state} codes...`);
  
  for (let i = 0; i < remainingCodes.length; i++) {
    const areaCode = remainingCodes[i];
    
    try {
      console.log(`📞 State attempt ${i + 1}/${remainingCodes.length}: ${areaCode}...`);
      
      const phoneData = await buyVAPIPhoneNumber(areaCode, assistantId, businessName);
      
      console.log(`✅ SUCCESS! ${state} phone: ${phoneData.number}`);
      return phoneData;
      
    } catch (error) {
      console.log(`❌ ${areaCode} unavailable`);
      
      if (i === remainingCodes.length - 1) {
        throw new Error(
          `Failed to provision phone after trying ${localCodes.length + remainingCodes.length} area codes in ${state}`
        );
      }
    }
  }
}

async function buyVAPIPhoneNumber(areaCode, assistantId, businessName) {
  const VAPI_API_KEY = process.env.VAPI_API_KEY;
  
  if (!VAPI_API_KEY) {
    throw new Error('VAPI_API_KEY not set in environment');
  }
  
  const response = await fetch('https://api.vapi.ai/phone-number', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VAPI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      provider: 'twilio',
      areaCode: areaCode,
      name: `${businessName} - Business Line`,
      assistantId: assistantId,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || JSON.stringify(errorData));
  }

  return await response.json();
}

module.exports = {
  provisionLocalPhone,
};