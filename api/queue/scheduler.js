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

  const startTime = Date.now();
  
  try {
    console.log('🔄 Queue scheduler triggered...', {
      method: req.method,
      trigger: req.body?.trigger || 'manual',
      timestamp: new Date().toISOString()
    });

    // Check for pending jobs with a shorter timeout
    const { data: pendingJobs, error } = await supabase
      .from('site_jobs')
      .select('id, domain, status, created_at')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(3); // Reduced to 3 jobs to avoid timeouts

    if (error) {
      console.error('❌ Database error:', error);
      throw error;
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      console.log('📋 No pending jobs found');
      return res.status(200).json({
        success: true,
        message: 'No pending jobs',
        processed: 0,
        executionTime: Date.now() - startTime
      });
    }

    console.log(`📋 Found ${pendingJobs.length} pending jobs:`, 
      pendingJobs.map(j => ({ id: j.id.substring(0, 8), domain: j.domain }))
    );

    // Get the base URL for API calls
    const baseUrl = req.headers.host?.includes('localhost') 
      ? `http://${req.headers.host}`
      : `https://${req.headers.host}`;

    const results = [];
    const maxProcessingTime = 8000; // 8 seconds to stay under Vercel limit

    // Process jobs with time limit
    for (const job of pendingJobs) {
      const elapsed = Date.now() - startTime;
      if (elapsed > maxProcessingTime) {
        console.log(`⏰ Time limit reached, stopping processing (${elapsed}ms)`);
        break;
      }

      try {
        console.log(`⚡ Processing job ${job.id.substring(0, 8)} for ${job.domain}...`);
        
        // Use shorter timeout for individual job processing
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5-second timeout

        const response = await fetch(`${baseUrl}/api/process-jobs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            jobId: job.id,
            trigger: 'scheduler',
            timeout: 4000 // Shorter processing timeout
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const result = await response.json();
          results.push({
            jobId: job.id.substring(0, 8),
            domain: job.domain,
            success: true,
            message: result.message || 'Processing started'
          });
          console.log(`✅ Job ${job.id.substring(0, 8)} processed successfully`);
        } else {
          const errorText = await response.text();
          results.push({
            jobId: job.id.substring(0, 8),
            domain: job.domain,
            success: false,
            error: `HTTP ${response.status}: ${errorText}`
          });
          console.log(`❌ Job ${job.id.substring(0, 8)} failed: ${response.status}`);
        }

        // Small delay between jobs
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (jobError) {
        console.error(`❌ Failed to process job ${job.id.substring(0, 8)}:`, jobError.message);
        results.push({
          jobId: job.id.substring(0, 8),
          domain: job.domain,
          success: false,
          error: jobError.name === 'AbortError' ? 'Request timeout' : jobError.message
        });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const executionTime = Date.now() - startTime;

    console.log(`✅ Scheduler completed: ${successful} successful, ${failed} failed (${executionTime}ms)`);

    return res.status(200).json({
      success: true,
      message: `Processed ${results.length} jobs`,
      processed: results.length,
      successful,
      failed,
      executionTime,
      results,
      queueInfo: {
        totalPending: pendingJobs.length,
        processed: results.length,
        remaining: Math.max(0, pendingJobs.length - results.length)
      }
    });

  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error('❌ Scheduler error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Scheduler failed',
      message: error.message,
      executionTime
    });
  }
} 