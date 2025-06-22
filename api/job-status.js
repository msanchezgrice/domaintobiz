import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Validate UUID format
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

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
        error: 'Job ID is required',
        message: 'Please provide a valid job ID in the jobId parameter',
        example: '/api/job-status?jobId=123e4567-e89b-12d3-a456-426614174000'
      });
    }

    // Validate UUID format
    if (!isValidUUID(jobId)) {
      return res.status(400).json({
        error: 'Invalid job ID format',
        message: 'Job ID must be a valid UUID format',
        provided: jobId,
        example: '123e4567-e89b-12d3-a456-426614174000'
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
      console.error('❌ Job query error:', jobError);
      
      if (jobError.code === 'PGRST116') {
        return res.status(404).json({
          error: 'Job not found',
          message: `No job found with ID: ${jobId}`,
          suggestion: 'Check that the job ID is correct and the job was created successfully'
        });
      }
      
      return res.status(500).json({
        error: 'Failed to get job status',
        message: 'Database query failed',
        details: jobError.message
      });
    }

    // Get progress steps
    const { data: progress, error: progressError } = await supabase
      .from('site_job_progress')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true });

    if (progressError) {
      console.error('❌ Progress query error:', progressError);
      // Don't fail the request, just log the error
      console.log('Continuing without progress data...');
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
    const completedSteps = progress?.filter(p => p.status === 'completed').length || 0;
    const overallProgress = Math.round((completedSteps / totalSteps.length) * 100);

    // Get current step
    const currentStep = progress?.find(p => p.status === 'running')?.step_name || 
                      (job.status === 'queued' ? 'queued' : 
                       job.status === 'processing' ? 'processing' : 'completed');

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
      steps: progress?.map(p => ({
        name: p.step_name,
        status: p.status,
        progress: p.progress_percentage,
        message: p.message,
        completedAt: p.created_at
      })) || [],

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
      message: error.message,
      suggestion: 'Please try again or contact support if the issue persists'
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