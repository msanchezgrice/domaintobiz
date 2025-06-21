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

CRITICAL REQUIREMENTS - WEBSITE COPYWRITING FOCUS:
1. Create MARKETING COPY, not business descriptions - think like a copywriter, not a business analyst
2. Headlines should be BENEFIT-focused and emotional, not just descriptive
3. Use action words, power words, and benefit-driven language
4. Address PAIN POINTS and promise SOLUTIONS in compelling way
5. Make the target audience feel understood and excited
6. Use persuasive copywriting techniques: curiosity, urgency, social proof
7. Write like you're selling the benefits, not explaining features

EXAMPLES OF GOOD WEBSITE COPY:
- Instead of: "Platform that helps users find opportunities"
- Write: "Never Miss Your Next Big Break"
- Instead of: "SaaS platform for form creation" 
- Write: "Turn Boring Forms Into Engaging Conversations"

TARGET AUDIENCE: ${strategy.businessModel?.targetMarket}
MAIN PROBLEM THEY FACE: ${strategy.businessModel?.problemSolved}
SOLUTION BENEFIT: ${strategy.businessModel?.valueProposition}

${regenerate ? 'This is a REGENERATION - create improved content based on the user feedback above.' : 'This is a NEW GENERATION - create original content.'}

Create persuasive, benefit-focused website copy that makes visitors want to take action immediately.

Return ONLY a valid JSON object with this structure:
{
  "hero": {
    "headline": "Benefit-focused headline that creates desire (e.g. 'Turn Leads Into Loyal Customers', 'Never Miss Your Perfect Opportunity')",
    "subheadline": "Promise-based subheadline that expands the benefit and addresses pain (e.g. 'Stop losing potential customers to boring forms. Create conversations that convert.')",
    "cta": {
      "primary": { "text": "Action-oriented CTA (e.g. 'Start Converting Today', 'Get My Opportunities')", "link": "#signup" },
      "secondary": { "text": "Curiosity-driven secondary CTA (e.g. 'See How It Works', 'Watch Demo')", "link": "#features" }
    }
  },
  "sections": [
    {
      "id": "features",
      "title": "Benefit-focused section title (e.g. 'Why Customers Choose Us', 'What Makes Us Different')",
      "content": "Pain-aware intro that transitions to solution benefits",
      "features": [
        {
          "title": "Benefit-first feature title (e.g. 'Get 3x More Responses', 'Find Opportunities Faster')",
          "description": "Outcome-focused description that explains the result, not just the feature",
          "icon": "relevant-icon"
        }
      ]
    },
    {
      "id": "about", 
      "title": "Story-driven title (e.g. 'Built for Ambitious Professionals', 'Your Success Is Our Mission')",
      "content": "Narrative that connects with target audience's aspirations and challenges"
    }
  ],
  "footer": {
    "tagline": "Memorable brand promise (e.g. 'Your next opportunity awaits', 'Forms that actually work')",
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
      console.error('❌ Content generation failed:', error.message);
      console.log('🚫 NO FALLBACK - Content generation is critical for meaningful websites');
      
      // Do not use fallback content - throw the error to stop the pipeline
      throw new Error(`Content generation failed for ${domain}: ${error.message}`);
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