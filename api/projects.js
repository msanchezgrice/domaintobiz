import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // Use service role for full access
);

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'DELETE') {
    return handleDeleteProject(req, res);
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id, domain } = req.query;
    
    // If ID or domain provided, fetch single project
    if (id || domain) {
      return await handleSingleProject(req, res, id, domain);
    }

    console.log('📊 Fetching jobs and sites from new queue system...');

    // Get all jobs (both active and completed) from the new queue system
    const { data: jobs, error: jobsError } = await supabase
      .from('site_jobs')
      .select(`
        id,
        domain,
        status,
        result_data,
        error_message,
        created_at,
        started_at,
        completed_at
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (jobsError) {
      console.error('❌ Jobs query error:', jobsError);
      return res.status(500).json({ 
        error: 'Failed to fetch jobs',
        details: jobsError.message 
      });
    }

    // Get completed sites data
    const { data: sites, error: sitesError } = await supabase
      .from('sites')
      .select(`
        id,
        domain,
        title,
        deployed_url,
        thumbnail_url,
        created_at,
        updated_at,
        paid
      `)
      .order('created_at', { ascending: false });

    if (sitesError) {
      console.error('❌ Sites query error:', sitesError);
      // Don't fail the request, just log the error
      console.log('Continuing without sites data...');
    }

    // Combine jobs with site data
    const transformedProjects = jobs?.map(job => {
      const site = sites?.find(s => s.domain === job.domain);
      const resultData = job.result_data || {};
      
      // Extract business info from result data
      const strategy = resultData.strategy;
      const analysis = resultData.domainAnalysis;
      
      return {
        id: job.id,
        domain: job.domain,
        status: job.status,
        progress: 0, // TODO: Calculate from site_job_progress table
        deploymentUrl: site?.deployed_url || resultData.website?.deployed_url,
        createdAt: job.created_at,
        startedAt: job.started_at,
        completedAt: job.completed_at,
        title: site?.title || strategy?.brandStrategy?.name || job.domain,
        thumbnailUrl: site?.thumbnail_url,
        paid: site?.paid || false,
        
        // Business data for display
        businessType: strategy?.businessModel?.type || 'Business',
        brandPositioning: strategy?.brandStrategy?.positioning || 'Professional Service',
        description: strategy?.businessModel?.description || `AI-generated website for ${job.domain}`,
        score: analysis?.score || 85,
        features: strategy?.mvpScope?.features || ['Landing Page', 'Modern Design'],
        tags: [
          job.status,
          strategy?.businessModel?.type || 'Business'
        ].filter(Boolean),
        
        // Error info if failed
        errorMessage: job.error_message,
        
        // Full data for project details
        resultData: resultData
      };
    }) || [];

    // Calculate stats
    const stats = {
      totalProjects: transformedProjects.length,
      active: transformedProjects.filter(p => ['queued', 'processing'].includes(p.status)).length,
      completed: transformedProjects.filter(p => p.status === 'completed').length,
      failed: transformedProjects.filter(p => p.status === 'failed').length,
      deployed: transformedProjects.filter(p => p.deploymentUrl).length,
      successRate: transformedProjects.length ? 
        Math.round((transformedProjects.filter(p => p.status === 'completed').length / transformedProjects.length) * 100) : 
        100
    };

    console.log(`✅ Found ${transformedProjects.length} projects/jobs. Active: ${stats.active}, Completed: ${stats.completed}, Failed: ${stats.failed}`);

    return res.status(200).json({
      success: true,
      projects: transformedProjects,
      data: {
        projects: transformedProjects,
        stats,
        total: transformedProjects.length,
        page: 1,
        limit: 50
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Projects API error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch projects', 
      message: error.message
    });
  }
}

async function handleSingleProject(req, res, id, domain) {
  try {
    console.log(`🔍 Fetching single job: id=${id}, domain=${domain}`);
    
    let query = supabase
      .from('site_jobs')
      .select(`
        id,
        domain,
        status,
        result_data,
        error_message,
        created_at,
        started_at,
        completed_at
      `);
      
    if (id) {
      query = query.eq('id', id);
    } else if (domain) {
      query = query.eq('domain', domain);
    }
    
    const { data: job, error } = await query.single();
    
    if (error) {
      console.error('❌ Single job query error:', error);
      return res.status(404).json({ error: 'Project not found' });
    }
    
    if (!job) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Get associated site data
    const { data: site } = await supabase
      .from('sites')
      .select('*')
      .eq('domain', job.domain)
      .single();
    
    const resultData = job.result_data || {};
    const strategy = resultData.strategy;
    const analysis = resultData.domainAnalysis;
    
    const transformedProject = {
      id: job.id,
      domain: job.domain,
      status: job.status,
      progress: 0, // TODO: Calculate from site_job_progress table
      deployment_url: site?.deployed_url || resultData.website?.deployed_url,
      created_at: job.created_at,
      started_at: job.started_at,
      completed_at: job.completed_at,
      title: site?.title || strategy?.brandStrategy?.name || job.domain,
      business_data: resultData,
      businessType: strategy?.businessModel?.type || 'Business',
      brandPositioning: strategy?.brandStrategy?.positioning || 'Professional Service',
      description: strategy?.businessModel?.description || `AI-generated website for ${job.domain}`,
      score: analysis?.score || 85,
      features: strategy?.mvpScope?.features || ['Landing Page', 'Modern Design'],
      tags: [job.status, strategy?.businessModel?.type || 'Business'].filter(Boolean),
      errorMessage: job.error_message
    };
    
    console.log(`✅ Found job: ${transformedProject.domain} (${transformedProject.status})`);
    
    return res.status(200).json({
      success: true,
      projects: [transformedProject],
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Single project error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch project', 
      message: error.message
    });
  }
}

async function handleDeleteProject(req, res) {
  try {
    const { id } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'Project ID is required' });
    }
    
    console.log(`🗑️ Deleting job: ${id}`);
    
    // Delete from site_jobs table
    const { error } = await supabase
      .from('site_jobs')
      .delete()
      .eq('id', id);
      
    if (error) {
      console.error('❌ Delete error:', error);
      return res.status(500).json({ 
        error: 'Failed to delete project', 
        message: error.message 
      });
    }
    
    console.log(`✅ Job deleted: ${id}`);
    
    return res.status(200).json({
      success: true,
      message: 'Project deleted successfully'
    });
    
  } catch (error) {
    console.error('❌ Delete project error:', error);
    return res.status(500).json({ 
      error: 'Failed to delete project', 
      message: error.message
    });
  }
}