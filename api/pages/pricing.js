import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Read the pricing template
    const templatePath = path.join(process.cwd(), 'templates', 'htmx', 'pricing.html.jinja');
    let template = fs.readFileSync(templatePath, 'utf8');
    
    // Basic template rendering
    const templateData = {
      brand: {
        name: 'DomainToBiz',
        primaryColor: '#3B82F6',
        secondaryColor: '#10B981'
      },
      content: {
        pricing: {
          headline: 'Simple, Transparent Pricing',
          subheadline: 'Choose the perfect plan for your business. Start free and scale as you grow.'
        }
      },
      modules: {
        stripePaywall: true,
        pricing: true,
        waitlist: true,
        dashboard: false
      }
    };
    
    // Simple template replacement
    template = template
      .replace(/\{\{\s*brand\.name\s*\}\}/g, templateData.brand.name)
      .replace(/\{\{\s*brand\.primaryColor\s*\|\s*default\([^)]+\)\s*\}\}/g, templateData.brand.primaryColor)
      .replace(/\{\{\s*brand\.secondaryColor\s*\|\s*default\([^)]+\)\s*\}\}/g, templateData.brand.secondaryColor)
      .replace(/\{\{\s*content\.pricing\.headline\s*\|\s*default\([^)]+\)\s*\}\}/g, templateData.content.pricing.headline)
      .replace(/\{\{\s*content\.pricing\.subheadline\s*\|\s*default\([^)]+\)\s*\}\}/g, templateData.content.pricing.subheadline)
      .replace(/\{% if modules\.stripePaywall %\}/g, templateData.modules.stripePaywall ? '' : '<!--')
      .replace(/\{% if modules\.pricing %\}/g, templateData.modules.pricing ? '' : '<!--')
      .replace(/\{% if modules\.waitlist %\}/g, templateData.modules.waitlist ? '' : '<!--')
      .replace(/\{% if modules\.dashboard %\}/g, templateData.modules.dashboard ? '' : '<!--')
      .replace(/\{% endif %\}/g, '');

    // Set content type to HTML
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(template);

  } catch (error) {
    console.error('Error serving pricing page:', error);
    return res.status(500).json({ error: 'Failed to load pricing page' });
  }
} 