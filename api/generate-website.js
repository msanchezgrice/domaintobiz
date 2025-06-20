import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

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
    // Validate request body
    if (!req.body) {
      return res.status(400).json({ error: 'Request body is required' });
    }

    let parsedBody;
    try {
      parsedBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (parseError) {
      return res.status(400).json({ 
        error: 'Invalid JSON in request body',
        details: parseError.message 
      });
    }

    const { domain, strategy, designSystem, websiteContent, executionId } = parsedBody;

    if (!domain || !strategy) {
      return res.status(400).json({ 
        error: 'Please provide domain and strategy data' 
      });
    }

    console.log(`🌐 Generating website for ${domain}`);

    // Generate unique deployment slug
    const deploymentSlug = `${domain.replace(/\./g, '-')}-${Date.now()}`;
    const deploymentUrl = `${req.headers.origin || 'https://domaintobiz.vercel.app'}/sites/${deploymentSlug}`;

    // Generate HTML content
    const htmlContent = generateHTML(domain, strategy, designSystem, websiteContent);
    const cssContent = generateCSS(designSystem);
    const jsContent = generateJS(domain);
    const manifestContent = generateManifest(domain, strategy);

    // Create deployment directory
    const deploymentPath = `/tmp/deployments/${deploymentSlug}`;
    try {
      mkdirSync(deploymentPath, { recursive: true });
      
      // Write files to deployment directory
      writeFileSync(join(deploymentPath, 'index.html'), htmlContent);
      writeFileSync(join(deploymentPath, 'styles.css'), cssContent);
      writeFileSync(join(deploymentPath, 'script.js'), jsContent);
      writeFileSync(join(deploymentPath, 'manifest.json'), manifestContent);
      
      console.log(`✅ Website files generated in ${deploymentPath}`);
    } catch (fsError) {
      console.warn('⚠️ Could not write to filesystem (Vercel limitation), storing in database only');
    }

    // Store website files in database
    const websiteRecord = {
      domain: domain,
      original_domain: domain,
      website_data: {
        strategy,
        designSystem,
        websiteContent,
        executionId
      },
      deployment_url: deploymentUrl,
      website_html: htmlContent,
      website_css: cssContent,
      website_js: jsContent,
      deployment_id: executionId,
      status: 'completed',
      completed_at: new Date().toISOString()
    };

    // Save to generated_websites table
    const { data: savedWebsite, error: dbError } = await supabase
      .from('generated_websites')
      .insert(websiteRecord)
      .select()
      .single();

    if (dbError) {
      console.error('❌ Database error:', dbError);
    } else {
      console.log('✅ Website saved to database with ID:', savedWebsite?.id);

      // Save individual files to website_files table
      const files = [
        { file_name: 'index.html', file_content: htmlContent, file_type: 'html' },
        { file_name: 'styles.css', file_content: cssContent, file_type: 'css' },
        { file_name: 'script.js', file_content: jsContent, file_type: 'js' },
        { file_name: 'manifest.json', file_content: manifestContent, file_type: 'json' }
      ];

      for (const file of files) {
        await supabase
          .from('website_files')
          .insert({
            website_id: savedWebsite.id,
            ...file
          });
      }

      // Create deployment record
      await supabase
        .from('website_deployments')
        .insert({
          website_id: savedWebsite.id,
          deployment_url: deploymentUrl,
          deployment_slug: deploymentSlug,
          deployment_status: 'ready',
          deployment_data: {
            domain,
            executionId,
            filesGenerated: files.length,
            generatedAt: new Date().toISOString()
          },
          deployed_at: new Date().toISOString()
        });
    }

    console.log(`🎉 Website generation completed for ${domain}`);

    return res.status(200).json({
      success: true,
      message: 'Website generated successfully',
      data: {
        domain,
        deploymentUrl,
        deploymentSlug,
        websiteId: savedWebsite?.id,
        files: ['index.html', 'styles.css', 'script.js', 'manifest.json'],
        status: 'completed'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Website generation failed:', error);
    return res.status(500).json({ 
      error: 'Website generation failed', 
      message: error.message
    });
  }
}

function generateHTML(domain, strategy, designSystem, websiteContent) {
  const metadata = websiteContent?.metadata || {
    title: `${strategy.brandStrategy?.businessName || domain} - ${strategy.brandStrategy?.positioning || 'Your Business Solution'}`,
    description: strategy.brandStrategy?.uniqueSellingProposition || `Welcome to ${domain}`,
    keywords: strategy.mvpScope?.keywords || ['business', 'innovation', 'solutions']
  };

  const sections = websiteContent?.sections || {};
  const hero = sections.hero || {
    title: strategy.brandStrategy?.businessName || domain,
    subtitle: strategy.brandStrategy?.positioning || 'Transform Your Business',
    content: strategy.brandStrategy?.uniqueSellingProposition || `Welcome to ${domain}`,
    cta: { primary: { text: 'Get Started', link: '#' }, secondary: { text: 'Learn More', link: '#features' } }
  };

  const features = sections.features?.items || strategy.mvpScope?.features?.map(f => ({
    title: f,
    description: `Experience the power of ${f} for your business growth.`
  })) || [];

  const pricing = sections.pricing?.items || [
    { title: 'Starter', price: '$29', period: '/month', description: 'Perfect for individuals getting started', features: ['Core features', 'Email support', 'Basic analytics'] },
    { title: 'Professional', price: '$79', period: '/month', description: 'Ideal for growing businesses', features: ['All Starter features', 'Priority support', 'Advanced analytics', 'Custom integrations'], featured: true },
    { title: 'Enterprise', price: '$199', period: '/month', description: 'For large organizations', features: ['All Professional features', 'Dedicated support', 'Custom solutions', 'SLA guarantee'] }
  ];

  const testimonials = sections.testimonials?.items || [
    { text: 'This service has completely transformed how we operate. The results exceeded our expectations.', author: 'Sarah Johnson', role: 'CEO, Tech Innovations' },
    { text: 'Outstanding support and incredible value. I would recommend this to anyone looking for quality solutions.', author: 'Michael Chen', role: 'Marketing Director' },
    { text: 'The team went above and beyond to ensure our success. Truly professional and reliable service.', author: 'Emily Rodriguez', role: 'Operations Manager' }
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${metadata.title}</title>
    <meta name="description" content="${metadata.description}">
    
    <!-- OpenGraph -->
    <meta property="og:title" content="${metadata.openGraph?.title || metadata.title}">
    <meta property="og:description" content="${metadata.openGraph?.description || metadata.description}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://${domain}">
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${metadata.twitter?.title || metadata.title}">
    <meta name="twitter:description" content="${metadata.twitter?.description || metadata.description}">
    
    <link rel="stylesheet" href="styles.css">
    <link rel="manifest" href="manifest.json">
    
    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
    
    <nav class="navbar">
        <div class="container">
            <div class="nav-wrapper">
                <a href="/" class="nav-logo">${strategy.brandStrategy?.businessName || domain}</a>
                <ul class="nav-menu">
                    <li><a href="#features">Features</a></li>
                    <li><a href="#pricing">Pricing</a></li>
                    <li><a href="#testimonials">Reviews</a></li>
                    <li><a href="#" class="btn btn-primary nav-cta">Get Started</a></li>
                </ul>
                <button class="nav-toggle" aria-label="Toggle menu">
                    <span></span>
                    <span></span>
                    <span></span>
                </button>
            </div>
        </div>
    </nav>
    
    <main>
        
    <section class="hero">
        <div class="container">
            <div class="hero-content">
                <h1 class="hero-headline">${hero.title}</h1>
                <p class="hero-subheadline">${hero.subtitle}</p>
                <div class="hero-cta">
                    <button class="btn btn-primary btn-lg" data-modal="signup">${hero.cta?.primary?.text || 'Get Started'}</button>
                    <a href="#features" class="btn btn-secondary btn-lg">${hero.cta?.secondary?.text || 'Learn More'}</a>
                </div>
            </div>
            <div class="hero-visual">
                <img src="https://via.placeholder.com/600x400" alt="Product showcase">
            </div>
        </div>
    </section>
        
    <section id="features" class="features">
        <div class="container">
            <div class="section-header">
                <h2 class="section-title">Key Features</h2>
                <p class="section-subtitle">Discover what makes us different</p>
            </div>
            <div class="features-grid">
                ${features.map(feature => `
        <div class="feature-card">
            <div class="feature-icon">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 11l3 3L22 4"></path>
                    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"></path>
                </svg>
            </div>
            <h3 class="feature-title">${feature.title}</h3>
            <p class="feature-description">${feature.description}</p>
        </div>
    `).join('')}
            </div>
        </div>
    </section>
        
    <section id="pricing" class="pricing">
        <div class="container">
            <div class="section-header">
                <h2 class="section-title">Pricing</h2>
                <p class="section-subtitle">Choose the plan that fits your needs</p>
            </div>
            <div class="pricing-grid">
                ${pricing.map(plan => `
        <div class="pricing-card ${plan.featured ? 'featured' : ''}">
            ${plan.featured ? '<div class="pricing-badge">Most Popular</div>' : ''}
            <h3 class="pricing-title">${plan.title}</h3>
            <div class="pricing-price">
                <span class="currency">$</span>
                <span class="amount">${plan.price.replace('$', '')}</span>
                <span class="period">${plan.period}</span>
            </div>
            <p class="pricing-description">${plan.description}</p>
            <ul class="pricing-features">
                ${plan.features.map(f => `<li>${f}</li>`).join('')}
            </ul>
            <button class="btn ${plan.featured ? 'btn-primary' : 'btn-secondary'} btn-block" data-modal="signup" data-plan="${plan.title}">
                ${plan.featured ? 'Get Started' : 'Start Free Trial'}
            </button>
        </div>
    `).join('')}
            </div>
        </div>
    </section>
        
    <section id="testimonials" class="testimonials">
        <div class="container">
            <div class="section-header">
                <h2 class="section-title">What Our Customers Say</h2>
                <p class="section-subtitle">See what our satisfied clients have to say about us</p>
            </div>
            <div class="testimonials-grid">
                ${testimonials.map(testimonial => `
        <div class="testimonial-card">
            <div class="testimonial-content">
                <p class="testimonial-text">"${testimonial.text}"</p>
            </div>
            <div class="testimonial-author">
                <img src="https://via.placeholder.com/48x48" alt="${testimonial.author}" class="testimonial-avatar">
                <div>
                    <p class="testimonial-name">${testimonial.author}</p>
                    <p class="testimonial-role">${testimonial.role}</p>
                </div>
            </div>
        </div>
    `).join('')}
            </div>
        </div>
    </section>
        
    <section class="cta-section">
        <div class="container">
            <div class="cta-content">
                <h2 class="cta-title">${sections.cta?.title || 'Ready to Get Started?'}</h2>
                <p class="cta-subtitle">${sections.cta?.subtitle || `Join ${domain} today and transform your business`}</p>
                <button class="btn btn-primary btn-lg" data-modal="signup">Start Your Free Trial</button>
            </div>
        </div>
    </section>
    </main>
    
    
    <footer class="footer">
        <div class="container">
            <div class="footer-content">
                <div class="footer-section">
                    <h4 class="footer-title">Product</h4>
                    <ul class="footer-links">
                        <li><a href="#features">Features</a></li>
                        <li><a href="#pricing">Pricing</a></li>
                        <li><a href="#testimonials">Reviews</a></li>
                    </ul>
                </div>
                <div class="footer-section">
                    <h4 class="footer-title">Company</h4>
                    <ul class="footer-links">
                        <li><a href="/about">About</a></li>
                        <li><a href="/blog">Blog</a></li>
                        <li><a href="/contact">Contact</a></li>
                    </ul>
                </div>
                <div class="footer-section">
                    <h4 class="footer-title">Legal</h4>
                    <ul class="footer-links">
                        <li><a href="/privacy">Privacy Policy</a></li>
                        <li><a href="/terms">Terms of Service</a></li>
                    </ul>
                </div>
                <div class="footer-section">
                    <h4 class="footer-title">Newsletter</h4>
                    <p class="footer-text">Stay updated with our latest news</p>
                    <form class="newsletter-form">
                        <input type="email" placeholder="Your email" required>
                        <button type="submit" class="btn btn-primary">Subscribe</button>
                    </form>
                </div>
            </div>
            <div class="footer-bottom">
                <p>&copy; 2025 ${domain}. All rights reserved</p>
            </div>
        </div>
    </footer>
    
    
    <div class="modal" id="signup-modal">
        <div class="modal-backdrop"></div>
        <div class="modal-content">
            <button class="modal-close" aria-label="Close modal">&times;</button>
            <h2 class="modal-title">Start Your Free Trial</h2>
            <p class="modal-subtitle">No credit card required</p>
            <form class="signup-form" id="signup-form">
                ${sections.contactForm?.fields?.map(field => `
                    <div class="form-group">
                        <input type="${field.type}" name="${field.name}" placeholder="${field.placeholder}" ${field.required ? 'required' : ''}>
                    </div>
                `).join('') || `
                    <div class="form-group">
                        <input type="email" name="email" placeholder="Enter your email" required>
                    </div>
                    <div class="form-group">
                        <input type="text" name="name" placeholder="Your name" required>
                    </div>
                    <div class="form-group">
                        <input type="text" name="company" placeholder="Company (optional)" >
                    </div>
                `}
                <button type="submit" class="btn btn-primary btn-block">Get Started</button>
                <p class="form-privacy">We respect your privacy. Unsubscribe at any time.</p>
            </form>
        </div>
    </div>
    
    <script src="script.js"></script>
</body>
</html>`;
}

function generateCSS(designSystem) {
  const colors = designSystem?.colors || designSystem?.colorPalette || {
    primary: '#6366f1',
    primaryDark: '#4f46e5',
    secondary: '#8b5cf6',
    accent: '#ec4899',
    background: '#ffffff',
    text: '#1f2937',
    textSecondary: '#6b7280',
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b'
  };

  const typography = designSystem?.typography || {
    primary: { family: 'Inter, system-ui, sans-serif' },
    sizes: {
      base: '16px',
      h1: '3rem',
      h2: '2.25rem',
      h3: '1.5rem'
    }
  };
  
  const spacing = designSystem?.spacing || {
    xs: '0.5rem',
    sm: '1rem',
    md: '1.5rem',
    lg: '2rem',
    xl: '4rem'
  };

  return `

:root {
    --color-primary: ${colors.primary};
    --color-primary-rgb: ${hexToRgb(colors.primary)};
    --color-secondary: ${colors.secondary};
    --color-accent: ${colors.accent};
    --color-background: ${colors.background};
    --color-text: ${colors.text};
    --color-text-secondary: ${colors.textSecondary};
    
    --font-primary: ${typography.primary?.family || 'Inter, system-ui, sans-serif'};
    --font-secondary: ${typography.secondary?.family || typography.primary?.family || 'Inter, system-ui, sans-serif'};
    --font-size-base: ${typography.sizes?.base || '16px'};
    --font-size-h1: ${typography.sizes?.h1 || '3rem'};
    --font-size-h2: ${typography.sizes?.h2 || '2.25rem'};
    --font-size-h3: ${typography.sizes?.h3 || '1.5rem'};
    
    --space-xs: ${spacing.xs || '0.5rem'};
    --space-sm: ${spacing.sm || '1rem'};
    --space-md: ${spacing.md || '1.5rem'};
    --space-lg: ${spacing.lg || '2rem'};
    --space-xl: ${spacing.xl || '4rem'};
    
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
    --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
    --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
    
    --radius-sm: 4px;
    --radius-md: 8px;
    --radius-lg: 16px;
}

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    font-family: var(--font-primary);
    font-size: var(--font-size-base);
    color: var(--color-text);
    background-color: var(--color-background);
    line-height: 1.6;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 var(--space-md);
}

.btn {
    display: inline-block;
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-md);
    font-weight: 600;
    text-decoration: none;
    transition: all 0.3s ease;
    cursor: pointer;
    border: none;
}

.btn-primary {
    background-color: var(--color-primary);
    color: white;
}

.btn-primary:hover {
    background-color: ${colors.primaryDark || '#5558e3'};
}

.btn-secondary {
    background-color: transparent;
    color: var(--color-primary);
    border: 2px solid var(--color-primary);
}

.btn-secondary:hover {
    background-color: var(--color-primary);
    color: white;
}
    

/* Navigation */
.navbar {
    background-color: var(--color-background);
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    position: sticky;
    top: 0;
    z-index: 100;
}

.nav-wrapper {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-md) 0;
}

.nav-logo {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-primary);
    text-decoration: none;
}

.nav-menu {
    display: flex;
    list-style: none;
    gap: var(--space-lg);
    align-items: center;
}

.nav-menu a {
    color: var(--color-text);
    text-decoration: none;
    font-weight: 500;
    transition: color 0.3s;
}

.nav-menu a:hover {
    color: var(--color-primary);
}

.nav-toggle {
    display: none;
    flex-direction: column;
    background: none;
    border: none;
    cursor: pointer;
}

.nav-toggle span {
    width: 25px;
    height: 3px;
    background-color: var(--color-text);
    margin: 3px 0;
    transition: 0.3s;
}

/* Hero Section */
.hero {
    padding: var(--space-xl) 0;
    background: linear-gradient(135deg, var(--color-background) 0%, rgba(var(--color-primary-rgb), 0.05) 100%);
}

.hero-content {
    max-width: 600px;
}

.hero-headline {
    font-size: var(--font-size-h1);
    font-weight: 700;
    margin-bottom: var(--space-md);
    line-height: 1.2;
}

.hero-subheadline {
    font-size: 1.25rem;
    color: var(--color-text-secondary);
    margin-bottom: var(--space-lg);
}

.hero-cta {
    display: flex;
    gap: var(--space-md);
    flex-wrap: wrap;
}

/* Features Section */
.features {
    padding: var(--space-xl) 0;
}

.section-header {
    text-align: center;
    margin-bottom: var(--space-xl);
}

.section-title {
    font-size: var(--font-size-h2);
    font-weight: 700;
    margin-bottom: var(--space-sm);
}

.section-subtitle {
    font-size: 1.125rem;
    color: var(--color-text-secondary);
}

.features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: var(--space-lg);
}

.feature-card {
    text-align: center;
    padding: var(--space-lg);
}

.feature-icon {
    width: 48px;
    height: 48px;
    margin: 0 auto var(--space-md);
    color: var(--color-primary);
}

.feature-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: var(--space-sm);
}

.feature-description {
    color: var(--color-text-secondary);
}

/* Pricing Section */
.pricing {
    padding: var(--space-xl) 0;
    background-color: rgba(0, 0, 0, 0.02);
}

.pricing-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: var(--space-lg);
    max-width: 1000px;
    margin: 0 auto;
}

.pricing-card {
    background: white;
    border-radius: var(--radius-lg);
    padding: var(--space-lg);
    position: relative;
    box-shadow: var(--shadow-md);
    transition: transform 0.3s, box-shadow 0.3s;
}

.pricing-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-lg);
}

.pricing-card.featured {
    border: 2px solid var(--color-primary);
}

.pricing-badge {
    position: absolute;
    top: -12px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--color-primary);
    color: white;
    padding: 4px 16px;
    border-radius: 20px;
    font-size: 0.875rem;
    font-weight: 600;
}

.pricing-title {
    font-size: 1.5rem;
    margin-bottom: var(--space-md);
}

.pricing-price {
    display: flex;
    align-items: baseline;
    margin-bottom: var(--space-md);
}

.currency {
    font-size: 1.5rem;
    color: var(--color-text-secondary);
}

.amount {
    font-size: 3rem;
    font-weight: 700;
    margin: 0 4px;
}

.period {
    color: var(--color-text-secondary);
}

.pricing-features {
    list-style: none;
    margin: var(--space-lg) 0;
}

.pricing-features li {
    padding: var(--space-sm) 0;
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.pricing-features li:before {
    content: "✓";
    color: var(--color-primary);
    font-weight: bold;
    margin-right: var(--space-sm);
}

/* Testimonials */
.testimonials {
    padding: var(--space-xl) 0;
}

.testimonials-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: var(--space-lg);
}

.testimonial-card {
    background: white;
    border-radius: var(--radius-lg);
    padding: var(--space-lg);
    box-shadow: var(--shadow-md);
}

.testimonial-text {
    font-size: 1.125rem;
    line-height: 1.6;
    margin-bottom: var(--space-lg);
}

.testimonial-author {
    display: flex;
    align-items: center;
    gap: var(--space-md);
}

.testimonial-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
}

.testimonial-name {
    font-weight: 600;
}

.testimonial-role {
    color: var(--color-text-secondary);
    font-size: 0.875rem;
}

/* CTA Section */
.cta-section {
    padding: var(--space-xl) 0;
    background: var(--color-primary);
    color: white;
    text-align: center;
}

.cta-title {
    font-size: var(--font-size-h2);
    margin-bottom: var(--space-md);
}

.cta-subtitle {
    font-size: 1.25rem;
    margin-bottom: var(--space-lg);
    opacity: 0.9;
}

.cta-section .btn-primary {
    background: white;
    color: var(--color-primary);
}

/* Footer */
.footer {
    background: var(--color-text);
    color: white;
    padding: var(--space-xl) 0 var(--space-lg);
}

.footer-content {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: var(--space-lg);
    margin-bottom: var(--space-lg);
}

.footer-title {
    margin-bottom: var(--space-md);
}

.footer-links {
    list-style: none;
}

.footer-links a {
    color: rgba(255, 255, 255, 0.8);
    text-decoration: none;
    display: block;
    padding: var(--space-xs) 0;
}

.footer-links a:hover {
    color: white;
}

.newsletter-form {
    display: flex;
    gap: var(--space-sm);
    margin-top: var(--space-md);
}

.newsletter-form input {
    flex: 1;
    padding: var(--space-sm);
    border: none;
    border-radius: var(--radius-md);
}

.footer-bottom {
    text-align: center;
    padding-top: var(--space-lg);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.6);
}

/* Modal */
.modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1000;
}

.modal.active {
    display: flex;
    align-items: center;
    justify-content: center;
}

.modal-backdrop {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
}

.modal-content {
    background: white;
    border-radius: var(--radius-lg);
    padding: var(--space-xl);
    max-width: 500px;
    width: 90%;
    position: relative;
    z-index: 1;
}

.modal-close {
    position: absolute;
    top: var(--space-md);
    right: var(--space-md);
    background: none;
    border: none;
    font-size: 2rem;
    cursor: pointer;
    color: var(--color-text-secondary);
}

.modal-title {
    font-size: var(--font-size-h3);
    margin-bottom: var(--space-sm);
}

.modal-subtitle {
    color: var(--color-text-secondary);
    margin-bottom: var(--space-lg);
}

/* Forms */
.form-group {
    margin-bottom: var(--space-md);
}

.form-group input,
.form-group textarea {
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: var(--radius-md);
    font-size: 1rem;
    transition: border-color 0.3s;
}

.form-group input:focus,
.form-group textarea:focus {
    outline: none;
    border-color: var(--color-primary);
}

.form-privacy {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    text-align: center;
    margin-top: var(--space-md);
}

/* Utility Classes */
.btn-lg {
    padding: var(--space-md) var(--space-lg);
    font-size: 1.125rem;
}

.btn-block {
    width: 100%;
}

.icon {
    width: 100%;
    height: 100%;
}

/* Responsive */
@media (max-width: 768px) {
    .nav-menu {
        display: none;
    }
    
    .nav-toggle {
        display: flex;
    }
    
    .hero-headline {
        font-size: 2rem;
    }
    
    .hero-cta {
        flex-direction: column;
    }
    
    .pricing-grid {
        grid-template-columns: 1fr;
    }
    
    .newsletter-form {
        flex-direction: column;
    }
}`;
}

// Helper function to convert hex to RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result 
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '0, 0, 0';
}

function generateJS(domain) {
  return `// Modern Website functionality for ${domain}

// Utility functions
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// Intersection Observer for animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Modern website loaded for ${domain}');
    
    // Initialize all features
    initNavigation();
    initScrollEffects();
    initAnimations();
    initContactForm();
    initMobileMenu();
    initParallax();
    initCounters();
    
    // Analytics tracking
    trackPageView();
});

// Navigation functionality
function initNavigation() {
    // Smooth scrolling for navigation links
    const navLinks = $$('.nav-link[href^="#"], .btn[href^="#"]');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                const headerHeight = $('.header').offsetHeight;
                const targetPosition = targetElement.offsetTop - headerHeight;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
                
                // Close mobile menu if open
                const navMenu = $('.nav-menu');
                if (navMenu) {
                    navMenu.classList.remove('active');
                }
            }
        });
    });
    
    // Active navigation highlighting
    const sections = $$('section[id]');
    const navLinksArray = Array.from(navLinks);
    
    window.addEventListener('scroll', () => {
        const scrollPosition = window.scrollY + 100;
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            const sectionId = section.getAttribute('id');
            
            if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                navLinksArray.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === \`#\${sectionId}\`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    });
}

// Scroll effects for header
function initScrollEffects() {
    const header = $('.header');
    let lastScrollY = 0;
    
    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;
        
        // Header background opacity
        if (scrollY > 50) {
            header.style.background = 'rgba(255, 255, 255, 0.95)';
            header.style.backdropFilter = 'blur(20px)';
            header.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.1)';
        } else {
            header.style.background = 'rgba(255, 255, 255, 0.95)';
            header.style.backdropFilter = 'blur(20px)';
            header.style.boxShadow = 'none';
        }
        
        // Header hide/show on scroll
        if (scrollY > lastScrollY && scrollY > 100) {
            header.style.transform = 'translateY(-100%)';
        } else {
            header.style.transform = 'translateY(0)';
        }
        
        lastScrollY = scrollY;
    });
}

// Animation initialization
function initAnimations() {
    // Fade in animations for cards and elements
    const animatedElements = $$('.feature-card, .hero-content, .about-text, .contact-content');
    
    animatedElements.forEach(element => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(30px)';
        element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(element);
    });
    
    // Stagger animation for feature cards
    const featureCards = $$('.feature-card');
    featureCards.forEach((card, index) => {
        card.style.transitionDelay = \`\${index * 0.1}s\`;
    });
    
    // Button hover effects
    const buttons = $$('.btn');
    buttons.forEach(button => {
        button.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px)';
        });
        
        button.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });
}

// Enhanced contact form handling
function initContactForm() {
    const contactForm = $('.contact-form');
    if (!contactForm) return;
    
    const submitButton = contactForm.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.innerHTML;
    
    contactForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Get form data
        const formData = new FormData(this);
        const email = this.querySelector('#email').value;
        const name = this.querySelector('#name').value;
        const message = this.querySelector('#message').value;
        
        // Validation
        if (!email || !email.includes('@')) {
            showNotification('Please enter a valid email address.', 'error');
            return;
        }
        
        if (!name.trim()) {
            showNotification('Please enter your name.', 'error');
            return;
        }
        
        // Show loading state
        submitButton.disabled = true;
        submitButton.innerHTML = '<span class="btn-text">Sending...</span>';
        
        // Simulate API call (replace with actual submission logic)
        setTimeout(() => {
            showNotification(\`Thank you, \${name}! We'll be in touch soon.\`, 'success');
            contactForm.reset();
            
            // Reset button
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonText;
            
            // Track conversion
            trackEvent('form_submit', {
                form_type: 'contact',
                domain: '${domain}'
            });
        }, 1500);
    });
    
    // Real-time validation
    const inputs = contactForm.querySelectorAll('input, textarea');
    inputs.forEach(input => {
        input.addEventListener('blur', function() {
            validateField(this);
        });
        
        input.addEventListener('input', function() {
            if (this.classList.contains('error')) {
                validateField(this);
            }
        });
    });
}

// Field validation
function validateField(field) {
    const value = field.value.trim();
    const fieldType = field.type;
    const fieldId = field.id;
    
    let isValid = true;
    let errorMessage = '';
    
    if (fieldType === 'email') {
        if (!value || !value.includes('@')) {
            isValid = false;
            errorMessage = 'Please enter a valid email address.';
        }
    } else if (fieldId === 'name') {
        if (!value) {
            isValid = false;
            errorMessage = 'Please enter your name.';
        }
    }
    
    if (isValid) {
        field.classList.remove('error');
        field.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    } else {
        field.classList.add('error');
        field.style.borderColor = '#ef4444';
    }
    
    return isValid;
}

// Mobile menu functionality
function initMobileMenu() {
    const navToggle = $('.nav-toggle');
    const navMenu = $('.nav-menu');
    
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', function() {
            navMenu.classList.toggle('active');
            this.classList.toggle('active');
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', function(e) {
            if (!navToggle.contains(e.target) && !navMenu.contains(e.target)) {
                navMenu.classList.remove('active');
                navToggle.classList.remove('active');
            }
        });
    }
}

// Parallax effect for hero section
function initParallax() {
    const heroShapes = $$('.shape');
    
    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;
        const rate = scrollY * -0.5;
        
        heroShapes.forEach((shape, index) => {
            const speed = 0.1 + (index * 0.05);
            shape.style.transform = \`translateY(\${rate * speed}px)\`;
        });
    });
}

// Animated counters
function initCounters() {
    const counters = $$('.stat-number');
    
    const animateCounter = (counter) => {
        const target = parseInt(counter.textContent.replace(/[^0-9]/g, ''));
        const duration = 2000;
        const step = target / (duration / 16);
        let current = 0;
        
        const updateCounter = () => {
            current += step;
            if (current < target) {
                counter.textContent = Math.floor(current) + (counter.textContent.includes('+') ? '+' : counter.textContent.includes('%') ? '%' : '');
                requestAnimationFrame(updateCounter);
            } else {
                counter.textContent = counter.textContent; // Reset to original
            }
        };
        
        updateCounter();
    };
    
    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
                counterObserver.unobserve(entry.target);
            }
        });
    });
    
    counters.forEach(counter => {
        counterObserver.observe(counter);
    });
}

// Notification system
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = \`notification notification-\${type}\`;
    notification.textContent = message;
    
    // Add styles
    notification.style.cssText = \`
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        transform: translateX(100%);
        transition: transform 0.3s ease;
        max-width: 400px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    \`;
    
    // Set background color based on type
    if (type === 'success') {
        notification.style.background = 'linear-gradient(135deg, #10b981, #059669)';
    } else if (type === 'error') {
        notification.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
    } else {
        notification.style.background = 'linear-gradient(135deg, #6366f1, #4f46e5)';
    }
    
    document.body.appendChild(notification);
    
    // Animate in
    requestAnimationFrame(() => {
        notification.style.transform = 'translateX(0)';
    });
    
    // Auto remove
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 4000);
}

// Analytics and tracking
function trackPageView() {
    // Google Analytics 4
    if (typeof gtag !== 'undefined') {
        gtag('event', 'page_view', {
            page_title: document.title,
            page_location: window.location.href,
            custom_parameter: 'generated_website'
        });
    }
    
    // Custom analytics
    console.log('📊 Page view tracked for ${domain}');
}

function trackEvent(eventName, parameters = {}) {
    // Google Analytics 4
    if (typeof gtag !== 'undefined') {
        gtag('event', eventName, {
            ...parameters,
            domain: '${domain}',
            timestamp: new Date().toISOString()
        });
    }
    
    console.log('📊 Event tracked:', eventName, parameters);
}

// Performance optimization
function optimizePerformance() {
    // Lazy load images
    const images = $$('img[data-src]');
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                imageObserver.unobserve(img);
            }
        });
    });
    
    images.forEach(img => imageObserver.observe(img));
    
    // Preload critical resources
    const criticalResources = [
        'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap'
    ];
    
    criticalResources.forEach(resource => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = resource;
        link.as = 'style';
        document.head.appendChild(link);
    });
}

// Initialize performance optimizations
optimizePerformance();

// Error handling
window.addEventListener('error', function(e) {
    console.error('JavaScript error:', e.error);
    trackEvent('javascript_error', {
        error_message: e.message,
        error_filename: e.filename,
        error_lineno: e.lineno
    });
});

// Expose utility functions globally
window.WebsiteUtils = {
    showNotification,
    trackEvent,
    $,
    $$
};

console.log('✨ Modern website functionality initialized for ${domain}!');`;
}

function generateManifest(domain, strategy) {
  return JSON.stringify({
    name: `${domain} - ${strategy.brandStrategy?.positioning || 'Business Solution'}`,
    short_name: domain,
    description: strategy.businessModel?.description || `Business website for ${domain}`,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#3B82F6",
    icons: [
      {
        src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%233B82F6'/%3E%3Ctext x='50' y='55' font-family='Arial' font-size='40' fill='white' text-anchor='middle'%3E${domain.charAt(0).toUpperCase()}%3C/text%3E%3C/svg%3E",
        sizes: "192x192",
        type: "image/svg+xml"
      }
    ]
  }, null, 2);
}