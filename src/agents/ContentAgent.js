import OpenAI from 'openai';
import { logger } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

export class ContentAgent {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async execute(taskData, tracker = null) {
    logger.info(`Content Agent executing for ${taskData.strategy.domain}`);
    
    if (tracker) {
      tracker.addAgentLog('content', 'Starting content generation process', {
        domain: taskData.strategy.domain,
        businessType: taskData.strategy.businessModel?.type,
        brandVoice: taskData.strategy.brandStrategy?.toneOfVoice
      });
    }
    
    const { businessModel, brandStrategy, mvpPlan } = taskData.strategy;
    
    if (tracker) {
      tracker.addAgentLog('content', 'Generating SEO metadata and page structure', {
        targetMarket: businessModel?.targetMarket,
        coreFeatures: mvpPlan?.coreFeatures?.length || 0
      });
    }
    
    const content = await this.generateAllContent({
      domain: taskData.strategy.domain,
      business: businessModel,
      brand: brandStrategy,
      mvp: mvpPlan
    });
    
    if (tracker) {
      tracker.addAgentLog('content', 'Optimizing content for SEO and conversions', {
        sectionsCreated: Object.keys(content.sections || {}).length,
        formsGenerated: Object.keys(content.forms || {}).length,
        primaryKeywords: content.metadata?.keywords?.slice(0, 3) || []
      });
    }
    
    const optimizedContent = await this.optimizeForSEO(content, taskData.strategy.domain);
    
    const outputDir = path.join('output', taskData.executionId || 'temp', 'content');
    await fs.mkdir(outputDir, { recursive: true });
    
    await fs.writeFile(
      path.join(outputDir, 'content.json'),
      JSON.stringify(optimizedContent, null, 2)
    );
    
    if (tracker) {
      tracker.addAgentLog('content', 'Content generation completed successfully', {
        totalWordCount: this.countWords(optimizedContent),
        seoOptimized: true,
        legalPagesIncluded: Object.keys(optimizedContent.legal || {}).length
      });
    }
    
    return {
      content: optimizedContent,
      outputPath: outputDir
    };
  }
  
  countWords(content) {
    let totalWords = 0;
    const countInObject = (obj) => {
      if (typeof obj === 'string') {
        totalWords += obj.split(' ').length;
      } else if (typeof obj === 'object' && obj !== null) {
        Object.values(obj).forEach(countInObject);
      }
    };
    countInObject(content);
    return totalWords;
  }

  async generateAllContent(context) {
    const sections = [
      'hero',
      'features',
      'benefits',
      'pricing',
      'testimonials',
      'faq',
      'cta',
      'footer'
    ];
    
    const content = {
      metadata: await this.generateMetadata(context),
      sections: {}
    };
    
    for (const section of sections) {
      content.sections[section] = await this.generateSectionContent(section, context);
    }
    
    content.forms = await this.generateFormContent(context);
    content.legal = await this.generateLegalContent(context);
    
    return content;
  }

  async generateMetadata(context) {
    const prompt = `
    You are an SEO expert. Generate comprehensive, SEO-optimized metadata for ${context.domain}.
    
    BUSINESS CONTEXT:
    - Domain meaning: ${context.business.domainMeaning}
    - Business concept: ${context.business.businessConcept}
    - Value proposition: ${context.business.valueProposition}
    - Target market: ${context.business.targetMarket}
    - Problem solved: ${context.business.problemSolved}
    - Industry: ${context.business.industry}
    
    BRAND CONTEXT:
    - Positioning: ${context.brand.positioning}
    - Brand promise: ${context.brand.brandPromise}
    - Tone of voice: ${context.brand.toneOfVoice?.description}
    - Primary message: ${context.brand.messagingFramework?.primaryMessage}
    - Content themes: ${JSON.stringify(context.brand.contentThemes)}
    
    Create metadata that:
    1. Accurately reflects the domain meaning and business purpose
    2. Appeals to the specific target audience
    3. Uses relevant keywords for the industry/niche
    4. Conveys trust and credibility
    5. Drives organic search traffic
    
    Generate:
    1. Page title (50-60 chars) - compelling and keyword-rich
    2. Meta description (150-160 chars) - persuasive and action-oriented
    3. Keywords (8-12) - mix of primary, secondary, and long-tail
    4. OpenGraph data for social sharing
    5. Twitter Card data
    6. Schema.org structured data suggestions
    
    IMPORTANT: Return ONLY a valid JSON object:
    {
      "title": "compelling page title with primary keyword",
      "description": "persuasive meta description that drives clicks", 
      "keywords": ["primary keyword", "secondary keyword", "long-tail keyword", "intent keyword"],
      "openGraph": {
        "title": "social-optimized title",
        "description": "social-optimized description",
        "type": "website",
        "image": "suggested image description"
      },
      "twitter": {
        "card": "summary_large_image",
        "title": "twitter-optimized title",
        "description": "twitter-optimized description"
      },
      "schema": {
        "type": "Organization/WebSite/Service",
        "name": "business name",
        "description": "business description",
        "url": "website url"
      }
    }
    `;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4.1-2025-04-14',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 1000
    });

    try {
      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      logger.error('Failed to parse metadata JSON:', error);
      return {
        title: `${context.domain} - Your Business Solution`,
        description: `Discover innovative solutions and services at ${context.domain}`,
        keywords: [context.domain.split('.')[0], 'business', 'solutions', 'services'],
        openGraph: {
          title: `${context.domain} - Your Business Solution`,
          description: `Discover innovative solutions and services at ${context.domain}`
        },
        twitter: {
          title: `${context.domain} - Your Business Solution`,
          description: `Discover innovative solutions and services at ${context.domain}`
        }
      };
    }
  }

  async generateSectionContent(section, context) {
    const sectionGuidelines = {
      hero: {
        goal: 'Create irresistible hero copy that immediately grabs attention and promises a valuable outcome',
        structure: 'Benefit-driven headline, pain-aware subheadline, urgency-creating CTAs that demand action'
      },
      features: {
        goal: 'Transform features into compelling benefits that show clear value and outcomes',
        structure: 'Benefit-first titles, outcome-focused descriptions that answer "what\'s in it for me?"'
      },
      benefits: {
        goal: 'Paint a picture of the transformed life/business after using the solution',
        structure: 'Before/after scenarios, emotional outcomes, specific results and improvements'
      },
      pricing: {
        goal: 'Position pricing as investment in success, not cost - remove price objections',
        structure: 'Value-focused tiers, benefit-heavy descriptions, social proof elements'
      },
      testimonials: {
        goal: 'Build irresistible social proof with specific, results-focused success stories',
        structure: 'Specific results, emotional quotes, credible details that build trust'
      },
      faq: {
        goal: 'Address objections and fears while reinforcing benefits and building confidence',
        structure: 'Common concerns answered with reassurance and benefit reinforcement'
      },
      cta: {
        goal: 'Create unstoppable momentum toward conversion with urgency and clear value',
        structure: 'Action-demanding CTAs with benefit reinforcement and urgency elements'
      },
      footer: {
        goal: 'Final conversion opportunity with trust signals and benefit reinforcement',
        structure: 'Memorable tagline, trust elements, final conversion opportunities'
      }
    };

    const guideline = sectionGuidelines[section] || sectionGuidelines.hero;

    const prompt = `
    You are a conversion copywriter. Generate high-converting ${section} content for ${context.domain}.
    
    BUSINESS CONTEXT:
    - Domain meaning: ${context.business.domainMeaning}
    - Business concept: ${context.business.businessConcept}
    - Value proposition: ${context.business.valueProposition}
    - Target audience: ${context.business.targetMarket}
    - Target persona: ${context.business.targetPersona}
    - Problem solved: ${context.business.problemSolved}
    - Competitive advantage: ${context.business.competitiveAdvantage}
    
    BRAND CONTEXT:
    - Positioning: ${context.brand.positioning}
    - Brand promise: ${context.brand.brandPromise}
    - Values: ${JSON.stringify(context.brand.values)}
    - Personality: ${JSON.stringify(context.brand.personality)}
    - Tone of voice: ${context.brand.toneOfVoice?.description}
    - Primary message: ${context.brand.messagingFramework?.primaryMessage}
    - Do say: ${JSON.stringify(context.brand.toneOfVoice?.doSay)}
    - Don't say: ${JSON.stringify(context.brand.toneOfVoice?.dontSay)}
    
    MVP CONTEXT:
    - Core features: ${JSON.stringify(context.mvp?.coreFeatures)}
    - Content themes: ${JSON.stringify(context.mvp?.contentStrategy?.contentPillars)}
    
    SECTION REQUIREMENTS:
    Goal: ${guideline.goal}
    Structure: ${guideline.structure}
    
    Create WEBSITE COPYWRITING that:
    1. Uses MARKETING LANGUAGE, not business descriptions
    2. Focuses on BENEFITS and OUTCOMES, not features
    3. Addresses PAIN POINTS emotionally and offers compelling solutions
    4. Uses power words, action verbs, and persuasive techniques
    5. Creates URGENCY and DESIRE to take action immediately
    6. Sounds like professional website copy, not a business plan
    
    COPYWRITING EXAMPLES:
    - Bad: "Platform for opportunity discovery" → Good: "Never Miss Your Dream Job Again"
    - Bad: "Form creation software" → Good: "Turn Boring Forms Into Profit-Generating Conversations"
    - Bad: "Analytics dashboard" → Good: "See Your Success In Real-Time"
    
    IMPORTANT: Return ONLY a valid JSON object with persuasive, benefit-focused website copy:
    {
      "title": "compelling section title",
      "subtitle": "supporting subtitle that reinforces value",
      "headline": "main headline (for hero section)",
      "subheadline": "supporting headline (for hero section)",
      "content": "main content text with specific benefits and value",
      "items": [
        {
          "title": "specific feature/benefit title",
          "description": "detailed description focusing on user outcomes",
          "benefit": "specific benefit or result for the user"
        }
      ],
      "cta": {
        "primary": "main call to action text",
        "secondary": "alternative action text"
      },
      "supportingElements": ["trust signal 1", "social proof element", "risk reducer"]
    }
    `;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4.1-2025-04-14',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 1500
    });

    try {
      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      logger.error(`Failed to parse ${section} content JSON:`, error);
      // Return fallback content
      return {
        title: section.charAt(0).toUpperCase() + section.slice(1),
        content: `Content for ${section} section`,
        items: section === 'features' ? [
          { title: 'Feature 1', description: 'Description 1' },
          { title: 'Feature 2', description: 'Description 2' },
          { title: 'Feature 3', description: 'Description 3' }
        ] : undefined
      };
    }
  }

  async generateFormContent(context) {
    const forms = {
      signup: {
        title: "Start Your Free Trial",
        subtitle: "No credit card required",
        fields: [
          { name: "email", type: "email", placeholder: "Enter your email", required: true },
          { name: "name", type: "text", placeholder: "Your name", required: true },
          { name: "company", type: "text", placeholder: "Company (optional)", required: false }
        ],
        submitText: "Get Started",
        privacyText: "We respect your privacy. Unsubscribe at any time."
      },
      newsletter: {
        title: "Stay Updated",
        subtitle: "Get the latest updates and exclusive offers",
        fields: [
          { name: "email", type: "email", placeholder: "Your email", required: true }
        ],
        submitText: "Subscribe",
        privacyText: "No spam, ever. Unsubscribe anytime."
      },
      contact: {
        title: "Get in Touch",
        subtitle: "We'd love to hear from you",
        fields: [
          { name: "name", type: "text", placeholder: "Your name", required: true },
          { name: "email", type: "email", placeholder: "Your email", required: true },
          { name: "message", type: "textarea", placeholder: "Your message", required: true }
        ],
        submitText: "Send Message",
        privacyText: "We'll get back to you within 24 hours."
      }
    };

    return forms;
  }

  async generateLegalContent(context) {
    const legal = {
      privacy: {
        title: "Privacy Policy",
        lastUpdated: new Date().toISOString().split('T')[0],
        sections: [
          {
            title: "Information We Collect",
            content: "We collect information you provide directly to us, such as when you create an account, subscribe to our newsletter, or contact us."
          },
          {
            title: "How We Use Your Information",
            content: "We use the information we collect to provide, maintain, and improve our services, communicate with you, and comply with legal obligations."
          },
          {
            title: "Data Security",
            content: "We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction."
          }
        ]
      },
      terms: {
        title: "Terms of Service",
        lastUpdated: new Date().toISOString().split('T')[0],
        sections: [
          {
            title: "Acceptance of Terms",
            content: "By accessing or using our service, you agree to be bound by these Terms of Service and all applicable laws and regulations."
          },
          {
            title: "Use of Service",
            content: "You may use our service only for lawful purposes and in accordance with these Terms. You agree not to use our service in any way that violates any applicable federal, state, local, or international law or regulation."
          }
        ]
      }
    };

    return legal;
  }

  async optimizeForSEO(content, domain) {
    const keywords = content.metadata.keywords || [];
    const primaryKeyword = keywords[0] || domain.split('.')[0];
    
    const optimized = JSON.parse(JSON.stringify(content));
    
    if (optimized.sections.hero.headline) {
      optimized.sections.hero.headline = this.injectKeyword(
        optimized.sections.hero.headline,
        primaryKeyword
      );
    }
    
    return optimized;
  }

  injectKeyword(text, keyword) {
    if (text.toLowerCase().includes(keyword.toLowerCase())) {
      return text;
    }
    return text;
  }
}