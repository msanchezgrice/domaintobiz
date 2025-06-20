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

    const { domain, strategy, designSystem, executionId, regenerate, userComments, projectId } = parsedBody;

    if (!domain || !strategy) {
      return res.status(400).json({ 
        error: 'Please provide domain and strategy data' 
      });
    }

    console.log(`✍️ Content Agent starting for ${domain}`);
    console.log(`🔄 Regeneration mode: ${regenerate ? 'YES' : 'NO'}`);
    if (userComments) {
      console.log(`💬 User feedback: ${userComments}`);
    }
    console.log(`📊 Business concept: ${strategy.businessModel?.businessConcept || 'Not defined'}`);
    console.log(`🎯 Target market: ${strategy.businessModel?.targetMarket || 'Not defined'}`);
    console.log(`🏭 Industry: ${strategy.businessModel?.industry || 'Not defined'}`);

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
You are an expert copywriter. Create compelling website content for a domain-specific business.

DOMAIN ANALYSIS & BUSINESS CONTEXT:
Domain: ${domain}
Business Concept: ${strategy.businessModel?.businessConcept || strategy.businessModel?.domainMeaning || 'Business based on domain analysis'}
Industry: ${strategy.businessModel?.industry || 'Professional Services'}
Target Market: ${strategy.businessModel?.targetMarket || strategy.businessModel?.targetPersona || 'General audience'}
Value Proposition: ${strategy.businessModel?.valueProposition || strategy.brandStrategy?.positioning || 'Comprehensive solution'}
Revenue Model: ${strategy.businessModel?.revenueModel || 'Service-based'}
Problem Solved: ${strategy.businessModel?.problemSolved || 'Key challenges addressed'}

BRAND STRATEGY:
Brand Positioning: ${strategy.brandStrategy?.positioning || 'Trusted authority'}
Brand Promise: ${strategy.brandStrategy?.brandPromise || 'Exceptional value delivery'}
Core Values: ${strategy.brandStrategy?.values?.join(', ') || 'Trust, expertise, innovation'}
Brand Personality: ${strategy.brandStrategy?.personality?.join(', ') || 'Professional, reliable, innovative'}
Tone of Voice: ${strategy.brandStrategy?.toneOfVoice?.description || 'Professional yet approachable'}

MVP FEATURES:
Core Features: ${strategy.mvpScope?.coreFeatures?.map(f => f.name || f).join(', ') || strategy.mvpPlan?.coreFeatures?.map(f => f.name || f).join(', ') || 'Key service offerings'}

${regenerate && userComments ? `
USER FEEDBACK FOR REGENERATION:
The user has provided the following feedback for improving the website:
"${userComments}"

IMPORTANT: Incorporate this feedback into the new content while maintaining the business strategy.
` : ''}

CRITICAL REQUIREMENTS:
1. The content MUST be specifically tailored to the business concept: "${strategy.businessModel?.businessConcept}"
2. Address the exact target market: "${strategy.businessModel?.targetMarket}"
3. Solve the specific problem: "${strategy.businessModel?.problemSolved}"
4. Reflect the industry: "${strategy.businessModel?.industry}"
5. DO NOT use generic placeholders like "Transform your [industry] with [domain]"
6. Create compelling, specific headlines that would make the target audience immediately understand the value
7. Make the content authentic to what this specific business would actually offer

${regenerate ? 'This is a REGENERATION - create improved content based on the user feedback above.' : 'This is a NEW GENERATION - create original content.'}

Create website copy that directly speaks to the target audience's specific needs and pain points.

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
      console.log('🔄 Using enhanced fallback content based on business strategy...');
      
      // Create enhanced fallback content using strategy data
      websiteContent = {
        status: 'completed',
        fallback: true,
        hero: {
          headline: strategy.businessModel?.businessConcept || `${strategy.businessModel?.domainMeaning || domain} Solutions`,
          subheadline: strategy.businessModel?.valueProposition || strategy.brandStrategy?.positioning || `Professional services for ${strategy.businessModel?.targetMarket || 'your business'}`,
          cta: {
            primary: { text: 'Get Started', link: '#signup' },
            secondary: { text: 'Learn More', link: '#features' }
          }
        },
        sections: [
          {
            id: 'features',
            title: 'Our Services',
            content: `Discover how we can help with ${strategy.businessModel?.problemSolved || 'your challenges'}`,
            features: (strategy.mvpScope?.coreFeatures || strategy.mvpPlan?.coreFeatures || strategy.mvpScope?.features || ['Professional Services', 'Expert Consultation', 'Custom Solutions']).map(f => ({
              title: typeof f === 'object' ? f.name || f.title : f,
              description: typeof f === 'object' ? f.description : `Expert ${f} tailored to your needs`,
              icon: 'star'
            }))
          },
          {
            id: 'about',
            title: `About ${domain}`,
            content: strategy.businessModel?.businessConcept || `We specialize in providing ${strategy.businessModel?.industry || 'professional'} solutions to help ${strategy.businessModel?.targetMarket || 'businesses'} achieve their goals.`
          }
        ],
        footer: {
          tagline: `Your trusted partner for ${strategy.businessModel?.industry || 'professional'} solutions`,
          links: [
            { text: 'Privacy Policy', href: '/privacy' },
            { text: 'Terms of Service', href: '/terms' }
          ]
        }
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