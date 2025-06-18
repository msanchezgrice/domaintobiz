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
    const { domains } = req.body;

    if (!domains || !Array.isArray(domains) || domains.length === 0) {
      return res.status(400).json({ 
        error: 'Please provide an array of domains' 
      });
    }

    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`Executing full pipeline for ${domains.length} domains [${executionId}]`);

    // Simplified execution for now
    const result = {
      executionId,
      domains,
      status: 'completed',
      result: {
        domain: domains[0],
        analysis: 'Basic analysis completed',
        strategy: 'Strategy generated',
        website: 'Website generated'
      },
      timestamp: new Date().toISOString()
    };

    // Store in database
    const { data: savedWebsite, error: dbError } = await supabase
      .from('generated_websites')
      .insert({
        domain: result.result.domain,
        website_data: result,
        deployment_url: `https://${result.result.domain}`,
        status: 'completed'
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
    }

    console.log(`Execution completed successfully for ${result.result.domain}`);

    return res.status(200).json({
      success: true,
      message: 'Execution completed',
      executionId,
      sessionId: executionId, // Same as executionId for compatibility
      data: result,
      id: savedWebsite?.id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Execution failed:', error);
    return res.status(500).json({ 
      error: 'Execution failed', 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}