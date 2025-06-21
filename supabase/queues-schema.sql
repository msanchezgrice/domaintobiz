-- Enable Supabase Queues extension
CREATE EXTENSION IF NOT EXISTS supabase_queues;

-- Site generation jobs table
CREATE TABLE site_jobs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  domain TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  job_data JSONB NOT NULL,
  result_data JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  worker_id TEXT
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

CREATE POLICY "Users can update their jobs" ON site_jobs
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

-- Function to enqueue site generation job
CREATE OR REPLACE FUNCTION enqueue_site_generation(
  p_domain TEXT,
  p_user_id UUID DEFAULT NULL,
  p_job_data JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(job_id UUID, queue_job_id UUID) AS $$
DECLARE
  v_job_id UUID;
  v_queue_job_id UUID;
BEGIN
  -- Create site job record
  INSERT INTO site_jobs (domain, user_id, job_data)
  VALUES (p_domain, p_user_id, p_job_data)
  RETURNING id INTO v_job_id;

  -- Enqueue the job
  SELECT queues.enqueue(
    queue   => 'site_jobs',
    payload => json_build_object(
      'site_job_id', v_job_id,
      'domain', p_domain,
      'user_id', p_user_id,
      'job_data', p_job_data
    )
  ) INTO v_queue_job_id;

  RETURN QUERY SELECT v_job_id, v_queue_job_id;
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
    SET status = 'failed', error_message = p_message
    WHERE id = p_job_id;
  ELSIF p_status = 'completed' AND p_progress = 100 THEN
    UPDATE site_jobs 
    SET status = 'completed', completed_at = NOW()
    WHERE id = p_job_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to dequeue jobs from the queue
CREATE OR REPLACE FUNCTION dequeue_job(
  queue_name TEXT,
  worker_id TEXT
)
RETURNS TABLE(payload JSONB) AS $$
BEGIN
  RETURN QUERY
  SELECT queues.dequeue(queue_name, worker_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 