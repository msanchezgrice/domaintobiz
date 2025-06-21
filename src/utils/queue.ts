import { createClient } from '@supabase/supabase-js';

// Database types for our queue system
export interface SiteJob {
  id: string;
  domain: string;
  user_id?: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  job_data: any;
  result_data?: any;
  error_message?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  worker_id?: string;
}

export interface SiteJobProgress {
  id: string;
  job_id: string;
  step_name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress_percentage: number;
  message?: string;
  step_data?: any;
  created_at: string;
}

export interface EnqueueResult {
  jobId: string;
  queueJobId: string;
}

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

/**
 * Enqueue a site generation job
 */
export async function enqueueSiteGeneration(
  domain: string,
  userId?: string,
  jobData: any = {}
): Promise<EnqueueResult> {
  try {
    console.log(`📋 Enqueueing site generation for: ${domain}`);
    
    const { data, error } = await supabase.rpc('enqueue_site_generation', {
      p_domain: domain,
      p_user_id: userId || null,
      p_job_data: jobData
    });

    if (error) {
      console.error('❌ Failed to enqueue job:', error);
      throw new Error(`Queue error: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error('No job ID returned from queue');
    }

    const result = data[0];
    console.log(`✅ Job enqueued: ${result.job_id}`);
    
    return {
      jobId: result.job_id,
      queueJobId: result.queue_job_id
    };
  } catch (error) {
    console.error('❌ Enqueue failed:', error);
    throw error;
  }
}

/**
 * Get job status and progress
 */
export async function getJobStatus(jobId: string): Promise<{
  job: SiteJob;
  progress: SiteJobProgress[];
}> {
  try {
    // Get main job
    const { data: job, error: jobError } = await supabase
      .from('site_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError) {
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

    return {
      job: job as SiteJob,
      progress: (progress || []) as SiteJobProgress[]
    };
  } catch (error) {
    console.error('❌ Failed to get job status:', error);
    throw error;
  }
}

/**
 * Subscribe to real-time job updates
 */
export function subscribeToJobUpdates(
  jobId: string,
  onUpdate: (job: SiteJob) => void,
  onProgress: (progress: SiteJobProgress) => void
) {
  console.log(`👂 Subscribing to job updates: ${jobId}`);

  // Subscribe to job status changes
  const jobChannel = supabase
    .channel(`job-${jobId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'site_jobs',
        filter: `id=eq.${jobId}`
      },
      (payload) => {
        console.log('📡 Job update received:', payload.new);
        onUpdate(payload.new as SiteJob);
      }
    )
    .subscribe();

  // Subscribe to progress updates
  const progressChannel = supabase
    .channel(`progress-${jobId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'site_job_progress',
        filter: `job_id=eq.${jobId}`
      },
      (payload) => {
        console.log('📊 Progress update received:', payload.new);
        onProgress(payload.new as SiteJobProgress);
      }
    )
    .subscribe();

  // Return cleanup function
  return () => {
    console.log(`🔇 Unsubscribing from job updates: ${jobId}`);
    supabase.removeChannel(jobChannel);
    supabase.removeChannel(progressChannel);
  };
}

/**
 * Update job progress (for workers)
 */
export async function updateJobProgress(
  jobId: string,
  stepName: string,
  status: 'pending' | 'running' | 'completed' | 'failed',
  progress: number = 0,
  message?: string,
  stepData?: any
): Promise<void> {
  try {
    const { error } = await supabase.rpc('update_job_progress', {
      p_job_id: jobId,
      p_step_name: stepName,
      p_status: status,
      p_progress: progress,
      p_message: message || null,
      p_step_data: stepData || null
    });

    if (error) {
      throw new Error(`Progress update error: ${error.message}`);
    }

    console.log(`📊 Updated progress: ${stepName} - ${status} (${progress}%)`);
  } catch (error) {
    console.error('❌ Failed to update progress:', error);
    throw error;
  }
}

/**
 * Get user's site generation quota and usage
 */
export async function getUserQuota(userId: string): Promise<{
  planType: 'free' | 'starter' | 'pro';
  sitesGenerated: number;
  sitesLimit: number;
  canGenerate: boolean;
}> {
  try {
    const { data, error } = await supabase
      .from('user_plans')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // Not found error
      throw new Error(`Quota query error: ${error.message}`);
    }

    // Default free plan if no record exists
    const plan = data || {
      plan_type: 'free',
      sites_generated: 0,
      sites_limit: 0
    };

    return {
      planType: plan.plan_type as 'free' | 'starter' | 'pro',
      sitesGenerated: plan.sites_generated,
      sitesLimit: plan.sites_limit,
      canGenerate: plan.sites_generated < plan.sites_limit || plan.plan_type === 'pro'
    };
  } catch (error) {
    console.error('❌ Failed to get user quota:', error);
    throw error;
  }
} 