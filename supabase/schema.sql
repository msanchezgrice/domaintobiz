-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table for analytics and tracking
CREATE TABLE users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_analyses INTEGER DEFAULT 0,
  total_websites INTEGER DEFAULT 0
);

-- Domain analysis results
CREATE TABLE domain_analyses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  domains TEXT[] NOT NULL,
  analysis_result JSONB NOT NULL,
  best_domain TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Business strategies generated from domain analysis
CREATE TABLE business_strategies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  analysis_id UUID REFERENCES domain_analyses(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  strategy JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Generated websites and their deployment info
CREATE TABLE generated_websites (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  strategy_id UUID REFERENCES business_strategies(id) ON DELETE SET NULL,
  domain TEXT NOT NULL,
  website_data JSONB NOT NULL,
  deployment_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Execution logs for debugging and monitoring
CREATE TABLE execution_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  execution_id TEXT NOT NULL,
  step TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics for popular domains and patterns
CREATE TABLE analytics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_type TEXT NOT NULL,
  domain TEXT,
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_domain_analyses_created_at ON domain_analyses(created_at DESC);
CREATE INDEX idx_domain_analyses_best_domain ON domain_analyses(best_domain);
CREATE INDEX idx_business_strategies_domain ON business_strategies(domain);
CREATE INDEX idx_generated_websites_status ON generated_websites(status);
CREATE INDEX idx_generated_websites_created_at ON generated_websites(created_at DESC);
CREATE INDEX idx_execution_logs_execution_id ON execution_logs(execution_id);
CREATE INDEX idx_analytics_event_type ON analytics(event_type);
CREATE INDEX idx_analytics_created_at ON analytics(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_websites ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;

-- Public read access for generated websites (for showcase)
CREATE POLICY "Public read access for completed websites" ON generated_websites
  FOR SELECT USING (status = 'completed');

-- Users can see their own data
CREATE POLICY "Users can view own analyses" ON domain_analyses
  FOR SELECT USING (true); -- Anonymous users can read for now

CREATE POLICY "Users can insert analyses" ON domain_analyses
  FOR INSERT WITH CHECK (true); -- Anonymous users can insert for now

-- Similar policies for other tables
CREATE POLICY "Public read strategies" ON business_strategies
  FOR SELECT USING (true);

CREATE POLICY "Public insert strategies" ON business_strategies
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public read websites" ON generated_websites
  FOR SELECT USING (true);

CREATE POLICY "Public insert websites" ON generated_websites
  FOR INSERT WITH CHECK (true);

-- View for public website showcase
CREATE VIEW public_websites AS
SELECT 
  id,
  domain,
  deployment_url,
  created_at,
  website_data->'strategy'->'businessModel'->>'type' as business_type
FROM generated_websites 
WHERE status = 'completed' 
AND deployment_url IS NOT NULL
ORDER BY created_at DESC;