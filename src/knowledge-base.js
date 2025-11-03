const fetch = require('node-fetch');
const FormData = require('form-data');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const VAPI_API_KEY = process.env.VAPI_API_KEY;

async function updateKnowledgeBase(req, res) {
  try {
    console.log('📚 Knowledge base update started');
    
    const {
      clientId,
      businessHours,
      services,
      faqs,
      additionalInfo,
      websiteUrl
    } = req.body;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'Client ID required'
      });
    }

    // Get client data from database
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      console.error('Client not found:', clientError);
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }

    console.log('✅ Client found:', client.business_name);

    // ========================================
    // 🔑 MERGE LOGIC: Keep existing data if field is empty
    // ========================================
    // This ensures we don't erase data when user only updates one field
    const existingData = client.knowledge_base_data || {};
    
    const finalData = {
      // If new value is provided, use it. Otherwise, keep existing.
      businessHours: businessHours || existingData.businessHours || '',
      services: services || existingData.services || '',
      faqs: faqs || existingData.faqs || '',
      additionalInfo: additionalInfo || existingData.additionalInfo || '',
    };

    console.log('📊 Merged data:', {
      businessHours: businessHours ? '✏️ updated' : '✓ kept existing',
      services: services ? '✏️ updated' : '✓ kept existing',
      faqs: faqs ? '✏️ updated' : '✓ kept existing',
      additionalInfo: additionalInfo ? '✏️ updated' : '✓ kept existing',
    });

    // ========================================
    // WEBSITE SCRAPING (if URL changed)
    // ========================================
    let websiteContent = existingData.websiteContent || ''; // Start with cached content
    
    // Only re-scrape if URL is different from stored URL
    if (websiteUrl && websiteUrl.trim() && websiteUrl !== client.website_url) {
      try {
        console.log('🌐 Website URL changed, re-scraping:', websiteUrl);
        const scrapeResponse = await fetch(`https://r.jina.ai/${websiteUrl}`);
        if (scrapeResponse.ok) {
          websiteContent = await scrapeResponse.text();
          console.log('✅ Website scraped, length:', websiteContent.length);
        }
      } catch (error) {
        console.error('⚠️ Website scraping failed:', error.message);
        // Keep existing website content if scraping fails
      }
    } else {
      console.log('ℹ️ Using cached website content');
    }

    // ========================================
    // FORMAT COMPLETE KNOWLEDGE BASE
    // ========================================
    const content = formatKnowledgeBase({
      businessName: client.business_name,
      industry: client.industry,
      city: client.business_city,
      state: client.business_state,
      phoneNumber: client.vapi_phone_number,
      websiteUrl: websiteUrl || client.website_url,
      websiteContent: websiteContent,
      businessHours: finalData.businessHours,
      services: finalData.services,
      faqs: finalData.faqs,
      additionalInfo: finalData.additionalInfo,
    });

    console.log('📄 Knowledge base formatted, total length:', content.length);

    // ========================================
    // UPLOAD FILE TO VAPI
    // ========================================
    const form = new FormData();
    form.append('file', Buffer.from(content, 'utf-8'), {
      filename: `${client.business_name.replace(/\s+/g, '_')}_knowledge.txt`,
      contentType: 'text/plain',
    });

    console.log('📤 Uploading file to VAPI...');
    const uploadResponse = await fetch('https://api.vapi.ai/file', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        ...form.getHeaders(),
      },
      body: form,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('❌ VAPI file upload failed:', uploadResponse.status, errorText);
      throw new Error(`VAPI upload failed: ${uploadResponse.status}`);
    }

    const uploadData = await uploadResponse.json();
    const fileId = uploadData.id;
    console.log('✅ File uploaded to VAPI, ID:', fileId);

    // ========================================
    // CREATE NEW KNOWLEDGE BASE (always create new)
    // ========================================
    // Note: We create new KB each time because VAPI's PATCH endpoint is unreliable
    // The assistant gets updated to point to the new KB, so old ones become unused
    console.log('📚 Creating new knowledge base...');
    const kbResponse = await fetch('https://api.vapi.ai/knowledge-base', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `${client.business_name} Knowledge Base`,
        fileIds: [fileId],
      }),
    });

    if (!kbResponse.ok) {
      const errorText = await kbResponse.text();
      console.error('❌ Knowledge base creation failed:', errorText);
      throw new Error('Failed to create knowledge base');
    }

    const kbData = await kbResponse.json();
    const knowledgeBaseId = kbData.id;
    console.log('✅ Knowledge base created:', knowledgeBaseId);

    // ========================================
    // UPDATE ASSISTANT TO USE NEW KNOWLEDGE BASE
    // ========================================
    if (client.vapi_assistant_id) {
      console.log('🤖 Updating assistant to use new knowledge base...');
      const assistantResponse = await fetch(`https://api.vapi.ai/assistant/${client.vapi_assistant_id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${VAPI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: { 
            knowledgeBaseId: knowledgeBaseId 
          },
        }),
      });

      if (!assistantResponse.ok) {
        const errorText = await assistantResponse.text();
        console.error('⚠️ Assistant update warning:', errorText);
        // Don't throw - knowledge base is created, just log warning
      } else {
        console.log('✅ Assistant updated with new knowledge base');
      }
    } else {
      console.log('ℹ️ No assistant ID found, skipping assistant update');
    }

    // ========================================
    // SAVE TO DATABASE
    // ========================================
    console.log('💾 Saving to database...');
    await supabase
      .from('clients')
      .update({
        knowledge_base_id: knowledgeBaseId,
        knowledge_base_data: {
          ...finalData,
          websiteContent: websiteContent, // Cache website content
        },
        knowledge_base_updated_at: new Date().toISOString(),
        website_url: websiteUrl || client.website_url,
      })
      .eq('id', clientId);

    console.log('✅ Knowledge base update completed successfully');

    return res.json({
      success: true,
      message: 'Knowledge base updated successfully',
      knowledgeBaseId,
    });

  } catch (error) {
    console.error('❌ Knowledge base update error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update knowledge base',
    });
  }
}

function formatKnowledgeBase(data) {
  const sections = [
    `# ${data.businessName} - AI Assistant Knowledge Base`,
    `\n## Business Information`,
    `- Business Name: ${data.businessName}`,
    `- Industry: ${data.industry || 'N/A'}`,
    `- Location: ${data.city}, ${data.state}`,
    `- Phone Number: ${data.phoneNumber || 'N/A'}`,
  ];

  if (data.websiteUrl) {
    sections.push(`- Website: ${data.websiteUrl}`);
  }

  if (data.businessHours) {
    sections.push(`\n## Business Hours`);
    sections.push(data.businessHours);
  }

  if (data.services) {
    sections.push(`\n## Services & Pricing`);
    sections.push(data.services);
  }

  if (data.faqs) {
    sections.push(`\n## Frequently Asked Questions`);
    sections.push(data.faqs);
  }

  if (data.additionalInfo) {
    sections.push(`\n## Additional Information`);
    sections.push(data.additionalInfo);
  }

  if (data.websiteContent) {
    sections.push(`\n## Website Content`);
    sections.push(data.websiteContent.substring(0, 10000));
  }

  sections.push(`\n## Instructions for AI Assistant`);
  sections.push(`You are an AI phone assistant for ${data.businessName}. Use the information above to answer customer questions accurately. Always be professional, friendly, and helpful. If you don't know something, politely say so and offer to take a message or transfer to a human.`);

  return sections.join('\n');
}

module.exports = { updateKnowledgeBase };