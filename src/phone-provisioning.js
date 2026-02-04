// ============================================
// LOCAL PHONE PROVISIONING WITH NEIGHBORING STATE FALLBACK
// ============================================

const { getAreaCodesForCity, stateAreaCodes, neighboringStates, normalizeState } = require('./city-area-codes');

async function provisionLocalPhone(city, state, assistantId, businessName) {
  console.log(`\n📞 Provisioning phone for ${businessName} in ${city}, ${state}`);
  
  const normalizedState = normalizeState(state);
  
  // Get local codes
  const localCodes = getAreaCodesForCity(city, state);
  
  if (localCodes.length === 0) {
    console.log(`⚠️ No local codes found for ${city}, ${state} - trying state codes`);
  } else {
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
  }
  
  // STEP 2: Try ALL state codes
  console.log(`⚠️ Local codes unavailable. Trying all ${normalizedState} area codes...`);
  
  const allStateCodes = stateAreaCodes[normalizedState] || [];
  
  if (allStateCodes.length > 0) {
    // Filter out codes we already tried
    const remainingStateCodes = allStateCodes.filter(code => !localCodes.includes(code));
    
    if (remainingStateCodes.length > 0) {
      console.log(`📍 Trying ${remainingStateCodes.length} additional ${normalizedState} codes...`);
      
      for (let i = 0; i < remainingStateCodes.length; i++) {
        const areaCode = remainingStateCodes[i];
        
        try {
          console.log(`📞 State attempt ${i + 1}/${remainingStateCodes.length}: ${areaCode}...`);
          
          const phoneData = await buyVAPIPhoneNumber(areaCode, assistantId, businessName);
          
          console.log(`✅ SUCCESS! ${normalizedState} phone: ${phoneData.number}`);
          return phoneData;
          
        } catch (error) {
          console.log(`❌ ${areaCode} unavailable`);
        }
      }
    }
  }
  
  // STEP 3: Try NEIGHBORING STATES
  const neighbors = neighboringStates[normalizedState] || [];
  
  if (neighbors.length > 0) {
    console.log(`⚠️ All ${normalizedState} codes unavailable. Trying neighboring states: ${neighbors.join(', ')}`);
    
    // Track all codes we've already tried
    const triedCodes = new Set([...localCodes, ...allStateCodes]);
    
    for (const neighborState of neighbors) {
      const neighborCodes = stateAreaCodes[neighborState] || [];
      const newCodes = neighborCodes.filter(code => !triedCodes.has(code));
      
      if (newCodes.length === 0) continue;
      
      console.log(`📍 Trying ${newCodes.length} codes from ${neighborState}...`);
      
      for (let i = 0; i < newCodes.length; i++) {
        const areaCode = newCodes[i];
        
        try {
          console.log(`📞 Neighbor ${neighborState} attempt ${i + 1}/${newCodes.length}: ${areaCode}...`);
          
          const phoneData = await buyVAPIPhoneNumber(areaCode, assistantId, businessName);
          
          console.log(`✅ SUCCESS! ${neighborState} phone (neighbor): ${phoneData.number}`);
          return phoneData;
          
        } catch (error) {
          console.log(`❌ ${areaCode} unavailable`);
          triedCodes.add(areaCode);
        }
      }
    }
  }
  
  // All attempts failed
  throw new Error(
    `Failed to provision phone for ${businessName}. Tried all area codes in ${normalizedState} and neighboring states: ${neighbors.join(', ')}`
  );
}

async function buyVAPIPhoneNumber(areaCode, assistantId, businessName) {
  const VAPI_API_KEY = process.env.VAPI_API_KEY;
  
  if (!VAPI_API_KEY) {
    throw new Error('VAPI_API_KEY not set in environment');
  }
  
  const response = await fetch('https://api.vapi.ai/phone-number/buy', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VAPI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
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