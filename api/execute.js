import { DomainAnalyzer } from '../src/analyzers/DomainAnalyzer.js';
import { BusinessStrategyEngine } from '../src/models/BusinessStrategyEngine.js';
import { AgentOrchestrator } from '../src/agents/AgentOrchestrator.js';
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

    // Initialize services
    const domainAnalyzer = new DomainAnalyzer();
    const strategyEngine = new BusinessStrategyEngine();
    const agentOrchestrator = new AgentOrchestrator();

    // Step 1: Domain Analysis
    console.log('Step 1: Analyzing domains');
    const analysis = await domainAnalyzer.analyzeDomains(domains);
    
    const bestDomain = analysis.bestDomain;
    if (!bestDomain || bestDomain.error) {
      throw new Error('No suitable domain found in analysis');
    }

    // Step 2: Business Strategy Generation
    console.log('Step 2: Generating business strategy');
    const strategy = await strategyEngine.generateStrategy(bestDomain);

    // Step 3: Website Creation
    console.log('Step 3: Creating website');
    const result = await agentOrchestrator.executePlan(strategy);

    // Store in database
    const { data: savedWebsite, error: dbError } = await supabase
      .from('generated_websites')
      .insert({
        domain: bestDomain.domain,
        website_data: {
          analysis,
          strategy,
          result
        },
        deployment_url: result.websiteUrl,
        status: 'completed'
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
    }

    console.log(`Execution completed successfully for ${bestDomain.domain}`);

    return res.status(200).json({
      success: true,
      message: 'Execution completed',
      executionId,
      data: {
        domain: bestDomain.domain,
        websiteUrl: result.websiteUrl,
        strategy,
        id: savedWebsite?.id
      },
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