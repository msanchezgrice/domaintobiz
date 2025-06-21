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
    const { domain, strategy, designSystem, executionId } = req.body;

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
You are an expert website copywriter. Create persuasive, benefit-focused website copy for:

Domain: ${domain}
Business Type: ${strategy.businessModel.type}
Value Proposition: ${strategy.brandStrategy.uniqueValue}
Target Audience: ${strategy.brandStrategy.targetAudience}
Brand Voice: ${strategy.brandStrategy.brandPersonality}
Key Features: ${strategy.mvpScope.features.join(', ')}

COPYWRITING REQUIREMENTS:
1. Write MARKETING COPY, not business descriptions
2. Focus on BENEFITS and EMOTIONAL OUTCOMES, not features
3. Use action words, power words, and urgency
4. Address PAIN POINTS and promise compelling solutions
5. Create headlines that make people want to read more
6. Write like you're selling results, not explaining products

EXAMPLES:
- Bad: "Platform for form creation" → Good: "Turn Every Form Into a Revenue Machine" 
- Bad: "Opportunity discovery system" → Good: "Never Miss Your Perfect Career Move Again"
- Bad: "Analytics dashboard" → Good: "Watch Your Success Grow In Real-Time"

Create website copy that makes visitors excited to take action immediately.

Return ONLY a valid JSON object with this structure:
{
  "hero": {
    "headline": "Benefit-driven headline that creates desire (e.g. 'Double Your Sales', 'Find Your Dream Job')",
    "subheadline": "Promise-focused subheadline that addresses pain and offers transformation",
    "cta": {
      "primary": { "text": "Action-oriented CTA (e.g. 'Start Winning Today', 'Get My Results')", "link": "#signup" },
      "secondary": { "text": "Curiosity-driven CTA (e.g. 'See How It Works', 'Watch Demo')", "link": "#features" }
    }
  },
  "sections": [
    {
      "id": "features",
      "title": "Benefit-focused section title (e.g. 'Why Leaders Choose Us', 'Your Success Guaranteed')",
      "content": "Pain-aware content that transitions to benefits and outcomes",
      "features": [
        {
          "title": "Outcome-focused title (e.g. 'Get 3x More Leads', 'Save 10 Hours Weekly')",
          "description": "Result-focused description that explains the transformation",
          "icon": "relevant-icon"
        }
      ]
    },
    {
      "id": "about",
      "title": "Story-driven title (e.g. 'Built by Experts', 'Your Success Is Our Mission')",
      "content": "Narrative that connects with target audience dreams and challenges"
    }
  ],
  "footer": {
    "tagline": "Memorable brand promise (e.g. 'Your success starts here', 'Results you can trust')",
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
        
        // Parse JSON response
        try {
          websiteContent = JSON.parse(responseText);
          websiteContent.status = 'completed';
          console.log('✅ Successfully parsed website content');
        } catch (parseError) {
          console.error('❌ Failed to parse content response:', parseError);
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            websiteContent = JSON.parse(jsonMatch[0]);
            websiteContent.status = 'completed';
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