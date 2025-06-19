import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const { slug } = req.query;

  if (!slug) {
    return res.status(400).json({ error: 'Site slug is required' });
  }

  try {
    // Get deployment by slug
    const { data: deployment, error: deploymentError } = await supabase
      .from('website_deployments')
      .select(`
        *,
        generated_websites (
          website_html,
          website_css,
          website_js,
          domain,
          website_data
        )
      `)
      .eq('deployment_slug', slug)
      .eq('deployment_status', 'ready')
      .single();

    if (deploymentError || !deployment) {
      return res.status(404).json({ error: 'Website not found' });
    }

    const website = deployment.generated_websites;
    const requestedFile = req.url.split('/').pop() || 'index.html';

    // Set appropriate headers
    res.setHeader('Cache-Control', 'public, max-age=3600');

    // Serve different file types
    switch (requestedFile) {
      case 'styles.css':
        res.setHeader('Content-Type', 'text/css');
        return res.status(200).send(website.website_css || '/* No styles */');
      
      case 'script.js':
        res.setHeader('Content-Type', 'application/javascript');
        return res.status(200).send(website.website_js || '// No scripts');
      
      case 'manifest.json':
        res.setHeader('Content-Type', 'application/json');
        const manifest = {
          name: website.domain,
          short_name: website.domain,
          start_url: "/",
          display: "standalone",
          background_color: "#ffffff",
          theme_color: "#3B82F6"
        };
        return res.status(200).json(manifest);
      
      default:
        // Serve HTML for all other requests
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(website.website_html || '<h1>Website not found</h1>');
    }

  } catch (error) {
    console.error('Error serving website:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}