const fetch = require('node-fetch');
const FormData = require('form-data');

// Keywords for filtering important pages
const IMPORTANT_KEYWORDS = [
  'services?', 'offerings?', 'products?',
  'about', 'company', 'team',
  'pricing', 'price', 'plans?', 'packages?',
  'contact', 'locations?',
  'faq', 'help', 'support'
];

// Get important pages from website
async function getImportantPages(websiteUrl) {
  try {
    // Normalize URL
    const baseUrl = websiteUrl.replace(/\/$/, ''); // Remove trailing slash
    const sitemapUrl = `${baseUrl}/sitemap.xml`;
    
    console.log(`📄 Fetching sitemap: ${sitemapUrl}`);
    
    const response = await fetch(sitemapUrl);
    
    if (!response.ok) {
      console.log('⚠️ No sitemap found, using homepage only');
      return [baseUrl];
    }
    
    const xml = await response.text();
    
    // Extract all <loc> URLs from sitemap
    const urlMatches = xml.match(/<loc>(.*?)<\/loc>/g);
    
    if (!urlMatches) {
      return [baseUrl];
    }
    
    const allUrls = urlMatches.map(url => 
      url.replace(/<\/?loc>/g, '').trim()
    );
    
    console.log(`📋 Found ${allUrls.length} total URLs in sitemap`);
    
    // Build regex pattern for important pages
    const keywordPattern = new RegExp(
      `\\/(${IMPORTANT_KEYWORDS.join('|')})\\b`,
      'i'
    );
    
    // Filter for important pages
    let importantUrls = allUrls.filter(url => {
      // Skip excluded patterns
      const excludePatterns = [
        /\/(admin|login|wp-admin|cart|checkout|account)/i,
        /\/(tag|category|author|page\/\d+)/i,
        /\?/  // Query parameters
      ];
      
      if (excludePatterns.some(pattern => pattern.test(url))) {
        return false;
      }
      
      // Keep if matches important keywords
      return keywordPattern.test(url);
    });
    
    // Always include homepage at start
    if (!importantUrls.includes(baseUrl)) {
      importantUrls.unshift(baseUrl);
    }
    
    // Limit to 12 pages (keep it fast and under file size limit)
    importantUrls = importantUrls.slice(0, 12);
    
    console.log(`✅ Filtered to ${importantUrls.length} important pages`);
    return importantUrls;
    
  } catch (error) {
    console.error('❌ Sitemap parsing error:', error.message);
    // Fallback to homepage only
    return [websiteUrl.replace(/\/$/, '')];
  }
}

// Convert URL to markdown using Jina Reader
async function urlToMarkdown(url, jinaApiKey = null) {
  try {
    const headers = {};
    if (jinaApiKey) {
      headers['Authorization'] = `Bearer ${jinaApiKey}`;
    }
    
    const response = await fetch(`https://r.jina.ai/${url}`, { headers });
    
    if (!response.ok) {
      throw new Error(`Jina API error: ${response.status}`);
    }
    
    const markdown = await response.text();
    return markdown;
    
  } catch (error) {
    console.error(`❌ Failed to convert ${url}:`, error.message);
    return null;
  }
}

// Create knowledge base from website
async function createKnowledgeBaseFromWebsite(websiteUrl, businessName, vapiApiKey, jinaApiKey = null) {
  console.log(`📚 Creating knowledge base from ${websiteUrl}`);
  
  try {
    // 1. Get important page URLs
    const pageUrls = await getImportantPages(websiteUrl);
    
    if (pageUrls.length === 0) {
      console.log('⚠️ No pages found');
      return null;
    }
    
    console.log(`📄 Scraping ${pageUrls.length} pages...`);
    
    // 2. Convert each URL to markdown
    const markdownResults = await Promise.all(
      pageUrls.map(async (url) => {
        const markdown = await urlToMarkdown(url, jinaApiKey);
        if (markdown) {
          return `\n\n---\n\n## Source: ${url}\n\n${markdown}`;
        }
        return '';
      })
    );
    
    // Filter out failed pages
    const validMarkdown = markdownResults.filter(md => md.length > 0);
    
    if (validMarkdown.length === 0) {
      console.log('⚠️ No pages could be scraped');
      return null;
    }
    
    // 3. Combine into single markdown file
    const combinedMarkdown = 
      `# ${businessName} - Website Knowledge Base\n\n` +
      `**Source Website:** ${websiteUrl}\n` +
      `**Generated:** ${new Date().toISOString()}\n` +
      `**Pages Scraped:** ${validMarkdown.length}\n\n` +
      `---\n` +
      validMarkdown.join('\n');
    
    console.log(`📝 Combined markdown size: ${combinedMarkdown.length} characters`);
    
    // 4. Upload file to VAPI
    const formData = new FormData();
    const fileName = `${businessName.replace(/\s+/g, '-').toLowerCase()}-website.md`;
    
    formData.append(
      'file',
      Buffer.from(combinedMarkdown),
      {
        filename: fileName,
        contentType: 'text/markdown'
      }
    );
    
    console.log('📤 Uploading to VAPI...');
    
    const uploadResponse = await fetch('https://api.vapi.ai/file', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vapiApiKey}`
      },
      body: formData
    });
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`VAPI upload failed: ${errorText}`);
    }
    
    const fileData = await uploadResponse.json();
    console.log(`✅ File uploaded: ${fileData.id}`);
    
    // 5. Create knowledge base
    console.log('🧠 Creating knowledge base...');
    
    const kbResponse = await fetch('https://api.vapi.ai/knowledge-base', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vapiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        provider: 'canonical',
        fileIds: [fileData.id]
      })
    });
    
    if (!kbResponse.ok) {
      const errorText = await kbResponse.text();
      throw new Error(`Knowledge base creation failed: ${errorText}`);
    }
    
    const kbData = await kbResponse.json();
    console.log(`✅ Knowledge base created: ${kbData.id}`);
    
    return kbData.id;
    
  } catch (error) {
    console.error('❌ Knowledge base creation error:', error);
    return null; // Graceful failure - continue without KB
  }
}

module.exports = {
  getImportantPages,
  urlToMarkdown,
  createKnowledgeBaseFromWebsite
};