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

    // Get client data
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

    // Scrape website if URL provided
    let websiteContent = '';
    if (websiteUrl && websiteUrl.trim()) {
      try {
        console.log('🌐 Scraping website:', websiteUrl);
        const scrapeResponse = await fetch(`https://r.jina.ai/${websiteUrl}`);
        if (scrapeResponse.ok) {
          websiteContent = await scrapeResponse.text();
          console.log('✅ Website scraped, length:', websiteContent.length);
        }
      } catch (error) {
        console.error('⚠️ Website scraping failed:', error.message);
      }
    }

    // Format knowledge base content
    const content = formatKnowledgeBase({
      businessName: client.business_name,
      industry: client.industry,
      city: client.business_city,
      state: client.business_state,
      phoneNumber: client.vapi_phone_number,
      websiteUrl,
      websiteContent,
      businessHours,
      services,
      faqs,
      additionalInfo,
    });

    console.log('📄 Knowledge base formatted, length:', content.length);

    // Upload to VAPI
    const form = new FormData();
    form.append('file', Buffer.from(content, 'utf-8'), {
      filename: `${client.business_name.replace(/\s+/g, '_')}_knowledge.txt`,
      contentType: 'text/plain',
    });

    console.log('📤 Uploading to VAPI...');
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
      console.error('❌ VAPI upload failed:', uploadResponse.status, errorText);
      throw new Error(`VAPI upload failed: ${uploadResponse.status}`);
    }

    const uploadData = await uploadResponse.json();
    const fileId = uploadData.id;
    console.log('✅ File uploaded, ID:', fileId);

    // Create or update knowledge base
    let knowledgeBaseId = client.knowledge_base_id;

    if (!knowledgeBaseId) {
      // Create new knowledge base
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
        console.error('❌ KB creation failed:', errorText);
        throw new Error('Failed to create knowledge base');
      }

      const kbData = await kbResponse.json();
      knowledgeBaseId = kbData.id;
      console.log('✅ Knowledge base created:', knowledgeBaseId);
    } else {
      // Update existing knowledge base
      console.log('📚 Updating existing knowledge base:', knowledgeBaseId);
      const kbResponse = await fetch(`https://api.vapi.ai/knowledge-base/${knowledgeBaseId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${VAPI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileIds: [fileId] }),
      });

      if (!kbResponse.ok) {
        const errorText = await kbResponse.text();
        console.error('❌ KB update failed:', errorText);
        throw new Error('Failed to update knowledge base');
      }
      console.log('✅ Knowledge base updated');
    }

    // Update assistant with knowledge base
    if (client.vapi_assistant_id) {
      console.log('🤖 Updating assistant:', client.vapi_assistant_id);
      const assistantResponse = await fetch(`https://api.vapi.ai/assistant/${client.vapi_assistant_id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${VAPI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: { knowledgeBaseId: knowledgeBaseId },
        }),
      });

      if (!assistantResponse.ok) {
        console.error('⚠️ Assistant update warning:', await assistantResponse.text());
      } else {
        console.log('✅ Assistant updated');
      }
    }

    // Save metadata to Supabase
    const knowledgeData = {
      businessHours,
      services,
      faqs,
      additionalInfo,
    };

    await supabase
      .from('clients')
      .update({
        knowledge_base_id: knowledgeBaseId,
        knowledge_base_data: knowledgeData,
        knowledge_base_updated_at: new Date().toISOString(),
        website_url: websiteUrl || client.website_url,
      })
      .eq('id', clientId);

    console.log('✅ Knowledge base update completed');

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