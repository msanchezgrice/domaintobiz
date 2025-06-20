export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Validate request body exists
    if (!req.body) {
      console.error('❌ No request body provided');
      return res.status(400).json({ 
        error: 'Request body is required' 
      });
    }

    // Handle potential JSON parsing errors
    let parsedBody;
    try {
      parsedBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (parseError) {
      console.error('❌ JSON parsing error:', parseError);
      return res.status(400).json({ 
        error: 'Invalid JSON in request body',
        details: parseError.message 
      });
    }

    const { domain, strategy, designSystem, executionId } = parsedBody;

    if (!domain || !strategy) {
      return res.status(400).json({ 
        error: 'Please provide domain and strategy data' 
      });
    }

    console.log(`✍️ Content Agent starting for ${domain}`);
    console.log(`📊 Features to write: ${strategy.mvpScope.features.join(', ')}`);

    // Real AI content generation
    let websiteContent;
    
    try {
      if (!process.env.OPENAI_API_KEY) {
        console.log('⚠️ No OpenAI API key - using mock content');
        websiteContent = {
          status: 'completed',
          hero: {
            headline: `Welcome to ${domain}`,
            subheadline: strategy.brandStrategy.positioning,
            cta: {
              primary: { text: 'Get Started', link: '#signup' },
              secondary: { text: 'Learn More', link: '#features' }
            }
          },
          sections: strategy.mvpScope.features.map(feature => ({
            title: feature,
            content: `Content for ${feature}`,
            type: 'feature'
          }))
        };
      } else {
        console.log('🤖 Calling OpenAI for content generation...');
        
        const { OpenAI } = await import('openai');
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY
        });

        const prompt = `
You are an expert copywriter. Create compelling website content for:

Domain: ${domain}
Business Type: ${strategy.businessModel.type}
Value Proposition: ${strategy.brandStrategy.uniqueValue}
Target Audience: ${strategy.brandStrategy.targetAudience}
Brand Voice: ${strategy.brandStrategy.brandPersonality}
Key Features: ${strategy.mvpScope.features.join(', ')}

CRITICAL: The content MUST align perfectly with the domain name meaning.
For "${domain}": ${strategy.businessModel.description}

Create website copy that directly addresses the target audience's needs.

Return ONLY a valid JSON object with this structure:
{
  "hero": {
    "headline": "Compelling headline that captures the value",
    "subheadline": "Supporting text that expands on the promise",
    "cta": {
      "primary": { "text": "Action text", "link": "#signup" },
      "secondary": { "text": "Learn More", "link": "#features" }
    }
  },
  "sections": [
    {
      "id": "features",
      "title": "Section Title",
      "content": "Section content",
      "features": [
        {
          "title": "Feature 1",
          "description": "Feature description",
          "icon": "icon-name"
        }
      ]
    }
  ],
  "footer": {
    "tagline": "Footer tagline",
    "links": [
      { "text": "Privacy", "href": "/privacy" },
      { "text": "Terms", "href": "/terms" }
    ]
  }
}`;

        const completion = await openai.chat.completions.create({
                          model: "gpt-4.1-2025-04-14",
          messages: [
            {
              role: "system",
              content: "You are a world-class copywriter. Always respond with valid JSON only."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 2000
        });

        const responseText = completion.choices[0].message.content;
        console.log('📥 Content AI response received');
        
        // Parse JSON response - handle markdown formatting
        try {
          // Clean the response text
          let cleanedResponse = responseText.trim();
          
          // Remove markdown code blocks if present
          if (cleanedResponse.startsWith('```json')) {
            cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          } else if (cleanedResponse.startsWith('```')) {
            cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
          }
          
          websiteContent = JSON.parse(cleanedResponse);
          websiteContent.status = 'completed';
          console.log('✅ Successfully parsed website content');
        } catch (parseError) {
          console.error('❌ Failed to parse content response:', parseError);
          console.log('🔍 Raw response:', responseText);
          
          // Try to extract JSON from response
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              websiteContent = JSON.parse(jsonMatch[0]);
              websiteContent.status = 'completed';
              console.log('✅ Successfully extracted JSON from response');
            } catch (extractError) {
              console.error('❌ Failed to parse extracted JSON:', extractError);
              throw parseError;
            }
          } else {
            throw parseError;
          }
        }
      }
    } catch (error) {
      console.error('❌ Error generating content:', error);
      websiteContent = {
        status: 'error',
        error: error.message,
        fallback: true
      };
    }

    console.log('✍️ Content generation completed');

    return res.status(200).json({
      success: true,
      agent: 'content',
      data: websiteContent,
      executionId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Content agent failed:', error);
    return res.status(500).json({ 
      error: 'Content agent failed', 
      message: error.message
    });
  }
}