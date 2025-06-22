import { createClient } from '@supabase/supabase-js';
import nunjucks from 'nunjucks';
import path from 'path';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// --- START: Definitive Nunjucks Environment ---
// This is the correct way to configure Nunjucks to find templates and their partials.
const nunjucksEnv = new nunjucks.Environment(
  new nunjucks.FileSystemLoader(path.join(process.cwd(), 'templates')),
  { autoescape: true }
);
// --- END: Definitive Nunjucks Environment ---

export default async function handler(req, res) {
  // Standard headers and method checks
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { domain, strategy, designSystem, websiteContent, executionId } = req.body;

    if (!domain || !strategy || !designSystem || !websiteContent) {
      return res.status(400).json({ error: 'Missing required data' });
    }

    console.log(`[${domain}] Rendering HTMX template with Nunjucks...`);

    const templateData = {
      brand: {
        name: domain,
        primaryColor: designSystem.colorPalette?.primary || '#3B82F6',
        secondaryColor: designSystem.colorPalette?.secondary || '#10B981',
      },
      content: websiteContent,
      modules: {
        waitlist: true,
        stripePaywall: false,
      }
    };
    
    // Use nunjucks.render() with the file path, not renderString.
    // This allows the configured loader to find the main template and its partials.
    const renderedHtml = nunjucksEnv.render('htmx/index.html.jinja', templateData);
    
    const deploymentSlug = `${domain.replace(/\./g, '-')}-${Date.now()}`;
    const deploymentUrl = `https://domaintobiz.vercel.app/sites/${deploymentSlug}`;

    const { data: savedWebsite, error: dbError } = await supabase
      .from('generated_websites')
      .insert({
        domain: domain,
        website_data: { strategy, designSystem, websiteContent, executionId },
        deployment_url: deploymentUrl,
        website_html: renderedHtml,
        deployment_id: executionId,
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (dbError) {
      console.error(`[${domain}] Database error saving website:`, dbError);
      throw new Error(`Database save failed: ${dbError.message}`);
    }

    await supabase.from('website_deployments').insert({
      website_id: savedWebsite.id,
      deployment_url: deploymentUrl,
      deployment_slug: deploymentSlug,
      deployment_status: 'ready',
      deployed_at: new Date().toISOString()
    });

    console.log(`[${domain}] Website generated successfully.`);

    return res.status(200).json({
      success: true,
      message: 'HTMX Website generated successfully',
      data: {
        domain,
        deploymentUrl,
        deploymentSlug,
        websiteId: savedWebsite.id,
        status: 'completed'
      }
    });

  } catch (error) {
    console.error('❌ Website generation failed:', error.message);
    return res.status(500).json({ 
      error: 'Website generation failed', 
      message: error.message
    });
  }
}