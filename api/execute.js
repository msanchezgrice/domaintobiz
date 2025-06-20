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
    const actualDeploymentUrl = `${req.headers.origin || 'https://domaintobiz.vercel.app'}/sites/${deploymentSlug}`;
    
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
    <meta name="description" content="Professional business solutions and services from ${domain}">
    <meta name="keywords" content="business, services, ${domain}, professional">
    <title>${domain} - Transform Your Business Today</title>
    <link rel="stylesheet" href="styles.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%236366F1'/%3E%3Ctext x='50' y='55' font-family='Arial' font-size='40' fill='white' text-anchor='middle'%3E${domain.charAt(0).toUpperCase()}%3C/text%3E%3C/svg%3E">
</head>
<body>
    <header class="header">
        <nav class="navbar">
            <div class="nav-container">
                <div class="nav-brand">
                    <div class="logo-icon">${domain.charAt(0).toUpperCase()}</div>
                    <span class="logo-text">${domain}</span>
                </div>
                <ul class="nav-menu">
                    <li class="nav-item"><a href="#home" class="nav-link">Home</a></li>
                    <li class="nav-item"><a href="#services" class="nav-link">Services</a></li>
                    <li class="nav-item"><a href="#about" class="nav-link">About</a></li>
                    <li class="nav-item"><a href="#contact" class="nav-link">Contact</a></li>
                </ul>
                <button class="nav-toggle" aria-label="Toggle navigation">
                    <span class="hamburger"></span>
                </button>
            </div>
        </nav>
    </header>

    <main>
        <section id="home" class="hero">
            <div class="hero-background">
                <div class="hero-shapes">
                    <div class="shape shape-1"></div>
                    <div class="shape shape-2"></div>
                    <div class="shape shape-3"></div>
                </div>
            </div>
            <div class="container">
                <div class="hero-content">
                    <div class="hero-badge">
                        <span class="badge-icon">✨</span>
                        <span class="badge-text">Professional Business Solutions</span>
                    </div>
                    <h1 class="hero-title">Transform Your Business with ${domain}</h1>
                    <p class="hero-subtitle">Discover professional solutions that drive growth, enhance efficiency, and deliver exceptional results for your business.</p>
                    <div class="hero-cta">
                        <a href="#contact" class="btn btn-primary">
                            Get Started Today
                            <span class="btn-icon">→</span>
                        </a>
                        <a href="#services" class="btn btn-secondary">
                            Learn More
                        </a>
                    </div>
                    <div class="hero-stats">
                        <div class="stat-item">
                            <div class="stat-number">500+</div>
                            <div class="stat-label">Happy Clients</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-number">99%</div>
                            <div class="stat-label">Success Rate</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-number">24/7</div>
                            <div class="stat-label">Support</div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <section id="services" class="services">
            <div class="container">
                <div class="section-header">
                    <h2 class="section-title">Our Services</h2>
                    <p class="section-subtitle">Comprehensive solutions tailored to your business needs</p>
                </div>
                <div class="services-grid">
                    <div class="service-card">
                        <div class="service-icon">
                            <div class="icon-bg">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor"/>
                                </svg>
                            </div>
                        </div>
                        <h3 class="service-title">Quality Service</h3>
                        <p class="service-description">Professional solutions designed to meet your unique business requirements with precision and excellence.</p>
                    </div>
                    <div class="service-card">
                        <div class="service-icon">
                            <div class="icon-bg">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor"/>
                                </svg>
                            </div>
                        </div>
                        <h3 class="service-title">Expert Team</h3>
                        <p class="service-description">Experienced professionals with deep industry knowledge ready to tackle your most challenging projects.</p>
                    </div>
                    <div class="service-card">
                        <div class="service-icon">
                            <div class="icon-bg">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor"/>
                                </svg>
                            </div>
                        </div>
                        <h3 class="service-title">Fast Delivery</h3>
                        <p class="service-description">Quick turnaround times without compromising on quality, ensuring your business stays ahead of the competition.</p>
                    </div>
                </div>
            </div>
        </section>

        <section id="about" class="about">
            <div class="container">
                <div class="about-content">
                    <div class="about-text">
                        <div class="section-header">
                            <h2 class="section-title">About ${domain}</h2>
                            <p class="section-subtitle">We're passionate about delivering excellence in business solutions</p>
                        </div>
                        <div class="about-description">
                            <p>With years of experience and a commitment to innovation, we help businesses transform their operations and achieve unprecedented growth. Our team combines deep industry knowledge with cutting-edge technology.</p>
                            <p>From startups to enterprise organizations, we've helped hundreds of clients succeed in today's competitive marketplace.</p>
                        </div>
                        <div class="about-highlights">
                            <div class="highlight-item">
                                <div class="highlight-icon">🚀</div>
                                <div class="highlight-text">
                                    <h4>Innovation First</h4>
                                    <p>Cutting-edge solutions for modern challenges</p>
                                </div>
                            </div>
                            <div class="highlight-item">
                                <div class="highlight-icon">🎯</div>
                                <div class="highlight-text">
                                    <h4>Results Driven</h4>
                                    <p>Measurable outcomes that impact your bottom line</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="about-visual">
                        <div class="visual-placeholder">
                            <div class="visual-icon">📊</div>
                            <p>Professional Business Excellence</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <section id="contact" class="contact">
            <div class="container">
                <div class="contact-content">
                    <div class="contact-info">
                        <h2 class="contact-title">Ready to Get Started?</h2>
                        <p class="contact-subtitle">Join hundreds of satisfied clients who have transformed their business with ${domain}</p>
                        <div class="contact-benefits">
                            <div class="benefit-item">
                                <div class="benefit-icon">✓</div>
                                <span>Free consultation</span>
                            </div>
                            <div class="benefit-item">
                                <div class="benefit-icon">✓</div>
                                <span>No long-term commitment</span>
                            </div>
                            <div class="benefit-item">
                                <div class="benefit-icon">✓</div>
                                <span>Expert support team</span>
                            </div>
                        </div>
                    </div>
                    <div class="contact-form-container">
                        <form class="contact-form">
                            <div class="form-group">
                                <label for="email" class="form-label">Email Address</label>
                                <input type="email" id="email" class="form-input" placeholder="Enter your email address" required>
                            </div>
                            <div class="form-group">
                                <label for="name" class="form-label">Full Name</label>
                                <input type="text" id="name" class="form-input" placeholder="Enter your full name" required>
                            </div>
                            <div class="form-group">
                                <label for="message" class="form-label">Message (Optional)</label>
                                <textarea id="message" class="form-input form-textarea" placeholder="Tell us about your project..." rows="4"></textarea>
                            </div>
                            <button type="submit" class="btn btn-primary btn-fullwidth">
                                <span class="btn-text">Start Your Journey</span>
                                <span class="btn-icon">→</span>
                            </button>
                            <p class="form-disclaimer">By submitting, you agree to our terms of service and privacy policy.</p>
                        </form>
                    </div>
                </div>
            </div>
        </section>
    </main>

    <footer class="footer">
        <div class="container">
            <div class="footer-content">
                <div class="footer-brand">
                    <div class="footer-logo">
                        <div class="logo-icon">${domain.charAt(0).toUpperCase()}</div>
                        <span class="logo-text">${domain}</span>
                    </div>
                    <p class="footer-description">Transforming businesses through innovative solutions.</p>
                </div>
                <div class="footer-links">
                    <div class="footer-column">
                        <h4 class="footer-title">Company</h4>
                        <ul class="footer-list">
                            <li><a href="#about" class="footer-link">About Us</a></li>
                            <li><a href="#services" class="footer-link">Services</a></li>
                            <li><a href="#contact" class="footer-link">Contact</a></li>
                        </ul>
                    </div>
                    <div class="footer-column">
                        <h4 class="footer-title">Services</h4>
                        <ul class="footer-list">
                            <li><a href="#" class="footer-link">Consulting</a></li>
                            <li><a href="#" class="footer-link">Support</a></li>
                            <li><a href="#" class="footer-link">Training</a></li>
                        </ul>
                    </div>
                </div>
            </div>
            <div class="footer-bottom">
                <p class="footer-copyright">&copy; 2025 ${domain}. All rights reserved.</p>
                <p class="footer-credits">Powered by <a href="https://domaintobiz.vercel.app" class="footer-link">DomainToBiz</a></p>
            </div>
        </div>
    </footer>

    <script src="script.js"></script>
</body>
</html>`;
}

function generateDefaultCSS() {
  return `/* Modern CSS Reset */
*,
*::before,
*::after {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

/* Root Variables */
:root {
    --primary: #6366F1;
    --secondary: #8B5CF6;
    --accent: #F59E0B;
    --background: #FFFFFF;
    --text: #1F2937;
    --light-gray: #F8FAFC;
    --medium-gray: #6B7280;
    --dark-gray: #374151;
    --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    --border-radius: 12px;
    --border-radius-lg: 16px;
    --border-radius-xl: 24px;
}

/* Base Styles */
html {
    scroll-behavior: smooth;
}

body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.7;
    color: var(--text);
    background-color: var(--background);
    font-size: 16px;
    overflow-x: hidden;
}

/* Container */
.container {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 2rem;
}

/* Header & Navigation */
.header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    transition: var(--transition);
}

.navbar {
    padding: 1rem 0;
}

.nav-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 2rem;
}

.nav-brand {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-weight: 700;
    font-size: 1.5rem;
    color: var(--text);
    text-decoration: none;
}

.logo-icon {
    width: 40px;
    height: 40px;
    background: linear-gradient(135deg, var(--primary), var(--secondary));
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 700;
    font-size: 1.2rem;
}

.nav-menu {
    display: flex;
    list-style: none;
    gap: 2.5rem;
    align-items: center;
}

.nav-link {
    color: var(--text);
    text-decoration: none;
    font-weight: 500;
    font-size: 0.95rem;
    transition: var(--transition);
    position: relative;
}

.nav-link:hover {
    color: var(--primary);
}

.nav-link::after {
    content: '';
    position: absolute;
    bottom: -4px;
    left: 0;
    width: 0;
    height: 2px;
    background: var(--primary);
    transition: width 0.3s ease;
}

.nav-link:hover::after {
    width: 100%;
}

.nav-toggle {
    display: none;
    flex-direction: column;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.5rem;
}

.hamburger {
    width: 25px;
    height: 3px;
    background: var(--text);
    margin: 3px 0;
    transition: var(--transition);
}

/* Hero Section */
.hero {
    position: relative;
    min-height: 100vh;
    display: flex;
    align-items: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    overflow: hidden;
}

.hero-background {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
}

.hero-shapes {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    overflow: hidden;
}

.shape {
    position: absolute;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    animation: float 6s ease-in-out infinite;
}

.shape-1 {
    width: 300px;
    height: 300px;
    top: 10%;
    right: 10%;
    animation-delay: 0s;
}

.shape-2 {
    width: 200px;
    height: 200px;
    bottom: 20%;
    left: 15%;
    animation-delay: 2s;
}

.shape-3 {
    width: 150px;
    height: 150px;
    top: 60%;
    right: 30%;
    animation-delay: 4s;
}

@keyframes float {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50% { transform: translateY(-20px) rotate(180deg); }
}

.hero-content {
    position: relative;
    z-index: 2;
    text-align: center;
    color: white;
    max-width: 900px;
    margin: 0 auto;
}

.hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(10px);
    padding: 0.75rem 1.5rem;
    border-radius: 50px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    margin-bottom: 2rem;
    font-size: 0.9rem;
    font-weight: 500;
    animation: slideInUp 0.8s ease-out;
}

.badge-icon {
    font-size: 1.2rem;
}

.hero-title {
    font-size: clamp(2.5rem, 5vw, 4rem);
    font-weight: 800;
    line-height: 1.1;
    margin-bottom: 1.5rem;
    background: linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: slideInUp 0.8s ease-out 0.2s both;
}

.hero-subtitle {
    font-size: clamp(1.1rem, 2vw, 1.3rem);
    margin-bottom: 3rem;
    opacity: 0.9;
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
    animation: slideInUp 0.8s ease-out 0.4s both;
}

.hero-cta {
    display: flex;
    gap: 1.5rem;
    justify-content: center;
    flex-wrap: wrap;
    margin-bottom: 4rem;
    animation: slideInUp 0.8s ease-out 0.6s both;
}

.hero-stats {
    display: flex;
    justify-content: center;
    gap: 3rem;
    flex-wrap: wrap;
    animation: slideInUp 0.8s ease-out 0.8s both;
}

.stat-item {
    text-align: center;
}

.stat-number {
    font-size: 2.5rem;
    font-weight: 800;
    margin-bottom: 0.5rem;
    background: linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}

.stat-label {
    font-size: 0.9rem;
    opacity: 0.8;
    font-weight: 500;
}

/* Buttons */
.btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem 2rem;
    border-radius: var(--border-radius);
    text-decoration: none;
    font-weight: 600;
    font-size: 1rem;
    transition: var(--transition);
    border: none;
    cursor: pointer;
    position: relative;
    overflow: hidden;
}

.btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.5s ease;
}

.btn:hover::before {
    left: 100%;
}

.btn-primary {
    background: white;
    color: var(--primary);
    box-shadow: var(--shadow-lg);
}

.btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-xl);
}

.btn-secondary {
    background: transparent;
    color: white;
    border: 2px solid rgba(255, 255, 255, 0.3);
    backdrop-filter: blur(10px);
}

.btn-secondary:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.5);
}

.btn-fullwidth {
    width: 100%;
    justify-content: center;
}

.btn-icon {
    transition: transform 0.3s ease;
}

.btn:hover .btn-icon {
    transform: translateX(4px);
}

/* Sections */
.section-header {
    text-align: center;
    margin-bottom: 4rem;
}

.section-title {
    font-size: clamp(2rem, 4vw, 3rem);
    font-weight: 700;
    margin-bottom: 1rem;
    background: linear-gradient(135deg, var(--primary), var(--secondary));
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}

.section-subtitle {
    font-size: 1.2rem;
    color: var(--medium-gray);
    max-width: 600px;
    margin: 0 auto;
    line-height: 1.6;
}

/* Services Section */
.services {
    padding: 6rem 0;
    background: var(--light-gray);
}

.services-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    gap: 2.5rem;
    max-width: 1200px;
    margin: 0 auto;
}

.service-card {
    background: white;
    padding: 2.5rem;
    border-radius: var(--border-radius-lg);
    box-shadow: var(--shadow-md);
    transition: var(--transition);
    border: 1px solid rgba(255, 255, 255, 0.1);
    position: relative;
    overflow: hidden;
    text-align: center;
}

.service-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, var(--primary), var(--secondary));
}

.service-card:hover {
    transform: translateY(-8px);
    box-shadow: var(--shadow-xl);
}

.service-icon {
    margin-bottom: 1.5rem;
}

.icon-bg {
    width: 60px;
    height: 60px;
    background: linear-gradient(135deg, var(--primary), var(--secondary));
    border-radius: var(--border-radius);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 1.5rem;
    margin: 0 auto;
}

.service-title {
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: 1rem;
    color: var(--text);
}

.service-description {
    color: var(--medium-gray);
    line-height: 1.7;
}

/* About Section */
.about {
    padding: 6rem 0;
    background: white;
}

.about-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4rem;
    align-items: center;
}

.about-text .section-header {
    text-align: left;
    margin-bottom: 2rem;
}

.about-description {
    margin-bottom: 2.5rem;
}

.about-description p {
    color: var(--medium-gray);
    line-height: 1.8;
    margin-bottom: 1.5rem;
}

.about-highlights {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.highlight-item {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
}

.highlight-icon {
    font-size: 1.5rem;
    margin-top: 0.25rem;
}

.highlight-text h4 {
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: var(--text);
}

.highlight-text p {
    color: var(--medium-gray);
    font-size: 0.95rem;
}

.about-visual {
    display: flex;
    justify-content: center;
    align-items: center;
}

.visual-placeholder {
    width: 400px;
    height: 300px;
    background: linear-gradient(135deg, var(--primary), var(--secondary));
    border-radius: var(--border-radius-xl);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: white;
    text-align: center;
    padding: 2rem;
}

.visual-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
}

.visual-placeholder p {
    font-size: 1.2rem;
    font-weight: 600;
}

/* Contact Section */
.contact {
    padding: 6rem 0;
    background: linear-gradient(135deg, var(--primary), var(--secondary));
    color: white;
}

.contact-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4rem;
    align-items: center;
}

.contact-title {
    font-size: clamp(2rem, 4vw, 3rem);
    font-weight: 700;
    margin-bottom: 1.5rem;
}

.contact-subtitle {
    font-size: 1.2rem;
    margin-bottom: 2.5rem;
    opacity: 0.9;
    line-height: 1.6;
}

.contact-benefits {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.benefit-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 1.1rem;
}

.benefit-icon {
    width: 24px;
    height: 24px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    font-weight: 600;
}

.contact-form-container {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(20px);
    padding: 2.5rem;
    border-radius: var(--border-radius-lg);
    border: 1px solid rgba(255, 255, 255, 0.2);
}

.contact-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.form-label {
    font-weight: 600;
    font-size: 0.95rem;
    color: rgba(255, 255, 255, 0.9);
}

.form-input {
    padding: 1rem 1.25rem;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: var(--border-radius);
    background: rgba(255, 255, 255, 0.1);
    color: white;
    font-size: 1rem;
    transition: var(--transition);
    backdrop-filter: blur(10px);
}

.form-input::placeholder {
    color: rgba(255, 255, 255, 0.6);
}

.form-input:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.5);
    background: rgba(255, 255, 255, 0.15);
}

.form-textarea {
    resize: vertical;
    min-height: 120px;
}

.form-disclaimer {
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.7);
    text-align: center;
    margin-top: 0.5rem;
}

/* Footer */
.footer {
    background: var(--dark-gray);
    color: white;
    padding: 3rem 0 1.5rem;
}

.footer-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3rem;
    margin-bottom: 2rem;
}

.footer-brand {
    max-width: 400px;
}

.footer-logo {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
}

.footer-description {
    color: rgba(255, 255, 255, 0.7);
    line-height: 1.6;
}

.footer-links {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 2rem;
}

.footer-title {
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 1rem;
}

.footer-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.footer-link {
    color: rgba(255, 255, 255, 0.7);
    text-decoration: none;
    transition: var(--transition);
}

.footer-link:hover {
    color: white;
}

.footer-bottom {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 2rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    flex-wrap: wrap;
    gap: 1rem;
}

.footer-copyright,
.footer-credits {
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.9rem;
}

/* Animations */
@keyframes slideInUp {
    from {
        opacity: 0;
        transform: translateY(30px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes fadeIn {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}

/* Responsive Design */
@media (max-width: 1024px) {
    .container {
        padding: 0 1.5rem;
    }
    
    .nav-container {
        padding: 0 1.5rem;
    }
    
    .about-content,
    .contact-content {
        grid-template-columns: 1fr;
        gap: 3rem;
    }
    
    .footer-content {
        grid-template-columns: 1fr;
        gap: 2rem;
    }
    
    .hero-stats {
        gap: 2rem;
    }
}

@media (max-width: 768px) {
    .nav-menu {
        display: none;
    }
    
    .nav-toggle {
        display: flex;
    }
    
    .hero {
        padding: 2rem 0;
        min-height: 80vh;
    }
    
    .hero-cta {
        flex-direction: column;
        align-items: center;
        gap: 1rem;
    }
    
    .hero-stats {
        gap: 1.5rem;
    }
    
    .services-grid {
        grid-template-columns: 1fr;
        gap: 2rem;
    }
    
    .service-card {
        padding: 2rem;
    }
    
    .contact-form-container {
        padding: 2rem;
    }
    
    .footer-links {
        grid-template-columns: 1fr;
        gap: 1.5rem;
    }
    
    .footer-bottom {
        flex-direction: column;
        text-align: center;
        gap: 0.5rem;
    }
    
    .about-text .section-header {
        text-align: center;
    }
    
    .visual-placeholder {
        width: 100%;
        height: 250px;
    }
}

@media (max-width: 480px) {
    .container {
        padding: 0 1rem;
    }
    
    .nav-container {
        padding: 0 1rem;
    }
    
    .hero-badge {
        padding: 0.5rem 1rem;
        font-size: 0.85rem;
    }
    
    .btn {
        padding: 0.875rem 1.5rem;
        font-size: 0.95rem;
    }
    
    .service-card {
        padding: 1.5rem;
    }
    
    .contact-form-container {
        padding: 1.5rem;
    }
    
    .footer {
        padding: 2rem 0 1rem;
    }
}`;
}

function generateDefaultJS(domain) {
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
        
        lastScrollY = scrollY;
    });
}

// Animation initialization
function initAnimations() {
    // Fade in animations for cards and elements
    const animatedElements = $$('.service-card, .hero-content, .about-text, .contact-content');
    
    animatedElements.forEach(element => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(30px)';
        element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(element);
    });
    
    // Stagger animation for service cards
    const serviceCards = $$('.service-card');
    serviceCards.forEach((card, index) => {
        card.style.transitionDelay = \`\${index * 0.1}s\`;
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
        
        // Simulate API call
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