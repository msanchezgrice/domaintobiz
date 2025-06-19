-- Add missing columns to existing tables
ALTER TABLE generated_websites 
ADD COLUMN IF NOT EXISTS original_domain TEXT,
ADD COLUMN IF NOT EXISTS website_html TEXT,
ADD COLUMN IF NOT EXISTS website_css TEXT,
ADD COLUMN IF NOT EXISTS website_js TEXT,
ADD COLUMN IF NOT EXISTS deployment_id TEXT;

-- Create table for storing actual generated website files
CREATE TABLE IF NOT EXISTS website_files (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  website_id UUID REFERENCES generated_websites(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_content TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('html', 'css', 'js', 'json', 'image')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for website deployments with unique URLs
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

-- Add indexes for the new tables
CREATE INDEX IF NOT EXISTS idx_website_files_website_id ON website_files(website_id);
CREATE INDEX IF NOT EXISTS idx_website_files_file_type ON website_files(file_type);
CREATE INDEX IF NOT EXISTS idx_website_deployments_website_id ON website_deployments(website_id);
CREATE INDEX IF NOT EXISTS idx_website_deployments_slug ON website_deployments(deployment_slug);
CREATE INDEX IF NOT EXISTS idx_website_deployments_status ON website_deployments(deployment_status);

-- Enable RLS for new tables
ALTER TABLE website_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_deployments ENABLE ROW LEVEL SECURITY;

-- Add policies for new tables
CREATE POLICY "Public read website files" ON website_files
  FOR SELECT USING (true);

CREATE POLICY "Public insert website files" ON website_files
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public read deployments" ON website_deployments
  FOR SELECT USING (true);

CREATE POLICY "Public insert deployments" ON website_deployments
  FOR INSERT WITH CHECK (true);

-- View for listing all completed projects with deployment info
CREATE OR REPLACE VIEW completed_projects AS
SELECT 
  gw.id,
  gw.domain,
  gw.original_domain,
  gw.deployment_url,
  gw.created_at,
  gw.completed_at,
  gw.website_data,
  wd.deployment_slug,
  wd.deployment_status,
  wd.deployed_at,
  gw.website_data->'strategy'->'businessModel'->>'type' as business_type,
  gw.website_data->'strategy'->'brandStrategy'->>'positioning' as brand_positioning
FROM generated_websites gw
LEFT JOIN website_deployments wd ON gw.id = wd.website_id
WHERE gw.status = 'completed'
ORDER BY gw.created_at DESC;