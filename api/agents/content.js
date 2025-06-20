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

    const { domain, strategy, domainAnalysis, designSystem, executionId, regenerate, userComments, projectId } = parsedBody;

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
        console.log('⚠️ No OpenAI API key - using strategy-based content');
        
        const aiInsights = domainAnalysis?.aiInsights;
        const businessConcept = aiInsights?.businessConcept || strategy.businessModel?.businessConcept || strategy.businessModel?.domainMeaning;
        const valueProposition = aiInsights?.valueProposition || strategy.businessModel?.valueProposition;
        
        if (!businessConcept || !valueProposition) {
          throw new Error('Missing OpenAI API key AND insufficient strategy data for content generation');
        }
        
        websiteContent = {
          status: 'completed',
          no_ai: true,
          hero: {
            headline: businessConcept,
            subheadline: valueProposition,
            cta: {
              primary: { text: 'Get Started', link: '#signup' },
              secondary: { text: 'Learn More', link: '#features' }
            }
          },
          sections: (strategy.mvpScope?.coreFeatures || strategy.mvpPlan?.coreFeatures || []).map(feature => ({
            title: typeof feature === 'object' ? feature.name || feature.title : feature,
            content: typeof feature === 'object' ? feature.description : `${feature} designed for ${strategy.businessModel?.targetMarket}`,
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

ORIGINAL DOMAIN ANALYSIS INSIGHTS:
Domain: ${domain}
${domainAnalysis?.aiInsights ? `
AI DOMAIN INSIGHTS (USE THIS AS PRIMARY SOURCE):
- Business Concept: ${domainAnalysis.aiInsights.businessConcept}
- Founder Intent: ${domainAnalysis.aiInsights.founderIntent}
- Value Proposition: ${domainAnalysis.aiInsights.valueProposition}
- Target Demographic: ${domainAnalysis.aiInsights.targetDemographic}
- Suggested Features: ${domainAnalysis.aiInsights.suggestedFeatures?.join(', ')}
- Brand Personality: ${domainAnalysis.aiInsights.brandPersonality}
- Industry Fit: ${domainAnalysis.aiInsights.industryFit}
- Business Potential: ${domainAnalysis.aiInsights.businessPotential}
- Key Strengths: ${domainAnalysis.aiInsights.strengths?.join(', ')}
- AI Reasoning: ${domainAnalysis.aiInsights.reasoning}

CRITICAL: Use these AI insights as the PRIMARY source for content creation. This is what the business should actually be about.
` : ''}

BUSINESS STRATEGY (DERIVED FROM AI INSIGHTS):
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
      
      // Create content using AI INSIGHTS first, then business strategy - no generic placeholders
      const aiInsights = domainAnalysis?.aiInsights;
      const businessConcept = aiInsights?.businessConcept || strategy.businessModel?.businessConcept || strategy.businessModel?.domainMeaning;
      const valueProposition = aiInsights?.valueProposition || strategy.businessModel?.valueProposition;
      const targetMarket = aiInsights?.targetDemographic || strategy.businessModel?.targetMarket;
      const industry = aiInsights?.industryFit || strategy.businessModel?.industry;
      const problemSolved = strategy.businessModel?.problemSolved;
      
      if (!businessConcept || !valueProposition) {
        throw new Error('Missing critical business strategy data - cannot generate meaningful content without business concept and value proposition');
      }
      
      // Generate domain-specific content based on actual strategy
      websiteContent = {
        status: 'completed',
        strategy_based: true,
        hero: {
          headline: businessConcept,
          subheadline: valueProposition,
          cta: {
            primary: { text: 'Get Started', link: '#signup' },
            secondary: { text: 'Learn More', link: '#features' }
          }
        },
        sections: [
          {
            id: 'features',
            title: `${industry} Solutions`,
            content: `${problemSolved}`,
            features: (strategy.mvpScope?.coreFeatures || strategy.mvpPlan?.coreFeatures || []).map(f => ({
              title: typeof f === 'object' ? f.name || f.title : f,
              description: typeof f === 'object' ? f.description : `Advanced ${f} designed for ${targetMarket}`,
              icon: 'star'
            }))
          },
          {
            id: 'about',
            title: `About ${businessConcept}`,
            content: `${businessConcept} - ${valueProposition}. We serve ${targetMarket} by ${problemSolved}.`
          }
        ],
        footer: {
          tagline: valueProposition,
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