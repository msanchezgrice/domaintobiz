import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    // Create Supabase client inside the handler to ensure env vars are available
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    
    const { slug, file } = req.query;

    if (!slug) {
      return res.status(400).json({ error: 'Site slug is required' });
    }

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
      .single();

    if (deploymentError || !deployment) {
      // Fallback: try to find by deployment_url containing the slug
      const { data: fallbackDeployment, error: fallbackError } = await supabase
        .from('generated_websites')
        .select('*')
        .ilike('deployment_url', `%${slug}%`)
        .eq('status', 'completed')
        .single();

      if (fallbackError || !fallbackDeployment) {
        return res.status(404).json({ error: 'Website not found' });
      }

      // Use the fallback data
      const website = fallbackDeployment;
      return serveWebsiteContent(res, website, file);
    }

    const website = deployment.generated_websites;
    return serveWebsiteContent(res, website, file);

  } catch (error) {
    console.error('Error serving website:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

function serveWebsiteContent(res, website, file) {
  const requestedFile = file || 'index.html';

  // Set appropriate headers
  res.setHeader('Cache-Control', 'public, max-age=3600');

  // Serve different file types
  switch (requestedFile) {
    case 'styles.css':
      res.setHeader('Content-Type', 'text/css');
      return res.status(200).send(website.website_css || getDefaultCSS());
    
    case 'script.js':
      res.setHeader('Content-Type', 'application/javascript');
      return res.status(200).send(website.website_js || getDefaultJS());
    
    case 'manifest.json':
      res.setHeader('Content-Type', 'application/json');
      const manifest = {
        name: website.domain || 'Generated Website',
        short_name: website.domain || 'Website',
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#3B82F6"
      };
      return res.status(200).json(manifest);
    
    default:
      // Serve HTML for all other requests
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(website.website_html || getDefaultHTML(website));
  }
}

function getDefaultHTML(website) {
  const domain = website?.domain || 'Business Website';
  const businessType = website?.website_data?.strategy?.businessModel?.type || 'Business';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${domain} - ${businessType}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', sans-serif; line-height: 1.6; color: #333; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }
        .container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
        .hero { text-align: center; padding: 100px 0 80px; color: white; }
        .hero h1 { font-size: 3.5rem; margin-bottom: 1rem; font-weight: 700; }
        .tagline { font-size: 1.3rem; margin-bottom: 2rem; opacity: 0.9; }
        .cta-button { display: inline-block; background: white; color: #667eea; padding: 15px 30px; border-radius: 30px; text-decoration: none; font-weight: 600; font-size: 1.1rem; transition: transform 0.3s ease; }
        .cta-button:hover { transform: translateY(-2px); }
        .features { background: white; padding: 80px 0; margin: 0 -20px; }
        .features h2 { text-align: center; font-size: 2.5rem; margin-bottom: 3rem; color: #333; }
        .feature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; max-width: 1000px; margin: 0 auto; padding: 0 20px; }
        .feature { text-align: center; padding: 2rem; border-radius: 10px; background: #f8f9fa; transition: transform 0.3s ease; }
        .feature:hover { transform: translateY(-5px); }
        .feature h3 { font-size: 1.5rem; margin-bottom: 1rem; color: #667eea; }
        .contact { text-align: center; padding: 80px 0; color: white; }
        .contact h2 { font-size: 2.5rem; margin-bottom: 1rem; }
        .contact p { font-size: 1.2rem; margin-bottom: 2rem; opacity: 0.9; }
        .contact-button { background: transparent; border: 2px solid white; color: white; padding: 15px 30px; border-radius: 30px; font-size: 1.1rem; font-weight: 600; cursor: pointer; transition: all 0.3s ease; }
        .contact-button:hover { background: white; color: #667eea; }
        @media (max-width: 768px) { .hero h1 { font-size: 2.5rem; } .feature-grid { grid-template-columns: 1fr; } .container { padding: 0 15px; } }
    </style>
</head>
<body>
    <div class="container">
        <header class="hero">
            <h1>${domain}</h1>
            <p class="tagline">Your ${businessType} Solution</p>
            <a href="#contact" class="cta-button">Get Started</a>
        </header>
        
        <section class="features">
            <h2>What We Offer</h2>
            <div class="feature-grid">
                <div class="feature">
                    <h3>Quality Service</h3>
                    <p>Professional solutions tailored to your needs</p>
                </div>
                <div class="feature">
                    <h3>Expert Team</h3>
                    <p>Experienced professionals ready to help</p>
                </div>
                <div class="feature">
                    <h3>Fast Delivery</h3>
                    <p>Quick turnaround times without compromising quality</p>
                </div>
            </div>
        </section>
        
        <section id="contact" class="contact">
            <h2>Get In Touch</h2>
            <p>Ready to start your project? Contact us today!</p>
            <button class="contact-button" onclick="alert('Thank you for your interest! This is a demo website generated by AI.')">Contact Us</button>
        </section>
    </div>
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            console.log('AI-generated website loaded successfully!');
        });
    </script>
</body>
</html>`;
}

function getDefaultCSS() {
  return `* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    line-height: 1.6;
    color: #333;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
}

.hero {
    text-align: center;
    padding: 100px 0 80px;
    color: white;
}

.hero h1 {
    font-size: 3.5rem;
    margin-bottom: 1rem;
    font-weight: 700;
}

.cta-button {
    display: inline-block;
    background: white;
    color: #667eea;
    padding: 15px 30px;
    border-radius: 30px;
    text-decoration: none;
    font-weight: 600;
    font-size: 1.1rem;
    transition: transform 0.3s ease;
}

.cta-button:hover {
    transform: translateY(-2px);
}`;
}

function getDefaultJS() {
  return `document.addEventListener('DOMContentLoaded', function() {
    console.log('AI-generated website loaded successfully!');
    
    // Contact button interaction
    const contactButton = document.querySelector('.contact-button');
    if (contactButton) {
        contactButton.addEventListener('click', function() {
            alert('Thank you for your interest! This is a demo website generated by AI.');
        });
    }
});`;
}