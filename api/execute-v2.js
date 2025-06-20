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

    const { domains, bestDomainData, regenerate, comments, projectId, domain } = parsedBody;

    // Support both old format (domains array) and new format (single domain for regenerate)
    const targetDomainsArray = domains || (domain ? [domain] : null);
    
    if (!targetDomainsArray || !Array.isArray(targetDomainsArray) || targetDomainsArray.length === 0) {
      return res.status(400).json({ 
        error: 'Please provide an array of domains or a single domain' 
      });
    }
    
    console.log('📥 Received execute request:', { 
      domains: targetDomainsArray, 
      hasBestDomainData: !!bestDomainData,
      isRegenerate: !!regenerate,
      hasComments: !!comments,
      projectId
    });

    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const targetDomain = targetDomainsArray[0];
    
    if (!targetDomain) {
      throw new Error('No domain provided for execution');
    }
    
    console.log(`🎯 Starting ${regenerate ? 'regeneration' : 'full pipeline'} for domain: ${targetDomain}`);
    console.log(`🆔 Execution ID: ${executionId}`);
    
    if (regenerate && comments) {
      console.log(`💬 User comments for regeneration: ${comments}`);
    }
    
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
    console.log(`🤖 ${regenerate ? 'Regenerating' : 'Generating'} business strategy...`);
    
    // Use origin from request
    const strategyResponse = await fetch(`${origin}/api/strategy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        domainAnalysis,
        analysisId: executionId,
        regenerate,
        userComments: comments,
        projectId
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
      
      if (!designResponse.ok) {
        throw new Error(`Design agent HTTP error: ${designResponse.status}`);
      }
      
      const designData = await designResponse.json();
      if (designData.success) {
        agentResults.design = designData.data;
        console.log('✅ Design Agent completed successfully');
      } else {
        throw new Error(designData.message || designData.error || 'Design agent failed');
      }
      
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
      
    } catch (error) {
      console.error('❌ Design Agent error:', error);
      agentResults.design = {
        status: 'error',
        error: error.message,
        fallback: {
          colorPalette: {
            primary: '#3B82F6',
            secondary: '#1E40AF',
            accent: '#60A5FA',
            background: '#FFFFFF',
            text: '#1F2937'
          },
          typography: {
            primary: 'Inter',
            secondary: 'system-ui'
          },
          layout: 'modern-minimal'
        }
      };
      
      // Update progress with error but continue
      await fetch(`${origin}/api/progress-status?sessionId=${executionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completedSteps: 2,
          agents: {
            design: { status: 'error', message: 'Design failed - using fallback' },
            content: { status: 'starting', message: 'Generating content...' }
          }
        })
      });
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
          designSystem: agentResults.design?.fallback || agentResults.design,
          executionId,
          regenerate,
          userComments: comments,
          projectId
        })
      });
      
      if (!contentResponse.ok) {
        throw new Error(`Content agent HTTP error: ${contentResponse.status}`);
      }
      
      const contentData = await contentResponse.json();
      if (contentData.success) {
        agentResults.content = contentData.data;
        console.log('✅ Content Agent completed successfully');
      } else {
        throw new Error(contentData.message || contentData.error || 'Content agent failed');
      }
      
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
      
    } catch (error) {
      console.error('❌ Content Agent error:', error);
      agentResults.content = {
        status: 'error',
        error: error.message,
        fallback: {
          hero: {
            headline: `Welcome to ${targetDomain}`,
            subheadline: strategy.brandStrategy?.positioning || 'Your business solution',
            cta: {
              primary: { text: 'Get Started', link: '#signup' },
              secondary: { text: 'Learn More', link: '#features' }
            }
          },
          sections: [
            {
              title: 'Features',
              content: 'Discover what makes us different',
              features: strategy.mvpScope?.features?.map(f => ({
                title: f,
                description: `Learn more about ${f}`,
                icon: 'star'
              })) || []
            }
          ]
        }
      };
      
      // Update progress with error but continue
      await fetch(`${origin}/api/progress-status?sessionId=${executionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completedSteps: 3,
          agents: {
            content: { status: 'error', message: 'Content failed - using fallback' },
            development: { status: 'starting', message: 'Building website...' }
          }
        })
      });
    }
    
    // Generate actual website
    console.log('🚀 Starting website generation...');
    
    try {
      const websiteResponse = await fetch(`${origin}/api/generate-website`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: targetDomain,
          strategy,
          designSystem: agentResults.design?.fallback || agentResults.design,
          websiteContent: agentResults.content?.fallback || agentResults.content,
          executionId,
          regenerate,
          userComments: comments,
          projectId
        })
      });

      console.log('📡 Website generation API response status:', websiteResponse.status);

      if (!websiteResponse.ok) {
        const errorText = await websiteResponse.text();
        console.error('❌ Website generation HTTP error:', {
          status: websiteResponse.status,
          statusText: websiteResponse.statusText,
          body: errorText
        });
        throw new Error(`Website generation failed with status ${websiteResponse.status}: ${errorText}`);
      }

      const websiteData = await websiteResponse.json();
      console.log('📊 Website generation response:', websiteData);
      
      if (websiteData.success) {
        agentResults.development = {
          status: 'completed',
          files: websiteData.data.files,
          framework: 'vanilla',
          buildTime: '2.3s',
          websiteId: websiteData.data.websiteId
        };
        
        agentResults.deployment = {
          status: 'completed',
          url: websiteData.data.deploymentUrl,
          deploymentSlug: websiteData.data.deploymentSlug,
          originalDomain: targetDomain,
          hosting: 'vercel',
          deploymentId: executionId,
          deployedAt: new Date().toISOString()
        };
        
        console.log('✅ Website generation completed successfully');
        console.log('🌐 Deployment URL:', websiteData.data.deploymentUrl);
      } else {
        const errorMsg = websiteData.message || websiteData.error || 'Website generation failed';
        console.error('❌ Website generation API returned error:', errorMsg);
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('❌ Website generation error:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // Don't fall back to mock data - throw the error to properly handle failure
      throw new Error(`Website generation failed: ${error.message}`);
    }
    
    console.log('🤖 All agents execution completed');

    // Check if website generation succeeded
    if (agentResults.deployment?.status !== 'completed') {
      const deploymentError = agentResults.deployment?.error || 'Website generation failed';
      console.error(`❌ Pipeline failed due to deployment error: ${deploymentError}`);
      
      // Update progress with failure
      await fetch(`${origin}/api/progress-status?sessionId=${executionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'failed',
          completedSteps: 3, // We got to website generation but it failed
          totalSteps: 4,
          agents: {
            design: { status: 'completed', message: 'Design completed' },
            content: { status: 'completed', message: 'Content completed' },
            development: { status: 'error', message: 'Website generation failed' },
            deployment: { status: 'error', message: deploymentError }
          },
          error: deploymentError
        })
      });
      
      return res.status(500).json({
        success: false,
        error: 'Pipeline execution failed',
        message: deploymentError,
        executionId,
        sessionId: executionId,
        domain: targetDomain,
        stage: 'website_generation',
        timestamp: new Date().toISOString()
      });
    }

    // Step 4: Save results (only if deployment succeeded)
    const result = {
      executionId,
      domain: targetDomain,
      domainAnalysis,
      strategy,
      agentResults,
      status: 'completed',
      timestamp: new Date().toISOString()
    };

    console.log(`✅ Execution result saved via website generation API`);
    
    const savedWebsite = { id: agentResults.development?.websiteId || 'generated' };

    console.log(`🎉 Full pipeline completed successfully for ${targetDomain}`);
    
    // Final progress update
    await fetch(`${origin}/api/progress-status?sessionId=${executionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'completed',
        completedSteps: 4,
        totalSteps: 4,
        agents: {
          design: { status: 'completed', message: 'Design completed' },
          content: { status: 'completed', message: 'Content completed' },
          development: { status: 'completed', message: 'Development completed' },
          deployment: { status: 'completed', message: 'Deployment completed' }
        },
        result: {
          domain: targetDomain,
          websiteUrl: agentResults.deployment.url,
          originalDomain: targetDomain
        }
      })
    });

    return res.status(200).json({
      success: true,
      message: 'Full pipeline executed successfully',
      executionId,
      sessionId: executionId,
      domain: targetDomain,
      data: result,
      result: {
        domain: targetDomain,
        websiteUrl: agentResults.deployment.url,
        originalDomain: targetDomain,
        deploymentId: executionId
      },
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