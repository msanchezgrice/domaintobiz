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
  const colors = designSystem?.colorPalette || {
    primary: '#3B82F6',
    secondary: '#1E40AF',
    background: '#FFFFFF',
    text: '#1F2937'
  };

  const content = websiteContent || {
    hero: {
      headline: `Welcome to ${domain}`,
      subheadline: strategy.brandStrategy?.positioning || 'Your business solution',
      cta: { primary: { text: 'Get Started', link: '#contact' } }
    }
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${content.hero.headline}</title>
    <link rel="stylesheet" href="styles.css">
    <link rel="manifest" href="manifest.json">
</head>
<body>
    <header>
        <nav>
            <div class="logo">${domain}</div>
            <ul>
                <li><a href="#home">Home</a></li>
                <li><a href="#features">Features</a></li>
                <li><a href="#contact">Contact</a></li>
            </ul>
        </nav>
    </header>

    <main>
        <section id="home" class="hero">
            <div class="container">
                <h1>${content.hero.headline}</h1>
                <p>${content.hero.subheadline}</p>
                <a href="${content.hero.cta.primary.link}" class="cta-button">
                    ${content.hero.cta.primary.text}
                </a>
            </div>
        </section>

        <section id="features" class="features">
            <div class="container">
                <h2>Features</h2>
                <div class="feature-grid">
                    ${strategy.mvpScope?.features?.map(feature => `
                        <div class="feature-card">
                            <h3>${feature}</h3>
                            <p>Discover the power of ${feature} in your business.</p>
                        </div>
                    `).join('') || '<div class="feature-card"><h3>Coming Soon</h3><p>Exciting features in development.</p></div>'}
                </div>
            </div>
        </section>

        <section id="contact" class="contact">
            <div class="container">
                <h2>Get Started Today</h2>
                <p>Ready to transform your business with ${domain}?</p>
                <form class="contact-form">
                    <input type="email" placeholder="Enter your email" required>
                    <button type="submit">Join Waitlist</button>
                </form>
            </div>
        </section>
    </main>

    <footer>
        <div class="container">
            <p>&copy; 2025 ${domain}. All rights reserved.</p>
            <p>Generated by <a href="https://domaintobiz.vercel.app">DomainToBiz</a></p>
        </div>
    </footer>

    <script src="script.js"></script>
</body>
</html>`;
}

function generateCSS(designSystem) {
  const colors = designSystem?.colorPalette || {
    primary: '#3B82F6',
    secondary: '#1E40AF',
    background: '#FFFFFF',
    text: '#1F2937'
  };

  return `* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    line-height: 1.6;
    color: ${colors.text};
    background-color: ${colors.background};
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
}

header {
    background: ${colors.background};
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
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
    color: ${colors.primary};
}

nav ul {
    display: flex;
    list-style: none;
    gap: 2rem;
}

nav a {
    text-decoration: none;
    color: ${colors.text};
    transition: color 0.3s;
}

nav a:hover {
    color: ${colors.primary};
}

.hero {
    background: linear-gradient(135deg, ${colors.primary}, ${colors.secondary});
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
    opacity: 0.9;
}

.cta-button {
    display: inline-block;
    background: white;
    color: ${colors.primary};
    padding: 12px 30px;
    border-radius: 6px;
    text-decoration: none;
    font-weight: bold;
    transition: transform 0.3s;
}

.cta-button:hover {
    transform: translateY(-2px);
}

.features {
    padding: 80px 0;
    background: #f8fafc;
}

.features h2 {
    text-align: center;
    margin-bottom: 3rem;
    font-size: 2.5rem;
}

.feature-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
}

.feature-card {
    background: white;
    padding: 2rem;
    border-radius: 10px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    text-align: center;
}

.feature-card h3 {
    color: ${colors.primary};
    margin-bottom: 1rem;
}

.contact {
    padding: 80px 0;
    background: ${colors.primary};
    color: white;
    text-align: center;
}

.contact h2 {
    margin-bottom: 1rem;
    font-size: 2.5rem;
}

.contact p {
    margin-bottom: 2rem;
    font-size: 1.2rem;
}

.contact-form {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
}

.contact-form input {
    padding: 12px 20px;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    min-width: 300px;
}

.contact-form button {
    padding: 12px 30px;
    background: ${colors.secondary};
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    cursor: pointer;
    transition: background 0.3s;
}

.contact-form button:hover {
    background: ${colors.text};
}

footer {
    background: ${colors.text};
    color: white;
    text-align: center;
    padding: 2rem 0;
}

footer a {
    color: ${colors.primary};
    text-decoration: none;
}

@media (max-width: 768px) {
    .hero h1 {
        font-size: 2rem;
    }
    
    .contact-form {
        flex-direction: column;
        align-items: center;
    }
    
    .contact-form input {
        min-width: 250px;
    }
}`;
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