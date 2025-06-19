-- Complete Database Schema for Domain to Biz
-- Run this entire script in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (careful - this will delete data!)
-- Uncomment the lines below if you want to start fresh
-- DROP TABLE IF EXISTS website_files CASCADE;
-- DROP TABLE IF EXISTS website_deployments CASCADE;
-- DROP TABLE IF EXISTS generated_websites CASCADE;
-- DROP TABLE IF EXISTS business_strategies CASCADE;
-- DROP TABLE IF EXISTS domain_analyses CASCADE;
-- DROP TABLE IF EXISTS execution_logs CASCADE;
-- DROP TABLE IF EXISTS analytics CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;

-- Users table for analytics and tracking
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_analyses INTEGER DEFAULT 0,
  total_websites INTEGER DEFAULT 0
);

-- Domain analysis results
CREATE TABLE IF NOT EXISTS domain_analyses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  domains TEXT[] NOT NULL,
  analysis_result JSONB NOT NULL,
  best_domain TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Business strategies generated from domain analysis
CREATE TABLE IF NOT EXISTS business_strategies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  analysis_id UUID REFERENCES domain_analyses(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  strategy JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Generated websites and their deployment info
CREATE TABLE IF NOT EXISTS generated_websites (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  strategy_id UUID REFERENCES business_strategies(id) ON DELETE SET NULL,
  domain TEXT NOT NULL,
  original_domain TEXT,
  website_data JSONB NOT NULL,
  deployment_url TEXT,
  website_html TEXT,
  website_css TEXT,
  website_js TEXT,
  deployment_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Website files storage
CREATE TABLE IF NOT EXISTS website_files (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  website_id UUID REFERENCES generated_websites(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_content TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('html', 'css', 'js', 'json', 'image')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Website deployments with unique URLs
CREATE TABLE IF NOT EXISTS website_deployments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  website_id UUID REFERENCES generated_websites(id) ON DELETE CASCADE,
  deployment_url TEXT UNIQUE NOT NULL,
  deployment_slug TEXT UNIQUE NOT NULL,
  deployment_status TEXT DEFAULT 'pending' CHECK (deployment_status IN ('pending', 'building', 'ready', 'failed')),
  deployment_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deployed_at TIMESTAMP WITH TIME ZONE
);

-- Execution logs for debugging and monitoring
CREATE TABLE IF NOT EXISTS execution_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  execution_id TEXT NOT NULL,
  step TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics for popular domains and patterns
CREATE TABLE IF NOT EXISTS analytics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_type TEXT NOT NULL,
  domain TEXT,
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_domain_analyses_created_at ON domain_analyses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_domain_analyses_best_domain ON domain_analyses(best_domain);
CREATE INDEX IF NOT EXISTS idx_business_strategies_domain ON business_strategies(domain);
CREATE INDEX IF NOT EXISTS idx_generated_websites_status ON generated_websites(status);
CREATE INDEX IF NOT EXISTS idx_generated_websites_created_at ON generated_websites(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_website_files_website_id ON website_files(website_id);
CREATE INDEX IF NOT EXISTS idx_website_files_file_type ON website_files(file_type);
CREATE INDEX IF NOT EXISTS idx_website_deployments_website_id ON website_deployments(website_id);
CREATE INDEX IF NOT EXISTS idx_website_deployments_slug ON website_deployments(deployment_slug);
CREATE INDEX IF NOT EXISTS idx_website_deployments_status ON website_deployments(deployment_status);
CREATE INDEX IF NOT EXISTS idx_execution_logs_execution_id ON execution_logs(execution_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_websites ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (adjust as needed for production)
CREATE POLICY "Public read access for completed websites" ON generated_websites
  FOR SELECT USING (status = 'completed');

CREATE POLICY "Public insert websites" ON generated_websites
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public update websites" ON generated_websites
  FOR UPDATE USING (true);

CREATE POLICY "Public read analyses" ON domain_analyses
  FOR SELECT USING (true);

CREATE POLICY "Public insert analyses" ON domain_analyses
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public read strategies" ON business_strategies
  FOR SELECT USING (true);

CREATE POLICY "Public insert strategies" ON business_strategies
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public read website files" ON website_files
  FOR SELECT USING (true);

CREATE POLICY "Public insert website files" ON website_files
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public read deployments" ON website_deployments
  FOR SELECT USING (true);

CREATE POLICY "Public insert deployments" ON website_deployments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public insert execution logs" ON execution_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public read execution logs" ON execution_logs
  FOR SELECT USING (true);

-- Create useful views
CREATE OR REPLACE VIEW completed_projects AS
SELECT 
  gw.id,
  gw.domain,
  gw.original_domain,
  gw.deployment_url,
  gw.created_at,
  gw.completed_at,
  gw.website_data,
  gw.deployment_id,
  gw.status,
  wd.deployment_slug,
  wd.deployment_status,
  wd.deployed_at,
  gw.website_data->'strategy'->'businessModel'->>'type' as business_type,
  gw.website_data->'strategy'->'brandStrategy'->>'positioning' as brand_positioning
FROM generated_websites gw
LEFT JOIN website_deployments wd ON gw.id = wd.website_id
WHERE gw.status = 'completed'
ORDER BY gw.created_at DESC;

CREATE OR REPLACE VIEW public_websites AS
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

-- Insert some sample data for testing (optional)
INSERT INTO generated_websites (
  domain, 
  original_domain, 
  website_data, 
  deployment_url, 
  website_html,
  website_css,
  website_js,
  status, 
  completed_at
) VALUES (
  'example.com',
  'example.com',
  '{"strategy": {"businessModel": {"type": "SaaS"}, "brandStrategy": {"positioning": "Premium Business Solution"}}, "executionId": "demo_123"}',
  'https://domaintobiz.vercel.app/sites/example-com-demo/',
  '<!DOCTYPE html><html><head><title>Example.com</title></head><body><h1>Welcome to Example.com</h1><p>This is a demo generated website.</p></body></html>',
  'body { font-family: Arial, sans-serif; margin: 40px; } h1 { color: #3B82F6; }',
  'console.log("Demo website loaded");',
  'completed',
  NOW()
) ON CONFLICT DO NOTHING;

-- Verification queries
SELECT 'Tables created successfully!' as status;

SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('generated_websites', 'website_files', 'website_deployments')
ORDER BY table_name, ordinal_position;