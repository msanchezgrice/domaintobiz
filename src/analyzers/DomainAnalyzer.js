import { DomainResearcher } from './DomainResearcher.js';
import { WebCrawler } from './WebCrawler.js';
import { DomainRanker } from './DomainRanker.js';
import { logger } from '../utils/logger.js';

export class DomainAnalyzer {
  constructor() {
    this.researcher = new DomainResearcher();
    this.crawler = new WebCrawler();
    this.ranker = new DomainRanker();
  }

  async analyzeDomains(domains, tracker = null) {
    logger.info(`Starting analysis of ${domains.length} domains`);
    
    if (tracker) {
      tracker.addThinking('Starting comprehensive domain analysis', {
        totalDomains: domains.length,
        analysisPlan: 'Each domain will be analyzed for WHOIS data, DNS records, existing content, and business potential'
      });
    }
    
    const analysisResults = [];
    
    for (const domain of domains) {
      try {
        if (tracker) {
          tracker.addThinking(`Analyzing domain: ${domain}`, {
            step: 'Starting research and crawling',
            checks: ['WHOIS lookup', 'DNS resolution', 'Website crawling', 'Content analysis']
          });
        }
        
        const research = await this.researcher.research(domain, tracker);
        const crawlData = await this.crawler.crawl(domain, tracker);
        
        const analysis = {
          domain,
          research,
          crawlData,
          timestamp: new Date().toISOString()
        };
        
        if (tracker) {
          tracker.addThinking(`Completed analysis for ${domain}`, {
            availability: research?.availability,
            hasWebsite: crawlData?.hasWebsite,
            statusCode: crawlData?.statusCode,
            technologies: crawlData?.technologies || [],
            seoQuality: crawlData?.seo ? 'analyzed' : 'no website'
          });
        }
        
        analysisResults.push(analysis);
      } catch (error) {
        logger.error(`Failed to analyze ${domain}:`, error);
        
        if (tracker) {
          tracker.addThinking(`Analysis failed for ${domain}`, {
            error: error.message,
            impact: 'Domain will receive low score in ranking'
          });
        }
        
        analysisResults.push({
          domain,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    if (tracker) {
      tracker.addThinking('Starting intelligent domain ranking', {
        completedAnalyses: analysisResults.filter(r => !r.error).length,
        failedAnalyses: analysisResults.filter(r => r.error).length,
        rankingFactors: ['availability', 'memorability', 'brandability', 'SEO value', 'domain age', 'technical quality']
      });
    }
    
    const rankedDomains = await this.ranker.rank(analysisResults, tracker);
    
    if (tracker) {
      tracker.addThinking('Domain ranking completed', {
        bestDomain: rankedDomains[0]?.domain,
        bestScore: Math.round(rankedDomains[0]?.score || 0),
        recommendation: rankedDomains[0]?.error ? 'No suitable domains found' : 'Ready for business creation'
      });
    }
    
    return {
      analyzed: analysisResults,
      rankings: rankedDomains,
      bestDomain: rankedDomains[0]
    };
  }
}