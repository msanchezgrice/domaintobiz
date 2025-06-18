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
    const { domainAnalysis, analysisId } = req.body;

    if (!domainAnalysis) {
      return res.status(400).json({ 
        error: 'Please provide domain analysis data' 
      });
    }

    console.log(`Generating strategy for ${domainAnalysis.domain}`);

    // Simple strategy generation without complex imports for now
    const strategy = {
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

    // Store in database
    const { data: savedStrategy, error: dbError } = await supabase
      .from('business_strategies')
      .insert({
        analysis_id: analysisId,
        domain: domainAnalysis.domain,
        strategy
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
    }

    console.log('Strategy generation completed');

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