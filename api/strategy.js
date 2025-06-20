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

    const { domainAnalysis, analysisId, regenerate, userComments, projectId } = parsedBody;

    if (!domainAnalysis) {
      return res.status(400).json({ 
        error: 'Please provide domain analysis data' 
      });
    }

    console.log(`🚀 ${regenerate ? 'Regenerating' : 'Generating'} strategy for ${domainAnalysis.domain}`);
    
    if (regenerate && userComments) {
      console.log(`💬 User feedback for regeneration: ${userComments}`);
    }

    // Use the enhanced BusinessStrategyEngine with timeout
    let strategy;
    
    try {
      console.log('🤖 Using BusinessStrategyEngine for strategy generation...');
      
      // Import the BusinessStrategyEngine
      const { BusinessStrategyEngine } = await import('../src/models/BusinessStrategyEngine.js');
      const strategyEngine = new BusinessStrategyEngine();
      
      // Add API-level timeout (50 seconds to stay under Vercel's 60s limit)
      const strategyTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Strategy API timeout after 50 seconds')), 50000);
      });
      
      // Generate strategy with enhanced domain analysis and timeout
      strategy = await Promise.race([
        strategyEngine.generateStrategy(domainAnalysis),
        strategyTimeout
      ]);
      
      // Add regeneration context if provided
      if (regenerate && userComments) {
        strategy.regenerationContext = {
          isRegeneration: true,
          userFeedback: userComments,
          projectId: projectId,
          regeneratedAt: new Date().toISOString()
        };
      }
      
      strategy.timestamp = new Date().toISOString();
      console.log('✅ Strategy generated successfully using BusinessStrategyEngine');
      
    } catch (error) {
      if (error.message.includes('timeout')) {
        console.error('❌ Strategy generation timed out:', error.message);
        console.log('🔄 Using enhanced fallback strategy due to timeout');
      } else {
        console.error('❌ Error generating strategy with BusinessStrategyEngine:', error);
        console.log('🔄 Falling back to basic strategy');
      }
      
      strategy = {
        domain: domainAnalysis.domain,
        businessModel: {
          domainMeaning: `Business based on ${domainAnalysis.domain}`,
          businessConcept: `Service platform for ${domainAnalysis.domain}`,
          type: 'Service Platform',
          industry: 'Professional Services',
          revenueModel: 'subscription',
          revenueStreams: ['Subscription', 'Premium features', 'Consulting'],
          targetMarket: 'Small to medium businesses',
          valueProposition: 'Comprehensive solution for your needs',
          problemSolved: 'Key business challenges'
        },
        brandStrategy: {
          positioning: 'Trusted solution provider',
          brandPromise: 'Exceptional service delivery',
          values: ['trust', 'expertise', 'innovation'],
          personality: ['professional', 'reliable', 'innovative']
        },
        mvpScope: {
          coreFeatures: [
            { name: 'Landing Page', description: 'Professional website presence' },
            { name: 'Contact System', description: 'Customer communication tools' },
            { name: 'Service Showcase', description: 'Display of offerings' },
            { name: 'Analytics', description: 'Performance tracking' }
          ]
        },
        timestamp: new Date().toISOString(),
        fallback: true
      };
      
      if (regenerate && userComments) {
        strategy.regenerationContext = {
          isRegeneration: true,
          userFeedback: userComments,
          projectId: projectId,
          regeneratedAt: new Date().toISOString()
        };
      }
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