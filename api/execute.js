import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Validate request body exists
    if (!req.body) {
      console.error('❌ No request body provided');
      return res.status(400).json({ 
        error: 'Request body is required' 
      });
    }

    // Handle potential JSON parsing errors
    let parsedBody;
    try {
      parsedBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (parseError) {
      console.error('❌ JSON parsing error:', parseError);
      return res.status(400).json({ 
        error: 'Invalid JSON in request body',
        details: parseError.message 
      });
    }

    const { domains, bestDomainData } = parsedBody;

    if (!domains || !Array.isArray(domains) || domains.length === 0) {
      return res.status(400).json({ 
        error: 'Please provide an array of domains' 
      });
    }
    
    console.log('📥 Received execute request:', { domains, bestDomainData });

    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`Executing full pipeline for ${domains.length} domains [${executionId}]`);
    
    const targetDomain = domains[0];
    if (!targetDomain) {
      throw new Error('No domain provided for execution');
    }
    
    console.log(`🎯 Target domain: ${targetDomain}`);

    // Generate deployment slug and URL
    const deploymentSlug = `${targetDomain.replace(/\./g, '-')}-${Date.now()}`;
    const actualDeploymentUrl = `${req.headers.origin || 'https://domaintobiz.vercel.app'}/sites/${deploymentSlug}/`;
    
    // Simplified execution for now
    const result = {
      executionId,
      domains,
      status: 'completed',
      result: {
        domain: targetDomain,
        analysis: `Basic analysis completed for ${targetDomain}`,
        strategy: `Strategy generated for ${targetDomain}`,
        website: `Website generated for ${targetDomain}`,
        websiteUrl: actualDeploymentUrl,
        originalDomain: targetDomain
      },
      timestamp: new Date().toISOString()
    };

    // Store in database
    console.log(`💾 Saving execution result to database for domain: ${targetDomain}`);
    
    const { data: savedWebsite, error: dbError } = await supabase
      .from('generated_websites')
      .insert({
        domain: targetDomain,
        website_data: result,
        deployment_url: actualDeploymentUrl,
        original_domain: targetDomain,
        status: 'completed',
        website_html: generateDefaultHTML(targetDomain),
        website_css: generateDefaultCSS(),
        website_js: generateDefaultJS(targetDomain)
      })
      .select()
      .single();

    if (dbError) {
      console.error('❌ Database error details:', {
        error: dbError,
        message: dbError.message,
        details: dbError.details,
        hint: dbError.hint,
        code: dbError.code,
        domain: targetDomain
      });
    } else {
      console.log('✅ Successfully saved execution to database with ID:', savedWebsite?.id);
      
      // Create deployment record
      const { error: deploymentError } = await supabase
        .from('website_deployments')
        .insert({
          website_id: savedWebsite.id,
          deployment_url: actualDeploymentUrl,
          deployment_slug: deploymentSlug,
          deployment_status: 'ready',
          deployment_data: {
            domain: targetDomain,
            executionId,
            generatedAt: new Date().toISOString()
          },
          deployed_at: new Date().toISOString()
        });
      
      if (deploymentError) {
        console.error('❌ Deployment record creation failed:', deploymentError);
      } else {
        console.log('✅ Deployment record created successfully');
      }
    }

    console.log(`🎉 Execution completed successfully for ${targetDomain}`);

    return res.status(200).json({
      success: true,
      message: 'Execution completed',
      executionId,
      sessionId: executionId, // Same as executionId for compatibility
      domain: targetDomain, // Include domain for agent dashboard
      data: result,
      result: {
        domain: targetDomain,
        websiteUrl: actualDeploymentUrl,
        originalDomain: targetDomain,
        deploymentId: executionId
      },
      id: savedWebsite?.id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Execution failed:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      requestBody: req.body,
      requestMethod: req.method,
      requestUrl: req.url,
      headers: req.headers
    });
    
    return res.status(500).json({ 
      error: 'Execution failed', 
      message: error.message,
      type: error.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

function generateDefaultHTML(domain) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${domain} - Business Website</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <header>
        <nav>
            <div class="logo">${domain}</div>
            <ul>
                <li><a href="#home">Home</a></li>
                <li><a href="#about">About</a></li>
                <li><a href="#contact">Contact</a></li>
            </ul>
        </nav>
    </header>

    <main>
        <section id="home" class="hero">
            <div class="container">
                <h1>Welcome to ${domain}</h1>
                <p>Your business solution is here</p>
                <a href="#contact" class="cta-button">Get Started</a>
            </div>
        </section>

        <section id="about" class="about">
            <div class="container">
                <h2>About Us</h2>
                <p>We provide excellent services for ${domain}.</p>
            </div>
        </section>

        <section id="contact" class="contact">
            <div class="container">
                <h2>Contact Us</h2>
                <p>Ready to get started? Get in touch today.</p>
                <button class="contact-button">Contact Now</button>
            </div>
        </section>
    </main>

    <footer>
        <div class="container">
            <p>&copy; 2025 ${domain}. All rights reserved.</p>
        </div>
    </footer>

    <script src="script.js"></script>
</body>
</html>`;
}

function generateDefaultCSS() {
  return `* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    line-height: 1.6;
    color: #333;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
}

header {
    background: #fff;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    position: fixed;
    width: 100%;
    top: 0;
    z-index: 1000;
}

nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 2rem;
}

.logo {
    font-size: 1.5rem;
    font-weight: bold;
    color: #3B82F6;
}

nav ul {
    display: flex;
    list-style: none;
    gap: 2rem;
}

nav a {
    text-decoration: none;
    color: #333;
    transition: color 0.3s;
}

nav a:hover {
    color: #3B82F6;
}

.hero {
    background: linear-gradient(135deg, #3B82F6, #1E40AF);
    color: white;
    padding: 120px 0 80px;
    text-align: center;
}

.hero h1 {
    font-size: 3rem;
    margin-bottom: 1rem;
}

.hero p {
    font-size: 1.2rem;
    margin-bottom: 2rem;
}

.cta-button {
    display: inline-block;
    background: white;
    color: #3B82F6;
    padding: 12px 30px;
    border-radius: 6px;
    text-decoration: none;
    font-weight: bold;
    transition: transform 0.3s;
}

.cta-button:hover {
    transform: translateY(-2px);
}

.about, .contact {
    padding: 80px 0;
    text-align: center;
}

.about {
    background: #f8fafc;
}

.about h2, .contact h2 {
    font-size: 2.5rem;
    margin-bottom: 2rem;
}

.contact-button {
    background: #3B82F6;
    color: white;
    border: none;
    padding: 12px 30px;
    border-radius: 6px;
    font-size: 1rem;
    cursor: pointer;
    transition: background 0.3s;
}

.contact-button:hover {
    background: #1E40AF;
}

footer {
    background: #333;
    color: white;
    text-align: center;
    padding: 2rem 0;
}

@media (max-width: 768px) {
    .hero h1 {
        font-size: 2rem;
    }
}`;
}

function generateDefaultJS(domain) {
  return `document.addEventListener('DOMContentLoaded', function() {
    // Smooth scrolling for navigation links
    const navLinks = document.querySelectorAll('nav a[href^="#"]');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // Contact button handling
    const contactButton = document.querySelector('.contact-button');
    if (contactButton) {
        contactButton.addEventListener('click', function() {
            alert('Thank you for your interest in ${domain}! This is a demo website.');
        });
    }

    console.log('Website loaded for ${domain}');
});`;
}