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

    // Enqueue the job using our working custom function
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
    console.log(`✅ Job enqueued successfully: ${jobInfo.job_id} (msg: ${jobInfo.queue_msg_id})`);

    // Return success response immediately
    const response = {
      success: true,
      jobId: jobInfo.job_id,
      message: `Job created for domain: ${targetDomain}`,
      domain: targetDomain,
      estimatedCompletion: '2-5 minutes',
      status: 'queued',
      statusUrl: `/api/job-status?jobId=${jobInfo.job_id}`,
      progressUrl: `/api/job-progress?jobId=${jobInfo.job_id}`
    };

    // Trigger background processing (non-blocking)
    triggerJobProcessing().catch(error => {
      console.error('Background processing trigger failed:', error);
      // Don't fail the request - just log the error
    });

    return res.status(202).json(response);

  } catch (error) {
    console.error('Submit error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to submit job',
      message: error.message
    });
  }
}

// Function to trigger background job processing
async function triggerJobProcessing() {
  try {
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'https://domaintobiz.vercel.app';
    
    console.log('🚀 Triggering queue scheduler...');
    
    // Trigger the queue scheduler (don't wait for response)
    fetch(`${baseUrl}/api/queue/scheduler`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger: 'submit' })
    }).catch(error => {
      console.error('Failed to trigger scheduler:', error);
    });
    
  } catch (error) {
    console.error('Background trigger error:', error);
  }
} 