import OpenAI from 'openai';
import { logger } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

export class DevelopmentAgent {
  constructor() {
    this.templateEngine = 'vanilla';
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async execute(taskData, tracker = null) {
    logger.info(`Development Agent executing for ${taskData.strategy.domain}`);
    
    if (tracker) {
      tracker.addAgentLog('development', 'Starting website development', {
        domain: taskData.strategy.domain,
        designAssets: Object.keys(taskData.designResult || {}).length,
        contentSections: Object.keys(taskData.contentResult?.content?.sections || {}).length
      });
    }
    
    const { designResult, contentResult } = taskData;
    
    if (tracker) {
      tracker.addAgentLog('development', 'Building HTML structure and components', {
        templateEngine: this.templateEngine,
        responsive: true,
        accessibility: true
      });
    }
    
    const site = await this.buildWebsite({
      design: designResult.designSystem,
      wireframes: designResult.wireframes,
      content: contentResult.content,
      domain: taskData.strategy.domain,
      business: taskData.strategy.businessModel,
      brand: taskData.strategy.brandStrategy,
      mvp: taskData.strategy.mvpPlan
    });
    
    if (tracker) {
      tracker.addAgentLog('development', 'Generating CSS and JavaScript files', {
        filesGenerated: Object.keys(site.files).length,
        cssLines: site.files['styles.css']?.split('\n').length || 0,
        jsLines: site.files['script.js']?.split('\n').length || 0
      });
    }
    
    const outputDir = path.join('output', taskData.executionId || 'temp', 'site');
    await fs.mkdir(outputDir, { recursive: true });
    
    for (const [filename, fileContent] of Object.entries(site.files)) {
      await fs.writeFile(
        path.join(outputDir, filename),
        fileContent
      );
    }
    
    if (tracker) {
      tracker.addAgentLog('development', 'Website development completed', {
        totalFiles: Object.keys(site.files).length,
        entryPoint: 'index.html',
        outputPath: outputDir,
        features: ['responsive design', 'SEO optimized', 'contact forms', 'analytics ready']
      });
    }
    
    return {
      files: site.files,
      outputPath: outputDir,
      entryPoint: 'index.html'
    };
  }

  async buildWebsite(config) {
    const files = {
      'index.html': await this.generateHTML(config),
      'styles.css': await this.generateCSS(config),
      'script.js': await this.generateJS(config),
      'manifest.json': this.generateManifest(config)
    };
    
    return { files };
  }

  async generateHTML(config) {
    const { content, design, wireframes } = config;
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${content.metadata.title}</title>
    <meta name="description" content="${content.metadata.description}">
    
    <!-- OpenGraph -->
    <meta property="og:title" content="${content.metadata.openGraph?.title || content.metadata.title}">
    <meta property="og:description" content="${content.metadata.openGraph?.description || content.metadata.description}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://${config.domain}">
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${content.metadata.twitter?.title || content.metadata.title}">
    <meta name="twitter:description" content="${content.metadata.twitter?.description || content.metadata.description}">
    
    <link rel="stylesheet" href="styles.css">
    <link rel="manifest" href="manifest.json">
    
    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
    ${this.generateNavigation(content)}
    
    <main>
        ${this.generateHeroSection(content.sections.hero, design)}
        ${this.generateFeaturesSection(content.sections.features, design)}
        ${this.generatePricingSection(content.sections.pricing, design)}
        ${this.generateTestimonialsSection(content.sections.testimonials, design)}
        ${this.generateCTASection(content.sections.cta, design)}
    </main>
    
    ${this.generateFooter(content.sections.footer, content.legal)}
    
    ${this.generateSignupModal(content.forms.signup)}
    
    <script src="script.js"></script>
</body>
</html>`;
  }

  generateNavigation(content) {
    return `
    <nav class="navbar">
        <div class="container">
            <div class="nav-wrapper">
                <a href="/" class="nav-logo">${content.metadata.title.split(' ')[0]}</a>
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
    </nav>`;
  }

  generateHeroSection(hero, design) {
    // Provide fallback content if hero data is missing or malformed
    const heroData = hero || {};
    const headline = heroData.headline || heroData.title || 'Transform Your Business Today';
    const subheadline = heroData.subheadline || heroData.subtitle || heroData.description || 
                       'Discover innovative solutions that drive results and accelerate your success';
    const primaryCTA = heroData.primaryCTA || heroData.buttonText || heroData.cta || 'Get Started';
    const secondaryCTA = heroData.secondaryCTA || 'Learn More';
    
    return `
    <section class="hero">
        <div class="container">
            <div class="hero-content">
                <h1 class="hero-headline">${headline}</h1>
                <p class="hero-subheadline">${subheadline}</p>
                <div class="hero-cta">
                    <button class="btn btn-primary btn-lg" data-modal="signup">${primaryCTA}</button>
                    <a href="#features" class="btn btn-secondary btn-lg">${secondaryCTA}</a>
                </div>
            </div>
            <div class="hero-visual">
                <img src="${heroData.image || 'https://via.placeholder.com/600x400'}" alt="${heroData.imageAlt || 'Product showcase'}">
            </div>
        </div>
    </section>`;
  }

  generateFeaturesSection(features, design) {
    // Provide fallback features if none provided
    const featuresData = features || {};
    const featuresList = featuresData.items || featuresData.features || [
      {
        title: 'Professional Solution',
        description: 'High-quality service designed to meet your specific needs with proven results.'
      },
      {
        title: 'Expert Support',
        description: 'Dedicated team of professionals ready to assist you every step of the way.'
      },
      {
        title: 'Proven Results',
        description: 'Track record of success with measurable outcomes and satisfied customers.'
      }
    ];
    
    const featureCards = featuresList.map(feature => `
        <div class="feature-card">
            <div class="feature-icon">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 11l3 3L22 4"></path>
                    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"></path>
                </svg>
            </div>
            <h3 class="feature-title">${feature.title || 'Feature'}</h3>
            <p class="feature-description">${feature.description || 'Premium feature designed for your success.'}</p>
        </div>
    `).join('');
    
    return `
    <section id="features" class="features">
        <div class="container">
            <div class="section-header">
                <h2 class="section-title">${featuresData.title || 'Key Features'}</h2>
                <p class="section-subtitle">${featuresData.subtitle || 'Discover what makes us different'}</p>
            </div>
            <div class="features-grid">
                ${featureCards}
            </div>
        </div>
    </section>`;
  }

  generatePricingSection(pricing, design) {
    // Provide fallback pricing if none provided
    const pricingData = pricing || {};
    const plans = pricingData.plans || [
      {
        name: 'Starter',
        price: 29,
        period: 'month',
        description: 'Perfect for individuals getting started',
        features: ['Core features', 'Email support', 'Basic analytics'],
        cta: 'Start Free Trial'
      },
      {
        name: 'Professional',
        price: 79,
        period: 'month',
        description: 'Ideal for growing businesses',
        features: ['All Starter features', 'Priority support', 'Advanced analytics', 'Custom integrations'],
        featured: true,
        cta: 'Get Started'
      },
      {
        name: 'Enterprise',
        price: 199,
        period: 'month',
        description: 'For large organizations',
        features: ['All Professional features', 'Dedicated support', 'Custom solutions', 'SLA guarantee'],
        cta: 'Contact Sales'
      }
    ];
    
    const pricingCards = plans.map(plan => `
        <div class="pricing-card ${plan.featured ? 'featured' : ''}">
            ${plan.featured ? '<div class="pricing-badge">Most Popular</div>' : ''}
            <h3 class="pricing-title">${plan.name || 'Plan'}</h3>
            <div class="pricing-price">
                <span class="currency">$</span>
                <span class="amount">${plan.price || 0}</span>
                <span class="period">/${plan.period || 'month'}</span>
            </div>
            <p class="pricing-description">${plan.description || 'Premium service package'}</p>
            <ul class="pricing-features">
                ${(plan.features || ['Premium features']).map(feature => `<li>${feature}</li>`).join('')}
            </ul>
            <button class="btn ${plan.featured ? 'btn-primary' : 'btn-secondary'} btn-block" data-modal="signup" data-plan="${plan.name}">
                ${plan.cta || 'Get Started'}
            </button>
        </div>
    `).join('');
    
    return `
    <section id="pricing" class="pricing">
        <div class="container">
            <div class="section-header">
                <h2 class="section-title">${pricingData.title || 'Pricing Plans'}</h2>
                <p class="section-subtitle">${pricingData.subtitle || 'Choose the plan that fits your needs'}</p>
            </div>
            <div class="pricing-grid">
                ${pricingCards}
            </div>
        </div>
    </section>`;
  }

  generateTestimonialsSection(testimonials, design) {
    // Provide fallback testimonials if none provided
    const testimonialsData = testimonials || {};
    const items = testimonialsData.items || [
      {
        text: 'This service has completely transformed how we operate. The results exceeded our expectations.',
        name: 'Sarah Johnson',
        role: 'CEO, Tech Innovations',
        avatar: 'https://via.placeholder.com/48x48'
      },
      {
        text: 'Outstanding support and incredible value. I would recommend this to anyone looking for quality solutions.',
        name: 'Michael Chen',
        role: 'Marketing Director',
        avatar: 'https://via.placeholder.com/48x48'
      },
      {
        text: 'The team went above and beyond to ensure our success. Truly professional and reliable service.',
        name: 'Emily Rodriguez',
        role: 'Operations Manager',
        avatar: 'https://via.placeholder.com/48x48'
      }
    ];
    
    const testimonialCards = items.map(testimonial => `
        <div class="testimonial-card">
            <div class="testimonial-content">
                <p class="testimonial-text">"${testimonial.text || 'Excellent service and great results.'}"</p>
            </div>
            <div class="testimonial-author">
                <img src="${testimonial.avatar || 'https://via.placeholder.com/48x48'}" alt="${testimonial.name || 'Customer'}" class="testimonial-avatar">
                <div>
                    <p class="testimonial-name">${testimonial.name || 'Happy Customer'}</p>
                    <p class="testimonial-role">${testimonial.role || 'Valued Client'}</p>
                </div>
            </div>
        </div>
    `).join('');
    
    return `
    <section id="testimonials" class="testimonials">
        <div class="container">
            <div class="section-header">
                <h2 class="section-title">${testimonialsData.title || 'What Our Customers Say'}</h2>
                <p class="section-subtitle">${testimonialsData.subtitle || 'See what our satisfied clients have to say about us'}</p>
            </div>
            <div class="testimonials-grid">
                ${testimonialCards}
            </div>
        </div>
    </section>`;
  }

  generateCTASection(cta, design) {
    // Provide fallback CTA if none provided
    const ctaData = cta || {};
    const title = ctaData.title || 'Ready to Get Started?';
    const subtitle = ctaData.subtitle || 'Join thousands of satisfied customers and transform your business today.';
    const buttonText = ctaData.buttonText || ctaData.cta || 'Start Your Free Trial';
    
    return `
    <section class="cta-section">
        <div class="container">
            <div class="cta-content">
                <h2 class="cta-title">${title}</h2>
                <p class="cta-subtitle">${subtitle}</p>
                <button class="btn btn-primary btn-lg" data-modal="signup">${buttonText}</button>
            </div>
        </div>
    </section>`;
  }

  generateFooter(footer, legal) {
    return `
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
                <p>&copy; ${new Date().getFullYear()} ${footer?.copyright || 'All rights reserved'}</p>
            </div>
        </div>
    </footer>`;
  }

  generateSignupModal(form) {
    return `
    <div class="modal" id="signup-modal">
        <div class="modal-backdrop"></div>
        <div class="modal-content">
            <button class="modal-close" aria-label="Close modal">&times;</button>
            <h2 class="modal-title">${form.title}</h2>
            <p class="modal-subtitle">${form.subtitle}</p>
            <form class="signup-form" id="signup-form">
                ${form.fields.map(field => `
                    <div class="form-group">
                        ${field.type === 'textarea' ? 
                            `<textarea name="${field.name}" placeholder="${field.placeholder}" ${field.required ? 'required' : ''}></textarea>` :
                            `<input type="${field.type}" name="${field.name}" placeholder="${field.placeholder}" ${field.required ? 'required' : ''}>`
                        }
                    </div>
                `).join('')}
                <button type="submit" class="btn btn-primary btn-block">${form.submitText}</button>
                <p class="form-privacy">${form.privacyText}</p>
            </form>
        </div>
    </div>`;
  }

  async generateCSS(config) {
    const { design } = config;
    const baseCSS = design.css || this.getDefaultCSS();
    
    return `
${baseCSS}

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
}
`;
  }

  getDefaultCSS() {
    return `
:root {
    --color-primary: #667eea;
    --color-primary-dark: #5a67d8;
    --color-primary-light: #7c3aed;
    --color-secondary: #764ba2;
    --color-accent: #f093fb;
    --color-success: #10b981;
    --color-warning: #f59e0b;
    --color-error: #ef4444;
    --color-background: #ffffff;
    --color-background-alt: #f8fafc;
    --color-text: #1a202c;
    --color-text-secondary: #4a5568;
    --color-text-muted: #718096;
    --color-border: #e2e8f0;
    --color-border-light: #f7fafc;
    
    --font-primary: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --font-weight-normal: 400;
    --font-weight-medium: 500;
    --font-weight-semibold: 600;
    --font-weight-bold: 700;
    --font-weight-extrabold: 800;
    
    --font-size-xs: 0.75rem;
    --font-size-sm: 0.875rem;
    --font-size-base: 1rem;
    --font-size-lg: 1.125rem;
    --font-size-xl: 1.25rem;
    --font-size-2xl: 1.5rem;
    --font-size-3xl: 1.875rem;
    --font-size-4xl: 2.25rem;
    --font-size-5xl: 3rem;
    --font-size-6xl: 3.75rem;
    
    --space-1: 0.25rem;
    --space-2: 0.5rem;
    --space-3: 0.75rem;
    --space-4: 1rem;
    --space-5: 1.25rem;
    --space-6: 1.5rem;
    --space-8: 2rem;
    --space-10: 2.5rem;
    --space-12: 3rem;
    --space-16: 4rem;
    --space-20: 5rem;
    --space-24: 6rem;
    --space-32: 8rem;
    
    --shadow-xs: 0 0 0 1px rgba(0, 0, 0, 0.05);
    --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    --shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    
    --radius-sm: 0.375rem;
    --radius-md: 0.5rem;
    --radius-lg: 0.75rem;
    --radius-xl: 1rem;
    --radius-2xl: 1.5rem;
    --radius-full: 9999px;
    
    --gradient-primary: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
    --gradient-accent: linear-gradient(135deg, var(--color-accent) 0%, var(--color-primary) 100%);
}

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

html {
    scroll-behavior: smooth;
}

body {
    font-family: var(--font-primary);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-normal);
    color: var(--color-text);
    background-color: var(--color-background);
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
}

.container {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 var(--space-4);
}

/* Typography */
h1, h2, h3, h4, h5, h6 {
    font-weight: var(--font-weight-bold);
    line-height: 1.2;
    margin-bottom: var(--space-4);
}

h1 { font-size: var(--font-size-5xl); }
h2 { font-size: var(--font-size-4xl); }
h3 { font-size: var(--font-size-2xl); }
h4 { font-size: var(--font-size-xl); }

p {
    margin-bottom: var(--space-4);
    color: var(--color-text-secondary);
}

/* Enhanced Button System */
.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-6);
    border-radius: var(--radius-lg);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    text-decoration: none;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    border: none;
    position: relative;
    overflow: hidden;
    transform: translateY(0);
}

.btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.2) 50%, transparent 70%);
    transform: translateX(-100%);
    transition: transform 0.6s;
}

.btn:hover::before {
    transform: translateX(100%);
}

.btn-primary {
    background: var(--gradient-primary);
    color: white;
    box-shadow: var(--shadow-lg);
}

.btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-xl);
}

.btn-secondary {
    background: white;
    color: var(--color-primary);
    border: 2px solid var(--color-border);
    box-shadow: var(--shadow-sm);
}

.btn-secondary:hover {
    background: var(--color-background-alt);
    border-color: var(--color-primary);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
}

.btn-lg {
    padding: var(--space-4) var(--space-8);
    font-size: var(--font-size-lg);
    border-radius: var(--radius-xl);
}

.btn-block {
    width: 100%;
}

/* Enhanced Section Spacing */
section {
    padding: var(--space-20) 0;
    opacity: 0;
    transform: translateY(20px);
    transition: all 0.8s ease-out;
}

section.visible {
    opacity: 1;
    transform: translateY(0);
}

.section-header {
    text-align: center;
    margin-bottom: var(--space-16);
}

.section-title {
    font-size: var(--font-size-4xl);
    font-weight: var(--font-weight-extrabold);
    color: var(--color-text);
    margin-bottom: var(--space-4);
    background: var(--gradient-primary);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.section-subtitle {
    font-size: var(--font-size-xl);
    color: var(--color-text-secondary);
    max-width: 600px;
    margin: 0 auto;
}
    `;
  }

  async generateJS(config) {
    return `
// Modal functionality
const modal = document.getElementById('signup-modal');
const modalTriggers = document.querySelectorAll('[data-modal="signup"]');
const modalClose = document.querySelector('.modal-close');
const modalBackdrop = document.querySelector('.modal-backdrop');

function openModal() {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

modalTriggers.forEach(trigger => {
    trigger.addEventListener('click', openModal);
});

modalClose.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', closeModal);

// Form handling
const signupForm = document.getElementById('signup-form');
const newsletterForms = document.querySelectorAll('.newsletter-form');

async function handleFormSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData);
    
    // In production, this would send to your backend
    console.log('Form submitted:', data);
    
    // Show success message
    alert('Thank you for signing up! We\\'ll be in touch soon.');
    
    // Reset form and close modal
    event.target.reset();
    if (event.target.id === 'signup-form') {
        closeModal();
    }
}

signupForm.addEventListener('submit', handleFormSubmit);
newsletterForms.forEach(form => {
    form.addEventListener('submit', handleFormSubmit);
});

// Smooth scrolling
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Mobile navigation
const navToggle = document.querySelector('.nav-toggle');
const navMenu = document.querySelector('.nav-menu');

navToggle.addEventListener('click', () => {
    navMenu.classList.toggle('active');
    navToggle.classList.toggle('active');
});

// Analytics placeholder
function trackEvent(category, action, label) {
    // In production, this would send to your analytics service
    console.log('Event tracked:', { category, action, label });
}

// Track button clicks
document.querySelectorAll('.btn').forEach(button => {
    button.addEventListener('click', () => {
        trackEvent('Button', 'Click', button.textContent);
    });
});

// Add intersection observer for animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, observerOptions);

// Observe all sections
document.querySelectorAll('section').forEach(section => {
    observer.observe(section);
});
    `;
  }

  generateManifest(config) {
    return JSON.stringify({
      name: config.content.metadata.title,
      short_name: config.domain.split('.')[0],
      description: config.content.metadata.description,
      start_url: "/",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: config.design.colors?.primary || "#6366f1",
      icons: [
        {
          src: "/icon-192.png",
          sizes: "192x192",
          type: "image/png"
        },
        {
          src: "/icon-512.png",
          sizes: "512x512",
          type: "image/png"
        }
      ]
    }, null, 2);
  }
}