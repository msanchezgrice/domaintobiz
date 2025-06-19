import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
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
    // Fetch deployed websites from database
    const { data: websites, error } = await supabase
      .from('generated_websites')
      .select('id, domain, deployment_url, status, created_at')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    const deployments = websites.map(site => ({
      domain: site.domain,
      url: site.deployment_url,
      id: site.id,
      createdAt: site.created_at
    }));

    return res.status(200).json({
      success: true,
      deployments,
      count: deployments.length
    });

  } catch (error) {
    console.error('Failed to list deployments:', error);
    return res.status(500).json({ 
      error: 'Failed to list deployments',
      message: error.message
    });
  }
}