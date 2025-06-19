import * as cheerio from 'cheerio';
import { logger } from '../utils/logger.js';

export class WebCrawler {
  constructor() {
    // Simple HTTP-based crawler for serverless environments
  }

  async crawl(domain, tracker = null) {
    logger.info(`Starting web crawl for domain: ${domain}`);
    
    if (tracker) {
      tracker.addThinking(`Web crawling ${domain}`, {
        step: 'Checking for website with HTTP request',
        timeout: '10 seconds',
        checks: ['HTTP response', 'content analysis', 'SEO metrics']
      });
    }
    
    try {
      const url = domain.startsWith('http') ? domain : `https://${domain}`;
      logger.info(`Fetching ${url}`);
      
      // Use fetch for simple HTTP requests
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DomainAnalyzer/1.0)'
        },
        signal: AbortSignal.timeout(10000)
      }).catch(async (err) => {
        logger.warn(`HTTPS failed for ${domain}, trying HTTP:`, err.message);
        const httpUrl = `http://${domain}`;
        return await fetch(httpUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; DomainAnalyzer/1.0)'
          },
          signal: AbortSignal.timeout(10000)
        }).catch(() => null);
      });

      if (!response || !response.ok) {
        if (tracker) {
          tracker.addThinking(`No website found for ${domain}`, {
            result: 'Domain appears to be available or unresponsive',
            impact: 'Good for new business development'
          });
        }
        return { hasWebsite: false, domain };
      }

      const content = await response.text();
      const $ = cheerio.load(content);
      
      if (tracker) {
        tracker.addThinking(`Analyzing website content for ${domain}`, {
          statusCode: response.status,
          title: $('title').text() || 'No title',
          hasDescription: !!$('meta[name="description"]').attr('content'),
          contentLength: content.length
        });
      }
      
      const crawlData = {
        hasWebsite: true,
        statusCode: response.status,
        title: $('title').text() || '',
        description: $('meta[name="description"]').attr('content') || '',
        headers: Object.fromEntries(response.headers.entries()),
        technologies: this.detectTechnologies($),
        content: {
          headings: this.extractHeadings($),
          links: this.extractLinks($, url),
          images: this.extractImages($),
          forms: this.extractForms($)
        },
        seo: this.analyzeSEO($)
      };

      if (tracker) {
        tracker.addThinking(`Website analysis complete for ${domain}`, {
          technologies: crawlData.technologies,
          seoScore: Object.values(crawlData.seo).filter(Boolean).length,
          formsFound: crawlData.content.forms.length,
          internalLinks: crawlData.content.links.internal.length
        });
      }

      return crawlData;
      
    } catch (error) {
      logger.error(`Crawl failed for ${domain}:`, error);
      return {
        hasWebsite: false,
        error: error.message,
        domain
      };
    }
  }

  detectTechnologies($) {
    const technologies = [];
    
    const scripts = $('script[src]').map((i, el) => $(el).attr('src')).get();
    scripts.forEach(src => {
      if (src.includes('jquery')) technologies.push('jQuery');
      if (src.includes('react')) technologies.push('React');
      if (src.includes('vue')) technologies.push('Vue');
      if (src.includes('angular')) technologies.push('Angular');
    });

    const generator = $('meta[name="generator"]').attr('content');
    if (generator) technologies.push(generator);

    return [...new Set(technologies)];
  }

  extractHeadings($) {
    const headings = {};
    ['h1', 'h2', 'h3'].forEach(tag => {
      headings[tag] = $(tag).map((i, el) => $(el).text().trim()).get();
    });
    return headings;
  }

  extractLinks($, baseUrl) {
    const links = {
      internal: [],
      external: []
    };

    $('a[href]').each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      
      if (href.startsWith('http')) {
        const url = new URL(href);
        const baseUrlObj = new URL(baseUrl);
        
        if (url.hostname === baseUrlObj.hostname) {
          links.internal.push({ href, text });
        } else {
          links.external.push({ href, text });
        }
      } else if (href.startsWith('/')) {
        links.internal.push({ href, text });
      }
    });

    return links;
  }

  extractImages($) {
    return $('img').map((i, el) => ({
      src: $(el).attr('src'),
      alt: $(el).attr('alt') || ''
    })).get();
  }

  extractForms($) {
    return $('form').map((i, el) => {
      const $form = $(el);
      return {
        action: $form.attr('action') || '',
        method: $form.attr('method') || 'GET',
        inputs: $form.find('input, textarea, select').map((j, input) => ({
          type: $(input).attr('type') || 'text',
          name: $(input).attr('name') || '',
          required: $(input).attr('required') !== undefined
        })).get()
      };
    }).get();
  }


  analyzeSEO($) {
    return {
      hasTitle: !!$('title').text(),
      titleLength: $('title').text().length,
      hasMetaDescription: !!$('meta[name="description"]').attr('content'),
      descriptionLength: ($('meta[name="description"]').attr('content') || '').length,
      hasH1: $('h1').length > 0,
      h1Count: $('h1').length,
      hasCanonical: !!$('link[rel="canonical"]').attr('href'),
      hasRobots: !!$('meta[name="robots"]').attr('content'),
      hasOpenGraph: $('meta[property^="og:"]').length > 0,
      hasTwitterCard: $('meta[name^="twitter:"]').length > 0
    };
  }

  async close() {
    // No cleanup needed for fetch-based crawler
  }
}