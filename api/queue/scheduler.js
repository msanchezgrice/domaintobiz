import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Allow GET for testing, POST for webhooks/cron
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔄 Queue scheduler triggered...');

    // Check for pending jobs
    const { data: pendingJobs, error } = await supabase
      .from('site_jobs')
      .select('id, domain, status, created_at')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(5); // Process up to 5 jobs at once

    if (error) {
      throw error;
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No pending jobs',
        processed: 0
      });
    }

    console.log(`📋 Found ${pendingJobs.length} pending jobs`);

    // Process each job by calling the process-jobs endpoint
    const baseUrl = `https://${req.headers.host}`;
    const results = [];

    for (const job of pendingJobs) {
      try {
        console.log(`⚡ Processing job ${job.id} for ${job.domain}...`);
        
        const response = await fetch(`${baseUrl}/api/process-jobs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            jobId: job.id,
            trigger: 'scheduler' 
          })
        });

        const result = await response.json();
        results.push({
          jobId: job.id,
          domain: job.domain,
          success: result.success,
          message: result.message,
          error: result.error
        });

        // Add delay between jobs to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (jobError) {
        console.error(`❌ Failed to process job ${job.id}:`, jobError);
        results.push({
          jobId: job.id,
          domain: job.domain,
          success: false,
          error: jobError.message
        });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`✅ Scheduler completed: ${successful} successful, ${failed} failed`);

    return res.status(200).json({
      success: true,
      message: `Processed ${results.length} jobs`,
      processed: results.length,
      successful,
      failed,
      results
    });

  } catch (error) {
    console.error('❌ Scheduler error:', error);
    return res.status(500).json({
      success: false,
      error: 'Scheduler failed',
      message: error.message
    });
  }
} 