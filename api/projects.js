import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // CORS and method checks
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'DELETE') return handleDeleteProject(req, res);
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { id, domain } = req.query;
    if (id || domain) {
      return await handleSingleProject(req, res, id, domain);
    }

    console.log('Fetching all jobs and sites from queue system...');

    const { data: jobs, error: jobsError } = await supabase
      .from('site_jobs')
      .select('id, domain, status, result_data, error_message, created_at, started_at, completed_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (jobsError) throw new Error(`Jobs query failed: ${jobsError.message}`);

    const { data: sites, error: sitesError } = await supabase
      .from('sites')
      .select('domain, deployed_url, thumbnail_url, paid, updated_at')
      .order('updated_at', { ascending: false });

    if (sitesError) {
      console.warn('Sites query partially failed, continuing without full site data:', sitesError.message);
    }

    const transformedProjects = jobs?.map(job => {
      const site = sites?.find(s => s.domain === job.domain);
      const resultData = job.result_data || {};
      const strategy = resultData.strategy;
      const analysis = resultData.domainAnalysis;
      
      return {
        id: job.id,
        domain: job.domain,
        status: job.status,
        deploymentUrl: site?.deployed_url || resultData.website?.deploymentUrl,
        createdAt: job.created_at,
        startedAt: job.started_at,
        completedAt: job.completed_at,
        title: strategy?.brandStrategy?.name || job.domain, // Derived title, not from DB
        thumbnailUrl: site?.thumbnail_url,
        paid: site?.paid || false,
        businessType: strategy?.businessModel?.type || 'Business',
        brandPositioning: strategy?.brandStrategy?.positioning || 'Professional Service',
        description: strategy?.businessModel?.description || `AI-generated website for ${job.domain}`,
        score: analysis?.score || null,
        features: strategy?.mvpScope?.features?.map(f => f.name) || ['Landing Page', 'Contact Form'],
        tags: [job.status, strategy?.businessModel?.type].filter(Boolean),
        errorMessage: job.error_message,
        resultData: resultData
      };
    }) || [];

    const stats = {
      total: transformedProjects.length,
      active: transformedProjects.filter(p => ['queued', 'processing'].includes(p.status)).length,
      completed: transformedProjects.filter(p => p.status === 'completed').length,
      failed: transformedProjects.filter(p => p.status === 'failed').length,
    };

    console.log(`Found ${stats.total} projects. Active: ${stats.active}, Completed: ${stats.completed}, Failed: ${stats.failed}`);

    return res.status(200).json({
      success: true,
      projects: transformedProjects,
      data: {
        projects: transformedProjects,
        stats,
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Projects API main error:', error.message);
    return res.status(500).json({ 
      error: 'Failed to fetch projects', 
      message: error.message
    });
  }
}

async function handleSingleProject(req, res, id, domain) {
  try {
    let query = supabase.from('site_jobs').select('*');
    if (id) {
      query = query.eq('id', id);
    } else if (domain) {
      query = query.eq('domain', domain).order('created_at', { ascending: false });
    }
    
    const { data: job, error } = await query.single();
    if (error || !job) return res.status(404).json({ error: 'Project not found' });
    
    // This logic can be simplified as it largely duplicates the main function
    // For now, return the job data directly
    return res.status(200).json({
      success: true,
      projects: [job],
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Single project error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch project', message: error.message });
  }
}

async function handleDeleteProject(req, res) {
    try {
        const { id } = req.body;
        if (!id) return res.status(400).json({ error: 'Project ID is required' });

        console.log(`🗑️ Deleting job: ${id}`);
        const { error } = await supabase.from('site_jobs').delete().eq('id', id);
        if (error) throw error;
        
        console.log(`✅ Job deleted: ${id}`);
        return res.status(200).json({ success: true, message: 'Project deleted' });

    } catch (error) {
        console.error('❌ Delete project error:', error.message);
        return res.status(500).json({ error: 'Failed to delete project', message: error.message });
    }
}