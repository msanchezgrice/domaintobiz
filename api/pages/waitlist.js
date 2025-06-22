import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Read the waitlist template
    const templatePath = path.join(process.cwd(), 'templates', 'htmx', 'waitlist.html.jinja');
    let template = fs.readFileSync(templatePath, 'utf8');
    
    // Basic template rendering (replace Jinja variables with default values)
    const templateData = {
      brand: {
        name: 'DomainToBiz',
        primaryColor: '#3B82F6',
        secondaryColor: '#10B981'
      },
      content: {
        waitlist: {
          headline: 'Join the <span class="text-brand-primary">Waitlist</span>',
          subheadline: 'Be the first to experience the future of AI-powered website generation. Get early access, exclusive benefits, and shape the product with your feedback.'
        }
      },
      modules: {
        waitlist: true,
        pricing: true,
        dashboard: false
      },
      waitlist_count: '1,247',
      launch_countdown: '28'
    };
    
    // Simple template replacement (basic Jinja-like syntax)
    template = template
      .replace(/\{\{\s*brand\.name\s*\}\}/g, templateData.brand.name)
      .replace(/\{\{\s*brand\.primaryColor\s*\|\s*default\([^)]+\)\s*\}\}/g, templateData.brand.primaryColor)
      .replace(/\{\{\s*brand\.secondaryColor\s*\|\s*default\([^)]+\)\s*\}\}/g, templateData.brand.secondaryColor)
      .replace(/\{\{\s*content\.waitlist\.headline\s*\|\s*default\([^)]+\)\s*\|\s*safe\s*\}\}/g, templateData.content.waitlist.headline)
      .replace(/\{\{\s*content\.waitlist\.subheadline\s*\|\s*default\([^)]+\)\s*\}\}/g, templateData.content.waitlist.subheadline)
      .replace(/\{\{\s*waitlist_count\s*\|\s*default\([^)]+\)\s*\}\}/g, templateData.waitlist_count)
      .replace(/\{\{\s*launch_countdown\s*\|\s*default\([^)]+\)\s*\}\}/g, templateData.launch_countdown)
      .replace(/\{% if modules\.waitlist %\}/g, templateData.modules.waitlist ? '' : '<!--')
      .replace(/\{% endif %\}/g, templateData.modules.waitlist ? '' : '-->')
      .replace(/\{% if modules\.pricing %\}/g, templateData.modules.pricing ? '' : '<!--')
      .replace(/\{% if modules\.dashboard %\}/g, templateData.modules.dashboard ? '' : '<!--');

    // Set content type to HTML
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(template);

  } catch (error) {
    console.error('Error serving waitlist page:', error);
    return res.status(500).json({ error: 'Failed to load waitlist page' });
  }
} 