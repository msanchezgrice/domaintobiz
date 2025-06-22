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
    const baseUrl = 'https://domaintobiz.vercel.app';

    console.log(`🔄 [${domain}] Step 1: Domain Analysis`);
    const analysisResponse = await fetch(`${baseUrl}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domains: [domain] })
    });
    if (!analysisResponse.ok) throw new Error(`Domain analysis failed: ${analysisResponse.status}`);
    const analysisData = await analysisResponse.json();
    const domainAnalysis = analysisData.data?.bestDomain;
    
    console.log(`🔄 [${domain}] Step 2: Strategy Generation`);
    const strategyResponse = await fetch(`${baseUrl}/api/strategy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domainAnalysis, analysisId: `vercel_${Date.now()}` })
    });
    if (!strategyResponse.ok) throw new Error(`Strategy generation failed: ${strategyResponse.status}`);
    const strategyData = await strategyResponse.json();

    console.log(`🔄 [${domain}] Step 3: Design Generation`);
    const designResponse = await fetch(`${baseUrl}/api/agents/design`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, strategy: strategyData.data, executionId: `vercel_${Date.now()}` })
    });
    if (!designResponse.ok) throw new Error(`Design generation failed: ${designResponse.status}`);
    const designData = await designResponse.json();

    console.log(`🔄 [${domain}] Step 4: Content Generation`);
    const contentResponse = await fetch(`${baseUrl}/api/agents/content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain,
        strategy: strategyData.data,
        designSystem: designData.data,
        executionId: `vercel_${Date.now()}`
      })
    });
    if (!contentResponse.ok) throw new Error(`Content generation failed: ${contentResponse.status}`);
    const contentData = await contentResponse.json();

    console.log(`🔄 [${domain}] Step 5: Website Generation`);
    const websiteResponse = await fetch(`${baseUrl}/api/generate-website`, {
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
    if (!websiteResponse.ok) throw new Error(`Website generation failed with status ${websiteResponse.status}`);
    const websiteData = await websiteResponse.json();

    if (!websiteData.success) {
        throw new Error(`Website generation failed: ${websiteData.message || 'Unknown error'}`);
    }

    console.log(`✅ [${domain}] Website generated, URL: ${websiteData.data.deploymentUrl}`);
    
    // Insert into public 'sites' table to update the UI
    await supabase.from('sites').insert({
        job_id: job.id,
        domain: domain,
        deployed_url: websiteData.data.deploymentUrl,
    }).onConflict('domain').merge();
    
    console.log(`✅ [${domain}] 'sites' table updated.`);

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
    console.error(`❌ [${job.domain}] Job processing failed:`, error);
    return {
      success: false,
      error: error.message,
      failedAt: new Date().toISOString()
    };
  }
} 