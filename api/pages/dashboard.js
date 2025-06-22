import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Read the dashboard template
    const templatePath = path.join(process.cwd(), 'templates', 'htmx', 'dashboard.html.jinja');
    let template = fs.readFileSync(templatePath, 'utf8');
    
    // Basic template rendering
    const templateData = {
      brand: {
        name: 'DomainToBiz',
        primaryColor: '#3B82F6',
        secondaryColor: '#10B981'
      },
      user: {
        name: 'Demo User',
        stats: {
          total_sites: '3',
          active_jobs: '1',
          sites_this_month: '2'
        },
        plan: {
          name: 'starter',
          current_usage: '2',
          limit: '5',
          next_billing_date: '2024-02-15'
        }
      },
      modules: {
        stripePaywall: true,
        pricing: true,
        waitlist: true,
        dashboard: true
      }
    };
    
    // Simple template replacement
    template = template
      .replace(/\{\{\s*brand\.name\s*\}\}/g, templateData.brand.name)
      .replace(/\{\{\s*brand\.primaryColor\s*\|\s*default\([^)]+\)\s*\}\}/g, templateData.brand.primaryColor)
      .replace(/\{\{\s*brand\.secondaryColor\s*\|\s*default\([^)]+\)\s*\}\}/g, templateData.brand.secondaryColor)
      .replace(/\{\{\s*user\.name\s*\|\s*default\([^)]+\)\s*\}\}/g, templateData.user.name)
      .replace(/\{\{\s*user\.stats\.total_sites\s*\|\s*default\([^)]+\)\s*\}\}/g, templateData.user.stats.total_sites)
      .replace(/\{\{\s*user\.stats\.active_jobs\s*\|\s*default\([^)]+\)\s*\}\}/g, templateData.user.stats.active_jobs)
      .replace(/\{\{\s*user\.stats\.sites_this_month\s*\|\s*default\([^)]+\)\s*\}\}/g, templateData.user.stats.sites_this_month)
      .replace(/\{\{\s*user\.plan\.name\s*\|\s*default\([^)]+\)\s*\}\}/g, templateData.user.plan.name)
      .replace(/\{\{\s*user\.plan\.current_usage\s*\|\s*default\([^)]+\)\s*\}\}/g, templateData.user.plan.current_usage)
      .replace(/\{\{\s*user\.plan\.limit\s*\|\s*default\([^)]+\)\s*\}\}/g, templateData.user.plan.limit)
      .replace(/\{% if modules\.stripePaywall %\}/g, templateData.modules.stripePaywall ? '' : '<!--')
      .replace(/\{% if modules\.pricing %\}/g, templateData.modules.pricing ? '' : '<!--')
      .replace(/\{% if modules\.waitlist %\}/g, templateData.modules.waitlist ? '' : '<!--')
      .replace(/\{% if modules\.dashboard %\}/g, templateData.modules.dashboard ? '' : '<!--')
      .replace(/\{% endif %\}/g, '');

    // Set content type to HTML
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(template);

  } catch (error) {
    console.error('Error serving dashboard page:', error);
    return res.status(500).json({ error: 'Failed to load dashboard page' });
  }
} 