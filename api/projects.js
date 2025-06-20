import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
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

    console.log('📊 Fetching projects from database...');

    // Get all completed projects with deployment info
    const { data: projects, error: projectsError } = await supabase
      .from('generated_websites')
      .select(`
        id,
        domain,
        original_domain,
        deployment_url,
        created_at,
        completed_at,
        website_data,
        deployment_id,
        status
      `)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(50);

    if (projectsError) {
      console.error('❌ Database error:', projectsError);
      return res.status(500).json({ 
        error: 'Failed to fetch projects',
        details: projectsError.message 
      });
    }

    // Get analytics/stats
    const { data: statsData, error: statsError } = await supabase
      .from('generated_websites')
      .select('status')
      .limit(1000);

    const stats = {
      totalProjects: projects?.length || 0,
      deployed: projects?.filter(p => p.deployment_url)?.length || 0,
      avgScore: 75, // Placeholder - could calculate from analysis data
      successRate: projects?.length ? 
        Math.round((projects.filter(p => p.status === 'completed').length / projects.length) * 100) : 
        100
    };

    // Transform projects for frontend
    const transformedProjects = projects?.map(project => {
      const strategy = project.website_data?.strategy;
      const analysisData = project.website_data?.domainAnalysis;
      
      return {
        id: project.id,
        domain: project.domain,
        originalDomain: project.original_domain,
        deploymentUrl: project.deployment_url,
        createdAt: project.created_at,
        completedAt: project.completed_at,
        deploymentId: project.deployment_id,
        status: project.status,
        businessType: strategy?.businessModel?.type || 'Unknown',
        brandPositioning: strategy?.brandStrategy?.positioning || 'Business Solution',
        description: strategy?.businessModel?.description || `Business website for ${project.domain}`,
        score: analysisData?.score || Math.floor(Math.random() * 40) + 60, // Use real score or fallback
        features: strategy?.mvpScope?.features || ['Landing Page', 'Contact Form'],
        tags: [
          strategy?.businessModel?.type || 'Business',
          strategy?.brandStrategy?.brandPersonality || 'Professional'
        ].filter(Boolean)
      };
    }) || [];

    console.log(`✅ Found ${transformedProjects.length} projects`);

    return res.status(200).json({
      success: true,
      projects: transformedProjects, // Changed to match frontend expectation
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
    console.log(`🔍 Fetching single project: id=${id}, domain=${domain}`);
    
    let query = supabase
      .from('generated_websites')
      .select(`
        id,
        domain,
        original_domain,
        deployment_url,
        created_at,
        completed_at,
        website_data,
        deployment_id,
        status,
        website_html,
        website_css,
        website_js
      `);
      
    if (id) {
      query = query.eq('id', id);
    } else if (domain) {
      query = query.eq('domain', domain);
    }
    
    const { data: projects, error } = await query.single();
    
    if (error) {
      console.error('❌ Single project query error:', error);
      return res.status(404).json({ error: 'Project not found' });
    }
    
    if (!projects) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Transform project data for frontend
    const strategy = projects.website_data?.strategy;
    const analysisData = projects.website_data?.domainAnalysis;
    
    const transformedProject = {
      id: projects.id,
      domain: projects.domain,
      original_domain: projects.original_domain,
      deployment_url: projects.deployment_url,
      created_at: projects.created_at,
      completed_at: projects.completed_at,
      deployed_at: projects.completed_at, // For compatibility
      deployment_id: projects.deployment_id,
      status: projects.status,
      business_data: projects.website_data, // Full data for project details
      businessType: strategy?.businessModel?.type || 'Unknown',
      brandPositioning: strategy?.brandStrategy?.positioning || 'Business Solution',
      description: strategy?.businessModel?.description || `Business website for ${projects.domain}`,
      score: analysisData?.score || Math.floor(Math.random() * 40) + 60,
      features: strategy?.mvpScope?.features || ['Landing Page', 'Contact Form'],
      tags: [
        strategy?.businessModel?.type || 'Business',
        strategy?.brandStrategy?.brandPersonality || 'Professional'
      ].filter(Boolean)
    };
    
    console.log(`✅ Found project: ${transformedProject.domain}`);
    
    return res.status(200).json({
      success: true,
      projects: [transformedProject], // Return as array for compatibility
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
    
    console.log(`🗑️ Deleting project: ${id}`);
    
    const { error } = await supabase
      .from('generated_websites')
      .delete()
      .eq('id', id);
      
    if (error) {
      console.error('❌ Delete error:', error);
      return res.status(500).json({ 
        error: 'Failed to delete project', 
        message: error.message 
      });
    }
    
    console.log(`✅ Project deleted: ${id}`);
    
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