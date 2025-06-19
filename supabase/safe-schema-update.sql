-- Safe Schema Update - Only adds missing pieces
-- This handles existing policies and tables gracefully

-- Add missing columns to generated_websites if they don't exist
DO $$ 
BEGIN
    -- Add original_domain column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='generated_websites' AND column_name='original_domain') THEN
        ALTER TABLE generated_websites ADD COLUMN original_domain TEXT;
    END IF;
    
    -- Add website_html column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='generated_websites' AND column_name='website_html') THEN
        ALTER TABLE generated_websites ADD COLUMN website_html TEXT;
    END IF;
    
    -- Add website_css column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='generated_websites' AND column_name='website_css') THEN
        ALTER TABLE generated_websites ADD COLUMN website_css TEXT;
    END IF;
    
    -- Add website_js column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='generated_websites' AND column_name='website_js') THEN
        ALTER TABLE generated_websites ADD COLUMN website_js TEXT;
    END IF;
    
    -- Add deployment_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='generated_websites' AND column_name='deployment_id') THEN
        ALTER TABLE generated_websites ADD COLUMN deployment_id TEXT;
    END IF;
END $$;

-- Create website_files table if it doesn't exist
CREATE TABLE IF NOT EXISTS website_files (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  website_id UUID REFERENCES generated_websites(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_content TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('html', 'css', 'js', 'json', 'image')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create website_deployments table if it doesn't exist
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

-- Add indexes for new tables (IF NOT EXISTS doesn't work for indexes, so we use DO block)
DO $$ 
BEGIN
    -- Add website_files indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_website_files_website_id') THEN
        CREATE INDEX idx_website_files_website_id ON website_files(website_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_website_files_file_type') THEN
        CREATE INDEX idx_website_files_file_type ON website_files(file_type);
    END IF;
    
    -- Add website_deployments indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_website_deployments_website_id') THEN
        CREATE INDEX idx_website_deployments_website_id ON website_deployments(website_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_website_deployments_slug') THEN
        CREATE INDEX idx_website_deployments_slug ON website_deployments(deployment_slug);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_website_deployments_status') THEN
        CREATE INDEX idx_website_deployments_status ON website_deployments(deployment_status);
    END IF;
END $$;

-- Enable RLS for new tables
ALTER TABLE website_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_deployments ENABLE ROW LEVEL SECURITY;

-- Create policies for new tables (drop first if they exist)
DROP POLICY IF EXISTS "Public read website files" ON website_files;
CREATE POLICY "Public read website files" ON website_files
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public insert website files" ON website_files;
CREATE POLICY "Public insert website files" ON website_files
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public read deployments" ON website_deployments;
CREATE POLICY "Public read deployments" ON website_deployments
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public insert deployments" ON website_deployments;
CREATE POLICY "Public insert deployments" ON website_deployments
  FOR INSERT WITH CHECK (true);

-- Add missing policies for generated_websites (drop first if they exist)
DROP POLICY IF EXISTS "Public insert websites" ON generated_websites;
CREATE POLICY "Public insert websites" ON generated_websites
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public update websites" ON generated_websites;
CREATE POLICY "Public update websites" ON generated_websites
  FOR UPDATE USING (true);

-- Create or replace views
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

-- Insert some demo data for testing
INSERT INTO generated_websites (
  domain, 
  original_domain, 
  website_data, 
  deployment_url, 
  website_html,
  website_css,
  website_js,
  deployment_id,
  status, 
  completed_at
) VALUES (
  'demo.com',
  'demo.com',
  '{"strategy": {"businessModel": {"type": "SaaS"}, "brandStrategy": {"positioning": "AI-Powered Business Solution"}}, "executionId": "demo_' || extract(epoch from now()) || '"}',
  'https://domaintobiz.vercel.app/sites/demo-com-' || extract(epoch from now()) || '/',
  '<!DOCTYPE html><html><head><title>Demo.com - AI Business</title><style>body{font-family:Arial,sans-serif;margin:40px;background:#f5f5f5}h1{color:#3B82F6;text-align:center}p{color:#666;text-align:center}</style></head><body><h1>Welcome to Demo.com</h1><p>This is a demo AI-generated business website.</p><div style="text-align:center;margin-top:30px"><a href="#" style="background:#3B82F6;color:white;padding:12px 24px;text-decoration:none;border-radius:6px">Get Started</a></div></body></html>',
  'body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; } h1 { color: #3B82F6; text-align: center; } p { color: #666; text-align: center; }',
  'console.log("Demo AI-generated website loaded"); document.addEventListener("DOMContentLoaded", function() { console.log("Website ready for business!"); });',
  'demo_' || extract(epoch from now()),
  'completed',
  NOW()
), (
  'testbiz.com',
  'testbiz.com', 
  '{"strategy": {"businessModel": {"type": "E-commerce"}, "brandStrategy": {"positioning": "Premium Online Store"}}, "executionId": "test_' || extract(epoch from now()) || '"}',
  'https://domaintobiz.vercel.app/sites/testbiz-com-' || extract(epoch from now()) || '/',
  '<!DOCTYPE html><html><head><title>TestBiz.com - Premium Store</title><style>body{font-family:Arial,sans-serif;margin:0;background:#fff}.header{background:#1E40AF;color:white;padding:20px;text-align:center}.content{padding:40px;text-align:center}</style></head><body><div class="header"><h1>TestBiz.com</h1><p>Premium Online Store</p></div><div class="content"><h2>Coming Soon</h2><p>Your premium e-commerce experience awaits.</p></div></body></html>',
  'body { font-family: Arial, sans-serif; margin: 0; background: #fff; } .header { background: #1E40AF; color: white; padding: 20px; text-align: center; } .content { padding: 40px; text-align: center; }',
  'console.log("TestBiz e-commerce site loaded");',
  'test_' || extract(epoch from now()),
  'completed',
  NOW()
) ON CONFLICT DO NOTHING;

-- Verification
SELECT 'Schema update completed successfully!' as status;

-- Show table info
SELECT 
  table_name,
  (SELECT count(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'public') as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
AND table_name IN ('generated_websites', 'website_files', 'website_deployments')
ORDER BY table_name;

-- Show sample data
SELECT 
  domain, 
  status, 
  deployment_url,
  created_at
FROM generated_websites 
ORDER BY created_at DESC 
LIMIT 3;