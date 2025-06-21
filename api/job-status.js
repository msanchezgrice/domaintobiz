import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { jobId } = req.query;

    if (!jobId) {
      return res.status(400).json({ 
        error: 'Job ID is required' 
      });
    }

    console.log(`📊 Getting status for job: ${jobId}`);

    // Get main job status
    const { data: job, error: jobError } = await supabase
      .from('site_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError) {
      if (jobError.code === 'PGRST116') {
        return res.status(404).json({
          error: 'Job not found'
        });
      }
      throw new Error(`Job query error: ${jobError.message}`);
    }

    // Get progress steps
    const { data: progress, error: progressError } = await supabase
      .from('site_job_progress')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true });

    if (progressError) {
      throw new Error(`Progress query error: ${progressError.message}`);
    }

    // Get generated site if completed
    let generatedSite = null;
    if (job.status === 'completed') {
      const { data: site, error: siteError } = await supabase
        .from('sites')
        .select('*')
        .eq('job_id', jobId)
        .single();

      if (!siteError) {
        generatedSite = site;
      }
    }

    // Calculate overall progress
    const totalSteps = ['analyze', 'strategy', 'design', 'content', 'build', 'deploy'];
    const completedSteps = progress.filter(p => p.status === 'completed').length;
    const overallProgress = Math.round((completedSteps / totalSteps.length) * 100);

    // Get current step
    const currentStep = progress.find(p => p.status === 'running')?.step_name || 
                      (job.status === 'queued' ? 'queued' : 'completed');

    const response = {
      jobId: job.id,
      domain: job.domain,
      status: job.status,
      currentStep,
      overallProgress,
      estimatedTimeRemaining: getEstimatedTime(job.status, overallProgress),
      createdAt: job.created_at,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      errorMessage: job.error_message,
      
      // Progress details
      steps: progress.map(p => ({
        name: p.step_name,
        status: p.status,
        progress: p.progress_percentage,
        message: p.message,
        completedAt: p.created_at
      })),

      // Results (if completed)
      result: job.result_data,
      generatedSite,
      
      // Metadata
      isRegeneration: job.job_data?.regenerate || false,
      originalRequestData: job.job_data,
      
      timestamp: new Date().toISOString()
    };

    return res.status(200).json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('❌ Job status API failed:', error);
    
    return res.status(500).json({ 
      error: 'Failed to get job status', 
      message: error.message
    });
  }
}

function getEstimatedTime(status, progress) {
  if (status === 'completed' || status === 'failed') {
    return 0;
  }
  
  if (status === 'queued') {
    return 300; // 5 minutes
  }
  
  // Estimate based on progress
  const remaining = 100 - progress;
  return Math.max(30, Math.round(remaining * 2)); // 2 seconds per percent, minimum 30s
} 