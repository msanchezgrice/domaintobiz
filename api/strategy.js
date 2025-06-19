import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

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

    const { domainAnalysis, analysisId } = parsedBody;

    if (!domainAnalysis) {
      return res.status(400).json({ 
        error: 'Please provide domain analysis data' 
      });
    }

    console.log(`🚀 Generating strategy for ${domainAnalysis.domain}`);

    // Real AI strategy generation
    let strategy;
    
    try {
      if (!process.env.OPENAI_API_KEY) {
        console.log('⚠️ No OpenAI API key - using mock strategy');
        strategy = {
          domain: domainAnalysis.domain,
          businessModel: {
            type: 'SaaS',
            description: `Business strategy for ${domainAnalysis.domain}`
          },
          brandStrategy: {
            positioning: 'Premium solution',
            targetAudience: 'Tech-savvy professionals'
          },
          mvpScope: {
            features: ['Landing page', 'Contact form', 'Basic analytics']
          },
          timestamp: new Date().toISOString()
        };
      } else {
        console.log('🤖 Calling OpenAI for strategy generation...');
        
        const { OpenAI } = await import('openai');
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY
        });

        const prompt = `
You are an expert business strategist. Analyze the domain "${domainAnalysis.domain}" and create a comprehensive business strategy.

CRITICAL: First deeply analyze the domain name semantics and meaning:

Domain Name Analysis:
- Domain: ${domainAnalysis.domain}
- Core meaning: Analyze what this domain name suggests about the business
- Target market implications from the domain name
- Brand positioning implied by the domain

Create a detailed business strategy that aligns perfectly with the domain name meaning.

Return ONLY a valid JSON object with this exact structure:
{
  "domain": "${domainAnalysis.domain}",
  "businessModel": {
    "type": "SaaS|E-commerce|Marketplace|Service|Media|Other",
    "description": "Detailed business model description",
    "revenueStreams": ["stream1", "stream2", "stream3"],
    "targetMarket": "Specific target market description"
  },
  "brandStrategy": {
    "positioning": "Brand positioning statement",
    "uniqueValue": "Unique value proposition",
    "targetAudience": "Detailed target audience",
    "brandPersonality": "Brand personality description"
  },
  "mvpScope": {
    "features": ["feature1", "feature2", "feature3", "feature4", "feature5"],
    "timeline": "Development timeline estimate",
    "budget": "Estimated budget range"
  },
  "marketAnalysis": {
    "competitors": ["competitor1", "competitor2", "competitor3"],
    "marketSize": "Market size estimate",
    "opportunity": "Market opportunity description"
  }
}`;

        console.log('📤 Sending prompt to OpenAI...');
        
        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are a world-class business strategist and domain expert. Always respond with valid JSON only."
            },
            {
              role: "user", 
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 2000
        });

        console.log('📥 OpenAI response received');
        const responseText = completion.choices[0].message.content;
        console.log('🔍 Full OpenAI response:');
        console.log('='.repeat(80));
        console.log(responseText);
        console.log('='.repeat(80));
        
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
          
          strategy = JSON.parse(cleanedResponse);
          strategy.timestamp = new Date().toISOString();
          
          console.log('✅ Successfully parsed strategy from OpenAI');
          console.log('📊 Full parsed strategy:', JSON.stringify(strategy, null, 2));
        } catch (parseError) {
          console.error('❌ Failed to parse OpenAI response as JSON:', parseError);
          console.log('🔍 Raw response:', responseText);
          console.log('🔄 Attempting to extract JSON from response...');
          
          // Try to extract JSON from response if wrapped in markdown
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              strategy = JSON.parse(jsonMatch[0]);
              strategy.timestamp = new Date().toISOString();
              console.log('✅ Successfully extracted and parsed JSON from response');
              console.log('📊 Extracted strategy:', JSON.stringify(strategy, null, 2));
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
      console.error('❌ Error generating strategy:', error);
      console.log('🔄 Falling back to mock strategy');
      
      strategy = {
        domain: domainAnalysis.domain,
        businessModel: {
          type: 'SaaS',
          description: `Business strategy for ${domainAnalysis.domain}`,
          revenueStreams: ['Subscription', 'Premium features', 'Consulting'],
          targetMarket: 'Small to medium businesses'
        },
        brandStrategy: {
          positioning: 'Premium solution',
          uniqueValue: 'Advanced automation and AI',
          targetAudience: 'Tech-savvy professionals',
          brandPersonality: 'Innovative and reliable'
        },
        mvpScope: {
          features: ['Landing page', 'User authentication', 'Core functionality', 'Analytics dashboard', 'Payment integration'],
          timeline: '3-6 months',
          budget: '$50k-$100k'
        },
        marketAnalysis: {
          competitors: ['TBD based on research'],
          marketSize: 'Multi-billion dollar market',
          opportunity: 'Growing demand for AI solutions'
        },
        timestamp: new Date().toISOString(),
        fallback: true
      };
    }

    // Try to store in database (but don't fail if it doesn't work)
    let savedStrategy = null;
    try {
      console.log('💾 Attempting to save strategy to database...');
      console.log('📊 Data to save:', {
        analysis_id: analysisId,
        domain: domainAnalysis.domain,
        strategyKeys: Object.keys(strategy)
      });
      
      const { data, error: dbError } = await supabase
        .from('business_strategies')
        .insert({
          analysis_id: analysisId?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) ? analysisId : null,
          domain: domainAnalysis.domain,
          strategy
        })
        .select()
        .single();

      if (dbError) {
        console.error('❌ Database error details:', {
          error: dbError,
          message: dbError.message,
          details: dbError.details,
          hint: dbError.hint,
          code: dbError.code
        });
        console.log('📝 Continuing without database save');
      } else {
        savedStrategy = data;
        console.log('✅ Successfully saved strategy to database with ID:', savedStrategy?.id);
      }
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      console.log('📝 Continuing without database save');
    }

    console.log('🎯 Strategy generation completed successfully');

    return res.status(200).json({
      success: true,
      data: strategy,
      id: savedStrategy?.id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Strategy generation failed:', error);
    return res.status(500).json({ 
      error: 'Strategy generation failed', 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}