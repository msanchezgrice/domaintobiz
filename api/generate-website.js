import { createClient } from '@supabase/supabase-js';
import nunjucks from 'nunjucks';
import path from 'path';
import fs from 'fs';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Create a Nunjucks environment with a file system loader
// This allows the {% include %} tags to work correctly
const templatesPath = path.join(process.cwd(), 'templates');
const nunjucksEnv = new nunjucks.Environment(new nunjucks.FileSystemLoader(templatesPath), {
  autoescape: true,
});

// Read the main template file at build time and store it as a string
const templateString = fs.readFileSync(path.join(templatesPath, 'htmx', 'index.html.jinja'), 'utf-8');

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
      return res.status(400).json({ error: 'Missing required data: domain, strategy, designSystem, and websiteContent are required.' });
    }

    console.log(`[${domain}] Generating website using HTMX templates...`);

    // Prepare data for the template
    const templateData = {
      brand: {
        name: domain,
        primaryColor: designSystem.colorPalette?.primary || '#3B82F6',
        secondaryColor: designSystem.colorPalette?.secondary || '#10B981',
      },
      content: websiteContent,
      // Assuming modules are not yet dynamically handled, will set defaults
      modules: {
        waitlist: true,
        stripePaywall: false, // Default to false unless specified
      }
    };
    
    // Render the HTMX template from the in-memory string using the configured environment
    const renderedHtml = nunjucksEnv.renderString(templateString, templateData);
    
    const deploymentSlug = `${domain.replace(/\./g, '-')}-${Date.now()}`;
    const deploymentUrl = `${req.headers.origin || 'https://domaintobiz.vercel.app'}/sites/${deploymentSlug}`;

    // Save the rendered HTML to the database
    const { data: savedWebsite, error: dbError } = await supabase
      .from('generated_websites')
      .insert({
        domain: domain,
        original_domain: domain,
        website_data: { strategy, designSystem, websiteContent, executionId },
        deployment_url: deploymentUrl,
        website_html: renderedHtml, // Save the final rendered HTML
        website_css: '', // CSS is now inline or via CDN
        website_js: '', // JS is now inline or via CDN
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

    console.log(`[${domain}] Website saved to DB with ID: ${savedWebsite.id}`);

    // Create a deployment record for serving
    await supabase.from('website_deployments').insert({
      website_id: savedWebsite.id,
      deployment_url: deploymentUrl,
      deployment_slug: deploymentSlug,
      deployment_status: 'ready',
      deployed_at: new Date().toISOString()
    });

    console.log(`[${domain}] Website generation completed successfully.`);

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