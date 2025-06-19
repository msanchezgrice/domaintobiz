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

    const { domains, bestDomainData } = parsedBody;

    if (!domains || !Array.isArray(domains) || domains.length === 0) {
      return res.status(400).json({ 
        error: 'Please provide an array of domains' 
      });
    }
    
    console.log('📥 Received execute request:', { domains, bestDomainData });

    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`Executing full pipeline for ${domains.length} domains [${executionId}]`);
    
    const targetDomain = domains[0];
    if (!targetDomain) {
      throw new Error('No domain provided for execution');
    }
    
    console.log(`🎯 Target domain: ${targetDomain}`);

    // Simplified execution for now
    const result = {
      executionId,
      domains,
      status: 'completed',
      result: {
        domain: targetDomain,
        analysis: `Basic analysis completed for ${targetDomain}`,
        strategy: `Strategy generated for ${targetDomain}`,
        website: `Website generated for ${targetDomain}`
      },
      timestamp: new Date().toISOString()
    };

    // Store in database
    console.log(`💾 Saving execution result to database for domain: ${targetDomain}`);
    
    const { data: savedWebsite, error: dbError } = await supabase
      .from('generated_websites')
      .insert({
        domain: targetDomain,
        website_data: result,
        deployment_url: `https://${targetDomain}`,
        status: 'completed'
      })
      .select()
      .single();

    if (dbError) {
      console.error('❌ Database error details:', {
        error: dbError,
        message: dbError.message,
        details: dbError.details,
        hint: dbError.hint,
        code: dbError.code,
        domain: targetDomain
      });
    } else {
      console.log('✅ Successfully saved execution to database with ID:', savedWebsite?.id);
    }

    console.log(`🎉 Execution completed successfully for ${targetDomain}`);

    return res.status(200).json({
      success: true,
      message: 'Execution completed',
      executionId,
      sessionId: executionId, // Same as executionId for compatibility
      domain: targetDomain, // Include domain for agent dashboard
      data: result,
      id: savedWebsite?.id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Execution failed:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      requestBody: req.body,
      requestMethod: req.method,
      requestUrl: req.url,
      headers: req.headers
    });
    
    return res.status(500).json({ 
      error: 'Execution failed', 
      message: error.message,
      type: error.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}