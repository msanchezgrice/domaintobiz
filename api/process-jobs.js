import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🚀 Starting job processor...');

    // Query for the next queued job
    const { data: jobs, error } = await supabase
      .from('site_jobs')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1);

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    if (!jobs || jobs.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No jobs in queue',
        processed: 0
      });
    }

    const job = jobs[0];
    console.log(`📋 Processing job ${job.id} for domain: ${job.domain}`);

    // Mark job as processing
    await supabase
      .from('site_jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .eq('id', job.id);

    // Process the job (simplified for Vercel's time limits)
    const result = await processJobSteps(job);

    // Mark job as completed
    await supabase
      .from('site_jobs')
      .update({
        status: result.success ? 'completed' : 'failed',
        result_data: result.data,
        error_message: result.error,
        completed_at: new Date().toISOString()
      })
      .eq('id', job.id);

    return res.status(200).json({
      success: true,
      message: `Job ${job.id} ${result.success ? 'completed' : 'failed'}`,
      jobId: job.id,
      domain: job.domain,
      result: result
    });

  } catch (error) {
    console.error('❌ Job processor error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

async function processJobSteps(job) {
  try {
    const domain = job.domain;
    const jobData = job.job_data || {};

    console.log(`🔄 Processing ${domain}...`);

    // Step 1: Domain Analysis (call existing API)
    const analysisResponse = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domains: [domain] })
    });

    if (!analysisResponse.ok) {
      throw new Error(`Domain analysis failed: ${analysisResponse.status}`);
    }

    const analysisData = await analysisResponse.json();
    const domainAnalysis = analysisData.data?.bestDomain;

    // Step 2: Strategy Generation
    const strategyResponse = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/strategy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domainAnalysis,
        analysisId: `vercel_${Date.now()}`,
        regenerate: jobData.regenerate || false
      })
    });

    if (!strategyResponse.ok) {
      throw new Error(`Strategy generation failed: ${strategyResponse.status}`);
    }

    const strategyData = await strategyResponse.json();

    // Step 3: Design Generation
    const designResponse = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/agents/design`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain,
        strategy: strategyData.data,
        executionId: `vercel_${Date.now()}`
      })
    });

    if (!designResponse.ok) {
      throw new Error(`Design generation failed: ${designResponse.status}`);
    }

    const designData = await designResponse.json();

    // Step 4: Content Generation
    const contentResponse = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/agents/content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain,
        strategy: strategyData.data,
        designSystem: designData.data,
        executionId: `vercel_${Date.now()}`
      })
    });

    if (!contentResponse.ok) {
      throw new Error(`Content generation failed: ${contentResponse.status}`);
    }

    const contentData = await contentResponse.json();

    // Step 5: Website Generation (final step)
    const websiteResponse = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/generate-website`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain,
        strategy: strategyData.data,
        designSystem: designData.data,
        websiteContent: contentData.data,
        executionId: `vercel_${Date.now()}`
      })
    });

    if (!websiteResponse.ok) {
      throw new Error(`Website generation failed: ${websiteResponse.status}`);
    }

    const websiteData = await websiteResponse.json();

    return {
      success: true,
      data: {
        domain,
        domainAnalysis,
        strategy: strategyData.data,
        design: designData.data,
        content: contentData.data,
        website: websiteData.data,
        completedAt: new Date().toISOString()
      }
    };

  } catch (error) {
    console.error(`❌ Job processing failed:`, error);
    return {
      success: false,
      error: error.message,
      failedAt: new Date().toISOString()
    };
  }
} 