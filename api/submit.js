import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
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
    // Validate request body
    if (!req.body) {
      return res.status(400).json({ 
        error: 'Request body is required' 
      });
    }

    // Handle JSON parsing
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

    const { 
      domain, 
      domains, 
      bestDomainData, 
      regenerate, 
      comments, 
      projectId,
      userId 
    } = parsedBody;

    // Support both single domain and domains array
    const targetDomain = domain || (domains && domains[0]);
    
    if (!targetDomain) {
      return res.status(400).json({ 
        error: 'Please provide a domain to generate a site for' 
      });
    }

    console.log(`📋 Enqueueing site generation for: ${targetDomain}`);
    console.log(`🔄 Regeneration: ${!!regenerate}`);
    if (comments) {
      console.log(`💬 User comments: ${comments}`);
    }

    // TODO: Check user quota before enqueueing (for paid plans)
    // if (userId) {
    //   const quota = await getUserQuota(userId);
    //   if (!quota.canGenerate) {
    //     return res.status(403).json({
    //       error: 'Generation limit reached',
    //       quota: quota
    //     });
    //   }
    // }

    // Prepare job data
    const jobData = {
      domain: targetDomain,
      domains: domains || [targetDomain],
      bestDomainData,
      regenerate: !!regenerate,
      comments,
      projectId,
      userId,
      requestOrigin: `https://${req.headers.host}`,
      timestamp: new Date().toISOString()
    };

    // Enqueue the job using our queue function
    const { data: result, error } = await supabase.rpc('enqueue_site_generation', {
      p_domain: targetDomain,
      p_user_id: userId || null,
      p_job_data: jobData
    });

    if (error) {
      console.error('❌ Failed to enqueue job:', error);
      return res.status(500).json({
        error: 'Failed to enqueue site generation',
        message: error.message
      });
    }

    if (!result || result.length === 0) {
      return res.status(500).json({
        error: 'No job ID returned from queue'
      });
    }

    const jobInfo = result[0];
    console.log(`✅ Job enqueued successfully: ${jobInfo.job_id}`);

    // Return job info immediately (202 Accepted)
    return res.status(202).json({
      success: true,
      message: 'Site generation job enqueued successfully',
      jobId: jobInfo.job_id,
      queueJobId: jobInfo.queue_job_id,
      domain: targetDomain,
      status: 'queued',
      estimatedTime: '2-5 minutes',
      regenerate: !!regenerate,
      timestamp: new Date().toISOString(),
      // Include tracking URLs
      statusUrl: `/api/job-status?jobId=${jobInfo.job_id}`,
      progressUrl: `/api/job-progress?jobId=${jobInfo.job_id}`
    });

  } catch (error) {
    console.error('❌ Submit API failed:', {
      message: error.message,
      stack: error.stack,
      requestBody: req.body
    });
    
    return res.status(500).json({ 
      error: 'Failed to submit site generation request', 
      message: error.message
    });
  }
} 