import { createClient } from '@supabase/supabase-js';
import nunjucks from 'nunjucks';
import path from 'path';
import fs from 'fs';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// --- START: Definitive Template Inlining ---
// Read all templates into memory at build time to bypass Vercel filesystem issues.
const templatesPath = path.join(process.cwd(), 'templates', 'htmx');
const mainTemplateString = fs.readFileSync(path.join(templatesPath, 'index.html.jinja'), 'utf-8');
const navbarString = fs.readFileSync(path.join(templatesPath, 'partials', 'navbar.html.jinja'), 'utf-8');
const footerString = fs.readFileSync(path.join(templatesPath, 'partials', 'footer.html.jinja'), 'utf-8');

// Manually replace the {% include %} tags with the actual partial content.
const finalTemplateString = mainTemplateString
  .replace("{% include 'partials/navbar.html.jinja' %}", navbarString)
  .replace("{% include 'partials/footer.html.jinja' %}", footerString);

// --- END: Definitive Template Inlining ---

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

    console.log(`[${domain}] Generating website using inlined HTMX templates...`);

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
    
    // Render the final, inlined template string
    const renderedHtml = nunjucks.renderString(finalTemplateString, templateData);
    
    const deploymentSlug = `${domain.replace(/\./g, '-')}-${Date.now()}`;
    const deploymentUrl = `${req.headers.origin || 'https://domaintobiz.vercel.app'}/sites/${deploymentSlug}`;

    const { data: savedWebsite, error: dbError } = await supabase
      .from('generated_websites')
      .insert({
        domain: domain,
        original_domain: domain,
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

    console.log(`[${domain}] Website saved to DB with ID: ${savedWebsite.id}`);

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