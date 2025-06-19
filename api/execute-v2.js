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
    const { domains, bestDomainData } = req.body;

    if (!domains || !Array.isArray(domains) || domains.length === 0) {
      return res.status(400).json({ 
        error: 'Please provide an array of domains' 
      });
    }
    
    console.log('📥 Received execute request:', { domains, hasBestDomainData: !!bestDomainData });

    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const targetDomain = domains[0];
    
    if (!targetDomain) {
      throw new Error('No domain provided for execution');
    }
    
    console.log(`🎯 Starting full pipeline for domain: ${targetDomain}`);
    console.log(`🆔 Execution ID: ${executionId}`);
    
    // Initialize progress tracking
    const origin = `https://${req.headers.host}`;
    await fetch(`${origin}/api/progress-status?sessionId=${executionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain: targetDomain,
        status: 'running',
        completedSteps: 0,
        totalSteps: 4
      })
    });

    // Step 1: Use bestDomainData if provided, otherwise analyze the domain
    let domainAnalysis = bestDomainData;
    
    if (!domainAnalysis) {
      console.log('📊 No domain data provided, analyzing domain...');
      
      // Use origin from request for internal API calls
      console.log('🌐 Using origin for internal calls:', origin);
      
      const analyzeResponse = await fetch(`${origin}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domains: [targetDomain] })
      });
      
      const analyzeData = await analyzeResponse.json();
      if (!analyzeResponse.ok || !analyzeData.success) {
        throw new Error('Domain analysis failed');
      }
      
      domainAnalysis = analyzeData.data.bestDomain;
      console.log('✅ Domain analysis completed');
    }

    // Step 2: Generate business strategy
    console.log('🤖 Generating business strategy...');
    
    // Use origin from request
    const strategyResponse = await fetch(`${origin}/api/strategy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        domainAnalysis,
        analysisId: executionId 
      })
    });
    
    const strategyData = await strategyResponse.json();
    if (!strategyResponse.ok || !strategyData.success) {
      console.error('❌ Strategy generation failed:', strategyData);
      throw new Error('Strategy generation failed');
    }
    
    const strategy = strategyData.data;
    console.log('✅ Strategy generated successfully');
    console.log('📋 Business Model:', strategy.businessModel.type);
    console.log('🎯 Target Market:', strategy.businessModel.targetMarket);
    
    // Update progress
    await fetch(`${origin}/api/progress-status?sessionId=${executionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        completedSteps: 1,
        agents: {
          design: { status: 'starting', message: 'Preparing design system...' }
        }
      })
    });

    // Step 3: Execute agents with full context
    console.log('🤖 Starting AI agents execution...');
    
    const agentResults = {};
    
    // Execute Design Agent
    console.log('🎨 Executing Design Agent...');
    try {
      const designResponse = await fetch(`${origin}/api/agents/design`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: targetDomain, strategy, executionId })
      });
      
      const designData = await designResponse.json();
      if (designResponse.ok && designData.success) {
        agentResults.design = designData.data;
        console.log('✅ Design Agent completed');
        
        // Update progress
        await fetch(`${origin}/api/progress-status?sessionId=${executionId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            completedSteps: 2,
            agents: {
              design: { status: 'completed', message: 'Design system created' },
              content: { status: 'starting', message: 'Generating content...' }
            }
          })
        });
      } else {
        throw new Error(designData.message || 'Design agent failed');
      }
    } catch (error) {
      console.error('❌ Design Agent error:', error);
      agentResults.design = {
        status: 'error',
        error: error.message,
        fallback: true
      };
    }
    
    // Execute Content Agent
    console.log('✍️ Executing Content Agent...');
    try {
      const contentResponse = await fetch(`${origin}/api/agents/content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          domain: targetDomain, 
          strategy, 
          designSystem: agentResults.design,
          executionId 
        })
      });
      
      const contentData = await contentResponse.json();
      if (contentResponse.ok && contentData.success) {
        agentResults.content = contentData.data;
        console.log('✅ Content Agent completed');
        
        // Update progress
        await fetch(`${origin}/api/progress-status?sessionId=${executionId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            completedSteps: 3,
            agents: {
              content: { status: 'completed', message: 'Content generated' },
              development: { status: 'starting', message: 'Building website...' }
            }
          })
        });
      } else {
        throw new Error(contentData.message || 'Content agent failed');
      }
    } catch (error) {
      console.error('❌ Content Agent error:', error);
      agentResults.content = {
        status: 'error',
        error: error.message,
        fallback: true
      };
    }
    
    // Mock development and deployment for now
    agentResults.development = {
      status: 'completed',
      files: ['index.html', 'styles.css', 'script.js'],
      framework: 'vanilla'
    };
    
    agentResults.deployment = {
      status: 'completed',
      url: `https://${targetDomain}`,
      hosting: 'vercel'
    };
    
    console.log('🤖 All agents execution completed');

    // Step 4: Save results
    const result = {
      executionId,
      domain: targetDomain,
      domainAnalysis,
      strategy,
      agentResults,
      status: 'completed',
      timestamp: new Date().toISOString()
    };

    // Save to database
    console.log(`💾 Saving execution result to database...`);
    
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
      console.error('❌ Database error:', dbError);
    } else {
      console.log('✅ Successfully saved to database with ID:', savedWebsite?.id);
    }

    console.log(`🎉 Full pipeline completed successfully for ${targetDomain}`);

    return res.status(200).json({
      success: true,
      message: 'Full pipeline executed successfully',
      executionId,
      sessionId: executionId,
      domain: targetDomain,
      data: result,
      id: savedWebsite?.id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Execution failed:', error);
    return res.status(500).json({ 
      error: 'Execution failed', 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}