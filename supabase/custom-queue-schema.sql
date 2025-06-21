-- Custom Queue Implementation (No Extension Required)
-- This replaces supabase_queues with standard PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Site generation jobs table (acts as our queue)
CREATE TABLE site_jobs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  domain TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  job_data JSONB NOT NULL,
  result_data JSONB,
  error_message TEXT,
  worker_id TEXT,
  priority INTEGER DEFAULT 0, -- Higher numbers = higher priority
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  next_retry_at TIMESTAMP WITH TIME ZONE
);

-- Site generation progress tracking
CREATE TABLE site_job_progress (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  job_id UUID REFERENCES site_jobs(id) ON DELETE CASCADE,
  step_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  message TEXT,
  step_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User plans for billing
CREATE TABLE user_plans (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  plan_type TEXT DEFAULT 'free' CHECK (plan_type IN ('free', 'starter', 'pro')),
  sites_generated INTEGER DEFAULT 0,
  sites_limit INTEGER DEFAULT 0,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT,
  current_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Generated sites with enhanced metadata
CREATE TABLE sites (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  job_id UUID REFERENCES site_jobs(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  domain TEXT NOT NULL,
  subdomain TEXT UNIQUE, -- e.g., 'talkform' for talkform.domaintobiz.app
  business_model JSONB NOT NULL,
  content_data JSONB NOT NULL,
  design_data JSONB NOT NULL,
  deployment_url TEXT,
  github_repo_url TEXT,
  paid BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'building', 'deployed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deployed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX idx_site_jobs_status ON site_jobs(status);
CREATE INDEX idx_site_jobs_created_at ON site_jobs(created_at DESC);
CREATE INDEX idx_site_jobs_priority ON site_jobs(priority DESC, created_at ASC);
CREATE INDEX idx_site_jobs_next_retry ON site_jobs(next_retry_at) WHERE status = 'queued';
CREATE INDEX idx_site_jobs_domain ON site_jobs(domain);
CREATE INDEX idx_site_job_progress_job_id ON site_job_progress(job_id);
CREATE INDEX idx_user_plans_user_id ON user_plans(user_id);
CREATE INDEX idx_sites_user_id ON sites(user_id);
CREATE INDEX idx_sites_subdomain ON sites(subdomain);
CREATE INDEX idx_sites_status ON sites(status);

-- Enable RLS
ALTER TABLE site_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_job_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own jobs" ON site_jobs
  FOR SELECT USING (true); -- Allow public for now

CREATE POLICY "Users can insert jobs" ON site_jobs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Workers can update jobs" ON site_jobs
  FOR UPDATE USING (true);

CREATE POLICY "Public read progress" ON site_job_progress
  FOR SELECT USING (true);

CREATE POLICY "Public insert progress" ON site_job_progress
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view their plans" ON user_plans
  FOR ALL USING (true);

CREATE POLICY "Public read completed sites" ON sites
  FOR SELECT USING (status = 'deployed' OR true); -- Allow all for now

CREATE POLICY "Public insert sites" ON sites
  FOR INSERT WITH CHECK (true);

-- Custom Queue Functions

-- Function to enqueue a site generation job
CREATE OR REPLACE FUNCTION enqueue_site_generation(
  p_domain TEXT,
  p_user_id UUID DEFAULT NULL,
  p_job_data JSONB DEFAULT '{}'::jsonb,
  p_priority INTEGER DEFAULT 0
)
RETURNS TABLE(job_id UUID, queue_position INTEGER) AS $$
DECLARE
  v_job_id UUID;
  v_queue_position INTEGER;
BEGIN
  -- Create site job record
  INSERT INTO site_jobs (domain, user_id, job_data, priority)
  VALUES (p_domain, p_user_id, p_job_data, p_priority)
  RETURNING id INTO v_job_id;

  -- Calculate queue position
  SELECT COUNT(*) INTO v_queue_position
  FROM site_jobs 
  WHERE status = 'queued' 
  AND (priority > p_priority OR (priority = p_priority AND created_at < NOW()));

  RETURN QUERY SELECT v_job_id, v_queue_position;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to dequeue the next available job
CREATE OR REPLACE FUNCTION dequeue_next_job(
  p_worker_id TEXT
)
RETURNS TABLE(
  job_id UUID,
  domain TEXT,
  job_data JSONB,
  user_id UUID
) AS $$
DECLARE
  v_job_record RECORD;
BEGIN
  -- Lock and get the next available job
  SELECT * INTO v_job_record
  FROM site_jobs 
  WHERE status = 'queued'
  AND (next_retry_at IS NULL OR next_retry_at <= NOW())
  AND attempts < max_attempts
  ORDER BY priority DESC, created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- If we found a job, update it to processing
  IF v_job_record.id IS NOT NULL THEN
    UPDATE site_jobs 
    SET 
      status = 'processing',
      worker_id = p_worker_id,
      started_at = NOW(),
      attempts = attempts + 1
    WHERE id = v_job_record.id;

    -- Return the job details
    RETURN QUERY 
    SELECT 
      v_job_record.id,
      v_job_record.domain,
      v_job_record.job_data,
      v_job_record.user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update job progress
CREATE OR REPLACE FUNCTION update_job_progress(
  p_job_id UUID,
  p_step_name TEXT,
  p_status TEXT,
  p_progress INTEGER DEFAULT 0,
  p_message TEXT DEFAULT NULL,
  p_step_data JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO site_job_progress (job_id, step_name, status, progress_percentage, message, step_data)
  VALUES (p_job_id, p_step_name, p_status, p_progress, p_message, p_step_data);
  
  -- Update main job status if needed
  IF p_status = 'failed' THEN
    UPDATE site_jobs 
    SET status = 'failed', error_message = p_message, completed_at = NOW()
    WHERE id = p_job_id;
  ELSIF p_status = 'completed' AND p_progress = 100 THEN
    UPDATE site_jobs 
    SET status = 'completed', completed_at = NOW()
    WHERE id = p_job_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark job as completed
CREATE OR REPLACE FUNCTION complete_job(
  p_job_id UUID,
  p_result_data JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE site_jobs 
  SET 
    status = 'completed',
    result_data = p_result_data,
    completed_at = NOW()
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark job as failed
CREATE OR REPLACE FUNCTION fail_job(
  p_job_id UUID,
  p_error_message TEXT,
  p_retry_delay_minutes INTEGER DEFAULT 5
)
RETURNS VOID AS $$
BEGIN
  UPDATE site_jobs 
  SET 
    status = CASE 
      WHEN attempts >= max_attempts THEN 'failed'
      ELSE 'queued'
    END,
    error_message = p_error_message,
    completed_at = CASE 
      WHEN attempts >= max_attempts THEN NOW()
      ELSE NULL
    END,
    next_retry_at = CASE 
      WHEN attempts < max_attempts THEN NOW() + (p_retry_delay_minutes || ' minutes')::INTERVAL
      ELSE NULL
    END,
    worker_id = NULL
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get queue stats
CREATE OR REPLACE FUNCTION get_queue_stats()
RETURNS TABLE(
  queued_jobs INTEGER,
  processing_jobs INTEGER,
  completed_jobs INTEGER,
  failed_jobs INTEGER,
  avg_processing_time_minutes NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) FILTER (WHERE status = 'queued')::INTEGER,
    COUNT(*) FILTER (WHERE status = 'processing')::INTEGER,
    COUNT(*) FILTER (WHERE status = 'completed')::INTEGER,
    COUNT(*) FILTER (WHERE status = 'failed')::INTEGER,
    ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - started_at))/60)::NUMERIC, 2) FILTER (WHERE status = 'completed')
  FROM site_jobs
  WHERE created_at > NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old jobs (call this periodically)
CREATE OR REPLACE FUNCTION cleanup_old_jobs(
  p_keep_days INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM site_jobs 
  WHERE created_at < NOW() - (p_keep_days || ' days')::INTERVAL
  AND status IN ('completed', 'failed');
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Default user plan limits
INSERT INTO user_plans (plan_type, sites_limit) VALUES 
('free', 0),
('starter', 2),
('pro', 10)
ON CONFLICT DO NOTHING;

-- Create a view for easy queue monitoring
CREATE VIEW queue_status AS
SELECT 
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (NOW() - created_at))/60)::INTEGER as avg_age_minutes
FROM site_jobs 
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status
ORDER BY status; 