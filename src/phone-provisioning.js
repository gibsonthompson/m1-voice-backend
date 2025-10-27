// ============================================
// LOCAL PHONE PROVISIONING
// ============================================

const { getAreaCodesForCity } = require('./city-area-codes');

async function provisionLocalPhone(city, state, assistantId, businessName) {
  console.log(`\n📞 Provisioning phone for ${businessName} in ${city}, ${state}`);
  
  const areaCodes = getAreaCodesForCity(city, state);
  
  if (areaCodes.length === 0) {
    throw new Error(`No area codes found for ${city}, ${state}`);
  }
  
  console.log(`📍 Trying ${areaCodes.length} area codes: ${areaCodes.join(', ')}`);
  
  for (let i = 0; i < areaCodes.length; i++) {
    const areaCode = areaCodes[i];
    
    try {
      console.log(`📞 Attempt ${i + 1}/${areaCodes.length}: ${areaCode}...`);
      
      const phoneData = await buyVAPIPhoneNumber(areaCode, assistantId, businessName);
      
      console.log(`✅ SUCCESS! Phone: ${phoneData.number}`);
      return phoneData;
      
    } catch (error) {
      console.log(`❌ ${areaCode} unavailable`);
      
      if (i === areaCodes.length - 1) {
        throw new Error(
          `Failed to provision phone after trying ${areaCodes.length} area codes: ${areaCodes.join(', ')}`
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