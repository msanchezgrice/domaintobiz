import { logger } from '../utils/logger.js';

export class DomainRanker {
  constructor() {
    this.weights = {
      availability: 0.25,
      memorability: 0.20,
      brandability: 0.20,
      seoValue: 0.15,
      domainAge: 0.10,
      technicalQuality: 0.10
    };
  }

  async rank(analysisResults, tracker = null) {
    logger.info(`Ranking ${analysisResults.length} domains`);
    
    if (tracker) {
      tracker.addThinking('Applying intelligent ranking algorithm', {
        domains: analysisResults.map(r => r.domain),
        weights: this.weights,
        methodology: 'Weighted scoring across 6 key metrics'
      });
    }
    
    const scoredDomains = analysisResults.map(result => {
      if (result.error) {
        if (tracker) {
          tracker.addThinking(`Skipping ${result.domain} due to analysis error`, {
            error: result.error,
            score: 0
          });
        }
        return {
          ...result,
          score: 0,
          breakdown: {},
          reasoning: 'Analysis failed - unable to score'
        };
      }

      const scores = {
        availability: this.scoreAvailability(result),
        memorability: this.scoreMemorability(result.domain),
        brandability: this.scoreBrandability(result.domain),
        seoValue: this.scoreSEO(result),
        domainAge: this.scoreDomainAge(result),
        technicalQuality: this.scoreTechnicalQuality(result)
      };

      const totalScore = Object.entries(scores).reduce(
        (total, [metric, score]) => total + (score * this.weights[metric]),
        0
      );

      const reasoning = this.generateReasoning(result, scores);

      if (tracker) {
        tracker.addThinking(`Scored ${result.domain}: ${Math.round(totalScore)}/100`, {
          breakdown: Object.entries(scores).map(([key, value]) => `${key}: ${Math.round(value)}`),
          reasoning: reasoning.summary,
          strengths: reasoning.strengths,
          weaknesses: reasoning.weaknesses
        });
      }

      return {
        ...result,
        score: totalScore,
        breakdown: scores,
        reasoning
      };
    });

    const sortedDomains = scoredDomains.sort((a, b) => b.score - a.score);
    
    if (tracker && sortedDomains.length > 0) {
      tracker.addThinking('Ranking analysis complete', {
        winner: sortedDomains[0].domain,
        winnerScore: Math.round(sortedDomains[0].score),
        winnerReason: sortedDomains[0].reasoning?.summary,
        topThree: sortedDomains.slice(0, 3).map(d => ({
          domain: d.domain,
          score: Math.round(d.score)
        }))
      });
    }

    return sortedDomains;
  }
  
  generateReasoning(result, scores) {
    const strengths = [];
    const weaknesses = [];
    const domainName = result.domain.split('.')[0];
    
    // Analyze strengths
    if (scores.availability >= 80) {
      strengths.push(result.crawlData?.hasWebsite ? 'Existing site can be improved' : 'Domain available for development');
    }
    if (scores.memorability >= 80) {
      strengths.push('Highly memorable and easy to recall');
    }
    if (scores.brandability >= 80) {
      strengths.push('Strong brand potential');
    }
    if (scores.seoValue >= 70) {
      strengths.push('Good SEO foundation');
    }
    if (scores.domainAge >= 60) {
      strengths.push('Established domain with history');
    }
    
    // Analyze weaknesses
    if (scores.availability < 40) {
      weaknesses.push('Limited availability or poor existing content');
    }
    if (scores.memorability < 60) {
      weaknesses.push('May be difficult to remember or pronounce');
    }
    if (scores.brandability < 60) {
      weaknesses.push('Limited brand potential');
    }
    if (scores.seoValue < 50) {
      weaknesses.push('SEO challenges expected');
    }
    
    // Generate summary
    let summary = '';
    if (scores.availability >= 80 && scores.brandability >= 70) {
      summary = 'Excellent business potential with strong brand opportunity';
    } else if (scores.memorability >= 80) {
      summary = 'Memorable domain with good market potential';
    } else if (scores.availability >= 60) {
      summary = 'Viable option for business development';
    } else {
      summary = 'Limited potential due to availability or brand concerns';
    }
    
    return {
      summary,
      strengths,
      weaknesses,
      recommendation: strengths.length > weaknesses.length ? 'Recommended for business creation' : 'Consider alternative domains'
    };
  }

  scoreAvailability(result) {
    if (result.research?.availability === true) return 100;
    if (!result.crawlData?.hasWebsite) return 80;
    if (result.crawlData?.statusCode === 404) return 60;
    
    // If website exists, score based on quality and potential for improvement
    if (result.crawlData?.hasWebsite) {
      let score = 40; // Base score for existing site
      
      // Better score if it's a simple/basic site that can be improved
      if (this.isBasicLandingPage(result.crawlData)) score += 20;
      
      // Lower score if it's a fully developed site
      if (this.isFullyDeveloped(result.crawlData)) score -= 20;
      
      return Math.max(10, score);
    }
    
    return 0;
  }

  scoreMemorability(domain) {
    let score = 100;
    
    const name = domain.split('.')[0];
    
    if (name.length > 15) score -= 30;
    else if (name.length > 10) score -= 15;
    else if (name.length < 5) score -= 10;
    
    if (name.match(/[0-9]/)) score -= 20;
    
    if (name.match(/-/g)?.length > 1) score -= 15;
    
    if (this.isPronounceable(name)) score += 10;
    
    return Math.max(0, Math.min(100, score));
  }

  scoreBrandability(domain) {
    let score = 80;
    const name = domain.split('.')[0];
    
    if (this.isGenericWord(name)) score -= 30;
    
    if (name.match(/^[a-z]+$/i)) score += 20;
    
    if (this.hasGoodExtension(domain)) score += 10;
    else score -= 20;
    
    if (this.soundsUnique(name)) score += 15;
    
    return Math.max(0, Math.min(100, score));
  }

  scoreSEO(result) {
    if (!result.crawlData?.seo) return 50;
    
    let score = 0;
    const seo = result.crawlData.seo;
    
    if (seo.hasTitle) score += 15;
    if (seo.titleLength >= 30 && seo.titleLength <= 60) score += 10;
    if (seo.hasMetaDescription) score += 15;
    if (seo.descriptionLength >= 120 && seo.descriptionLength <= 160) score += 10;
    if (seo.hasH1 && seo.h1Count === 1) score += 15;
    if (seo.hasCanonical) score += 10;
    if (seo.hasRobots) score += 10;
    if (seo.hasOpenGraph) score += 10;
    if (seo.hasTwitterCard) score += 5;
    
    return score;
  }

  scoreDomainAge(result) {
    const age = result.research?.registrationAge;
    if (!age) return 50;
    
    if (age < 1) return 20;
    if (age < 2) return 40;
    if (age < 5) return 60;
    if (age < 10) return 80;
    return 100;
  }

  scoreTechnicalQuality(result) {
    if (!result.crawlData?.hasWebsite) return 100;
    
    let score = 50;
    
    if (result.crawlData.statusCode === 200) score += 20;
    
    const loadTime = result.crawlData.performance?.loadTime;
    if (loadTime && loadTime < 3000) score += 20;
    else if (loadTime && loadTime < 5000) score += 10;
    
    if (result.crawlData.technologies?.length > 0) score += 10;
    
    return Math.min(100, score);
  }

  isPronounceable(word) {
    const vowels = 'aeiou';
    const consonants = 'bcdfghjklmnpqrstvwxyz';
    let hasVowel = false;
    let consonantStreak = 0;
    
    for (let char of word.toLowerCase()) {
      if (vowels.includes(char)) {
        hasVowel = true;
        consonantStreak = 0;
      } else if (consonants.includes(char)) {
        consonantStreak++;
        if (consonantStreak > 3) return false;
      }
    }
    
    return hasVowel;
  }

  isGenericWord(name) {
    const genericWords = [
      'shop', 'store', 'buy', 'sale', 'deal', 'best', 'top', 'great',
      'super', 'mega', 'ultra', 'pro', 'plus', 'max', 'prime'
    ];
    
    const nameLower = name.toLowerCase();
    return genericWords.some(word => nameLower.includes(word));
  }

  hasGoodExtension(domain) {
    const goodExtensions = ['.com', '.io', '.co', '.app', '.dev', '.ai'];
    return goodExtensions.some(ext => domain.endsWith(ext));
  }

  soundsUnique(name) {
    const commonPrefixes = ['get', 'my', 'the', 'best', 'top', 'new'];
    const commonSuffixes = ['ly', 'ify', 'io', 'er', 'it'];
    
    const nameLower = name.toLowerCase();
    
    const hasCommonPrefix = commonPrefixes.some(prefix => 
      nameLower.startsWith(prefix)
    );
    const hasCommonSuffix = commonSuffixes.some(suffix => 
      nameLower.endsWith(suffix)
    );
    
    return !hasCommonPrefix && !hasCommonSuffix;
  }

  isBasicLandingPage(crawlData) {
    // Check if it's a simple landing page that could be improved
    const indicators = [
      crawlData.content?.headings?.h1?.length <= 2,
      crawlData.content?.forms?.length <= 1,
      crawlData.content?.links?.internal?.length <= 10,
      !crawlData.technologies?.includes('React') && !crawlData.technologies?.includes('Vue'),
      crawlData.seo?.titleLength < 40 || crawlData.seo?.titleLength > 70
    ];
    
    return indicators.filter(Boolean).length >= 3;
  }

  isFullyDeveloped(crawlData) {
    // Check if it's a fully developed site
    const indicators = [
      crawlData.content?.headings?.h1?.length > 3,
      crawlData.content?.forms?.length > 2,
      crawlData.content?.links?.internal?.length > 20,
      crawlData.technologies?.length > 3,
      crawlData.seo?.hasOpenGraph && crawlData.seo?.hasTwitterCard,
      crawlData.performance?.loadTime < 2000
    ];
    
    return indicators.filter(Boolean).length >= 4;
  }
}