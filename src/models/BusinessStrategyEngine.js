import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger.js';

export class BusinessStrategyEngine {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }

  async generateStrategy(domainAnalysis, tracker = null) {
    logger.info(`Generating business strategy for ${domainAnalysis.domain}`);
    
    const context = this.buildContext(domainAnalysis);
    
    // Add overall timeout for strategy generation (45 seconds)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Strategy generation timeout after 45 seconds')), 45000);
    });
    
    try {
      return await Promise.race([
        this.generateStrategyInternal(context, tracker),
        timeoutPromise
      ]);
    } catch (error) {
      if (error.message.includes('timeout')) {
        console.warn('⚠️ Strategy generation timed out, using enhanced fallback');
        return this.generateEnhancedFallbackStrategy(context, domainAnalysis);
      }
      throw error;
    }
  }

  async generateStrategyInternal(context, tracker = null) {
    if (tracker) {
      tracker.addThinking('Analyzing domain characteristics for business model', {
        domain: context.domain,
        hasExistingSite: context.hasExistingSite,
        domainScore: context.score,
        keyFactors: ['domain name semantics', 'existing content analysis', 'market positioning opportunities']
      });
    }
    
    // Generate business model (most critical)
    if (tracker) tracker.addThinking('Defining business model using Claude reasoning', {
      approach: 'Analyzing domain for business type, revenue model, and value proposition'
    });
    const businessModel = await this.defineBusinessModelWithTimeout(context, tracker);
    
    // Generate other components with reduced complexity for speed
    if (tracker) tracker.addThinking('Creating streamlined brand and MVP strategy', {
      approach: 'Rapid strategy generation optimized for performance'
    });
    
    const [brandStrategy, mvpPlan] = await Promise.all([
      this.defineStreamlinedBrandStrategy(context, businessModel, tracker),
      this.defineStreamlinedMVPScope(context, businessModel, tracker)
    ]);

    // Create lightweight implementation plan
    const implementation = this.createLightweightImplementationPlan({
      domain: context.domain,
      businessModel,
      brandStrategy,
      mvpPlan
    });

    const strategy = {
      domain: domainAnalysis.domain,
      businessModel,
      brandStrategy,
      mvpScope: mvpPlan, // Also add as mvpScope for backward compatibility
      mvpPlan,
      implementation,
      // Add flat fields for easier access in templates
      targetMarket: businessModel.targetMarket,
      valueProposition: businessModel.valueProposition,
      industry: businessModel.industry,
      revenueModel: businessModel.revenueModel
    };

    console.log('🎯 Final strategy structure:', JSON.stringify({
      businessModel: !!businessModel,
      brandStrategy: !!brandStrategy,
      mvpPlan: !!mvpPlan,
      hasTargetMarket: !!businessModel.targetMarket,
      hasValueProposition: !!businessModel.valueProposition,
      hasIndustry: !!businessModel.industry
    }, null, 2));

    return strategy;
  }

  async defineBusinessModelWithTimeout(context, tracker = null) {
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Business model generation timeout')), 15000);
    });
    
    try {
      return await Promise.race([
        this.defineBusinessModel(context, tracker),
        timeout
      ]);
    } catch (error) {
      if (error.message.includes('timeout')) {
        console.warn('⚠️ Business model generation timed out, using AI insights fallback');
        return this.createFallbackBusinessModel(context);
      }
      throw error;
    }
  }

  async defineStreamlinedBrandStrategy(context, businessModel, tracker = null) {
    // Simplified brand strategy without full AI generation
    return {
      positioning: businessModel.valueProposition || `Leading solution for ${context.domainName} needs`,
      brandPromise: 'Reliable, expert guidance and solutions',
      values: ['trust', 'expertise', 'innovation', 'transparency', 'reliability'],
      personality: ['professional', 'knowledgeable', 'helpful', 'trustworthy', 'modern'],
      visualIdentity: {
        description: 'Clean, professional design with modern aesthetics',
        colorPalette: 'Primary blue (#2563eb), accent green (#10b981), neutral grays',
        typography: 'Clean sans-serif fonts for readability and modernity',
        imagery: 'Professional, authentic imagery that builds trust',
        logoDirection: 'Simple, memorable mark that represents the domain concept'
      },
      toneOfVoice: {
        description: 'Professional yet approachable, expert but accessible',
        doSay: ['evidence-based', 'proven solutions', 'expert guidance'],
        dontSay: ['overly technical jargon', 'unsubstantiated claims']
      },
      messagingFramework: {
        primaryMessage: businessModel.valueProposition || 'Expert solutions for your needs',
        secondaryMessages: ['Trusted by professionals', 'Proven results'],
        audienceSpecific: {
          mainAudience: `Tailored solutions for ${businessModel.targetMarket}`,
          secondaryAudience: 'Professional guidance for everyone'
        }
      },
      contentThemes: ['expert insights', 'practical solutions', 'industry trends', 'success stories'],
      trustBuilders: ['expert credentials', 'proven results', 'customer testimonials'],
      differentiation: businessModel.competitiveAdvantage || 'Unique expertise and proven methodology'
    };
  }

  async defineStreamlinedMVPScope(context, businessModel, tracker = null) {
    // Generate features based on business model and domain insights
    const coreFeatures = this.generateCoreFeatures(context, businessModel);
    
    return {
      coreFeatures,
      userJourney: {
        discovery: 'Search engines, direct navigation, referrals',
        landing: 'Clear value proposition with immediate credibility',
        engagement: 'Interactive content and clear calls to action',
        conversion: 'Contact forms, service inquiries, newsletter signup',
        retention: 'Regular content updates and follow-up communication'
      },
      contentStrategy: {
        launchContent: ['homepage content', 'service descriptions', 'about page', 'contact information'],
        contentPillars: ['expertise', 'solutions', 'results'],
        initialPages: ['home', 'services', 'about', 'contact']
      },
      technicalStack: {
        frontend: 'Modern HTML5, CSS3, JavaScript',
        backend: 'Static site with form handling',
        database: 'Contact form data storage',
        hosting: 'Vercel/Netlify',
        analytics: 'Google Analytics',
        integrations: ['contact forms', 'email notifications']
      },
      designRequirements: {
        pageTypes: ['landing page', 'service pages', 'contact page'],
        components: ['navigation', 'hero section', 'feature grid', 'contact form'],
        responsiveNeeds: 'Mobile-first responsive design',
        brandAlignment: 'Reflects professional and trustworthy brand'
      },
      successMetrics: {
        traffic: '100+ unique visitors in first month',
        engagement: '2+ pages per session',
        conversion: '5% contact form completion rate',
        revenue: 'First inquiries within 30 days'
      }
    };
  }

  createLightweightImplementationPlan(strategy) {
    return {
      landingPage: {
        sections: ['hero', 'features', 'about', 'contact'],
        ctaPlacement: ['hero', 'features', 'footer'],
        formsNeeded: ['contact', 'newsletter']
      },
      designSpecs: {
        colorPalette: strategy.brandStrategy.visualIdentity.colorPalette,
        typography: strategy.brandStrategy.visualIdentity.typography,
        layout: 'modern responsive grid'
      },
      technicalRequirements: {
        framework: 'HTML/CSS/JS',
        features: strategy.mvpPlan.coreFeatures.map(f => f.name),
        integrations: ['contact forms', 'analytics']
      },
      agentTasks: {
        design: 'Create visual design system and layouts',
        content: 'Generate all website copy and content',
        development: 'Build responsive website with all features',
        deployment: 'Deploy and configure hosting'
      }
    };
  }

  generateCoreFeatures(context, businessModel) {
    const features = [
      {
        name: 'Professional Landing Page',
        description: 'Modern, responsive homepage that clearly communicates value proposition',
        priority: 'high',
        timeToImplement: '2 days'
      },
      {
        name: 'Service Overview',
        description: 'Detailed explanation of services and solutions offered',
        priority: 'high',
        timeToImplement: '1 day'
      },
      {
        name: 'Contact System',
        description: 'Professional contact form with email notifications',
        priority: 'high',
        timeToImplement: '1 day'
      },
      {
        name: 'About Section',
        description: 'Credibility-building information about expertise and background',
        priority: 'medium',
        timeToImplement: '1 day'
      }
    ];

    // Add domain-specific features based on AI insights
    if (context.aiInsights?.suggestedFeatures) {
      context.aiInsights.suggestedFeatures.slice(0, 2).forEach((feature, index) => {
        features.push({
          name: feature,
          description: `${feature} functionality tailored to ${context.domainName}`,
          priority: 'medium',
          timeToImplement: '2 days'
        });
      });
    }

    return features;
  }

  createFallbackBusinessModel(context) {
    // Enhanced fallback using AI insights if available
    const aiInsights = context.aiInsights || {};
    
    return {
      domainMeaning: aiInsights.businessConcept || `Professional services related to ${context.domainName}`,
      businessConcept: aiInsights.businessConcept || `Expert ${context.domainName} solutions and consulting`,
      type: aiInsights.industryFit || 'Professional Services',
      industry: aiInsights.industryFit || 'Consulting',
      secondaryIndustries: ['Technology', 'Business Services'],
      revenueModel: 'service-based',
      revenueStreams: ['consulting services', 'premium content', 'training programs'],
      valueProposition: aiInsights.valueProposition || `Expert ${context.domainName} guidance and solutions`,
      problemSolved: `Challenges and concerns related to ${context.domainName}`,
      targetMarket: aiInsights.targetDemographic || 'Professionals seeking expert guidance',
      targetPersona: aiInsights.targetDemographic || 'Working professionals who need expert assistance',
      monetizationTimeline: '1-3 months',
      keyMetrics: ['client inquiries', 'consultation bookings', 'content engagement'],
      competitiveAdvantage: aiInsights.strengths?.join(', ') || 'Specialized expertise and professional approach'
    };
  }

  generateEnhancedFallbackStrategy(context, domainAnalysis) {
    const businessModel = this.createFallbackBusinessModel(context);
    const brandStrategy = {
      positioning: businessModel.valueProposition,
      brandPromise: 'Professional expertise and reliable solutions',
      values: ['trust', 'expertise', 'results', 'professionalism'],
      personality: ['knowledgeable', 'reliable', 'professional', 'helpful']
    };
    
    const mvpPlan = {
      coreFeatures: this.generateCoreFeatures(context, businessModel),
      technicalStack: {
        frontend: 'HTML/CSS/JavaScript',
        hosting: 'Vercel',
        analytics: 'Google Analytics'
      }
    };

    return {
      domain: domainAnalysis.domain,
      businessModel,
      brandStrategy,
      mvpScope: mvpPlan,
      mvpPlan,
      implementation: this.createLightweightImplementationPlan({
        domain: domainAnalysis.domain,
        businessModel,
        brandStrategy,
        mvpPlan
      }),
      targetMarket: businessModel.targetMarket,
      valueProposition: businessModel.valueProposition,
      industry: businessModel.industry,
      revenueModel: businessModel.revenueModel,
      fallback: true,
      fastGeneration: true
    };
  }

  buildContext(domainAnalysis) {
    return {
      domain: domainAnalysis.domain,
      domainName: domainAnalysis.domain.split('.')[0],
      extension: domainAnalysis.domain.split('.').slice(1).join('.'),
      hasExistingSite: domainAnalysis.crawlData?.hasWebsite || false,
      existingContent: domainAnalysis.crawlData?.content || null,
      seoMetrics: domainAnalysis.crawlData?.seo || null,
      score: domainAnalysis.score,
      breakdown: domainAnalysis.breakdown,
      // Enhanced domain insights from AI analysis
      aiInsights: domainAnalysis.aiInsights || null
    };
  }

  async defineBusinessModel(context, tracker = null) {
    const prompt = `
    You are an expert business strategist. Analyze the domain "${context.domain}" and create a comprehensive business model.
    
    Domain Analysis Data:
    - Domain: ${context.domain}
    - Core name: "${context.domainName}"
    - Extension: .${context.extension}
    - Existing site: ${context.hasExistingSite}
    - Score: ${context.score}/100
    
    ${context.aiInsights ? `
    ENHANCED DOMAIN INSIGHTS (use this to guide your business model):
    - Business Concept: ${context.aiInsights.businessConcept}
    - Founder Intent: ${context.aiInsights.founderIntent}
    - Value Proposition: ${context.aiInsights.valueProposition}
    - Target Demographic: ${context.aiInsights.targetDemographic}
    - Suggested Features: ${context.aiInsights.suggestedFeatures?.join(', ')}
    - Brand Personality: ${context.aiInsights.brandPersonality}
    - Industry Fit: ${context.aiInsights.industryFit}
    - Business Potential: ${context.aiInsights.businessPotential}
    
    IMPORTANT: Use these insights as the foundation for your business model. The AI has already analyzed what the founder was likely thinking when choosing this domain name.
    ` : `
    Step 1: Semantic Analysis (since no AI insights available)
    - What does "${context.domainName}" mean literally?
    - What questions, concerns, or topics does this domain name address?
    - What industry/niche does this domain naturally fit into?
    - What target audience would be interested in this domain name?
    - What problems or pain points does this domain name suggest?
    `}
    
    Step 2: Business Model Design
    ${context.aiInsights ? 
      'Based on the AI insights above, create a business model that perfectly matches the analyzed founder intent:' : 
      'Based on your semantic analysis, design a business that perfectly matches the domain meaning:'}
    
    1. Business Concept: What specific business should this domain represent?
    2. Industry Classification: Primary and secondary industries
    3. Revenue Model: How will this business make money? (subscription, one-time payment, freemium, advertising, affiliate, consulting, courses, etc.)
    4. Value Proposition: What unique value does this business provide?
    5. Target Market: Who specifically needs this solution?
    6. Problem Solved: What specific problem does this business solve?
    7. Monetization Strategy: Detailed revenue streams
    8. Success Metrics: How to measure success
    
    Example for domain "willaireplace.me":
    - Semantic meaning: "Will AI Replace Me?" - concerns about AI job displacement
    - Business: AI career impact assessment and guidance platform
    - Target: Professionals worried about AI automation
    - Value: Personalized AI impact analysis and career transition guidance
    
    IMPORTANT: Return ONLY a valid JSON object:
    {
      "domainMeaning": "what the domain name means",
      "businessConcept": "specific business concept that matches domain meaning",
      "type": "business type",
      "industry": "primary industry",
      "secondaryIndustries": ["industry1", "industry2"],
      "revenueModel": "primary revenue model",
      "revenueStreams": ["stream1", "stream2", "stream3"],
      "valueProposition": "unique value proposition",
      "problemSolved": "specific problem this solves",
      "targetMarket": "specific target market",
      "targetPersona": "detailed persona description",
      "monetizationTimeline": "timeline",
      "keyMetrics": ["metric1", "metric2", "metric3"],
      "competitiveAdvantage": "what makes this unique"
    }
    `;

    const response = await this.anthropic.messages.create({
      model: 'claude-3-haiku-20240307', // Faster model
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800 // Reduced for faster response
    });

    const businessModel = this.parseJSONResponse(response.content[0].text, 'business model', {
      domainMeaning: `Meaning derived from ${context.domainName}`,
      businessConcept: `Service platform based on ${context.domainName}`,
      type: 'Digital Platform',
      industry: 'Professional Services',
      secondaryIndustries: ['Technology', 'Consulting'],
      revenueModel: 'freemium',
      revenueStreams: ['premium subscriptions', 'consulting services', 'affiliate partnerships'],
      valueProposition: `Comprehensive solution addressing ${context.domainName} related needs`,
      problemSolved: `Key challenges related to ${context.domainName}`,
      targetMarket: 'Professionals and individuals seeking guidance',
      targetPersona: 'Working professionals aged 25-55 seeking expert guidance',
      monetizationTimeline: '2-4 months',
      keyMetrics: ['user engagement', 'conversion rate', 'customer satisfaction'],
      competitiveAdvantage: 'First-mover advantage with domain-specific expertise'
    });

    // Log the business model for debugging
    console.log('📊 Generated business model:', JSON.stringify(businessModel, null, 2));
    
    return businessModel;
  }

  async defineBrandStrategy(context, businessModel, tracker = null) {
    const prompt = `
    You are a brand strategist. Create a comprehensive brand strategy for "${context.domain}".
    
    Domain Context:
    - Domain: ${context.domain}
    - Core meaning: ${businessModel.domainMeaning || 'Analyze domain semantics'}
    - Business concept: ${businessModel.businessConcept || 'Service platform'}
    - Target audience: ${businessModel.targetMarket || 'General audience'}
    - Value proposition: ${businessModel.valueProposition || 'Comprehensive solution'}
    
    Business Context:
    - Industry: ${businessModel.industry}
    - Revenue model: ${businessModel.revenueModel}
    - Problem solved: ${businessModel.problemSolved}
    - Competitive advantage: ${businessModel.competitiveAdvantage}
    
    Create a brand strategy that:
    1. Reflects the domain name meaning and business concept
    2. Appeals to the specific target audience
    3. Addresses their pain points and concerns
    4. Builds trust and credibility
    5. Differentiates from competitors
    
    Define:
    1. Brand Positioning: One-sentence positioning that captures the essence
    2. Brand Promise: What do you promise to deliver?
    3. Core Values: 4-5 values that guide everything
    4. Personality Traits: 5-6 human-like traits
    5. Visual Identity: Detailed description of visual direction
    6. Tone of Voice: How the brand communicates
    7. Messaging Framework: Key messages for different audiences
    8. Content Themes: What topics/themes to focus on
    9. Trust Builders: How to establish credibility
    10. Differentiation: What makes this brand unique
    
    Return ONLY a valid JSON object:
    {
      "positioning": "brand positioning statement",
      "brandPromise": "what you promise to deliver",
      "values": ["value1", "value2", "value3", "value4", "value5"],
      "personality": ["trait1", "trait2", "trait3", "trait4", "trait5"],
      "visualIdentity": {
        "description": "overall visual direction",
        "colorPalette": "color strategy and specific colors",
        "typography": "font strategy",
        "imagery": "image style and content",
        "logoDirection": "logo concept and style"
      },
      "toneOfVoice": {
        "description": "overall tone description",
        "doSay": ["what to say", "communication style"],
        "dontSay": ["what to avoid", "wrong messages"]
      },
      "messagingFramework": {
        "primaryMessage": "main value proposition message",
        "secondaryMessages": ["supporting message 1", "supporting message 2"],
        "audienceSpecific": {
          "mainAudience": "tailored message for primary audience",
          "secondaryAudience": "message for secondary audience"
        }
      },
      "contentThemes": ["theme1", "theme2", "theme3", "theme4"],
      "trustBuilders": ["credibility element 1", "credibility element 2", "credibility element 3"],
      "differentiation": "unique differentiating factors"
    }
    `;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4.1-2025-04-14',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    });

    return this.parseJSONResponse(response.choices[0].message.content, 'brand strategy', {
      positioning: `Trusted guidance platform for ${context.domainName} related concerns`,
      brandPromise: 'Clear, actionable insights to navigate uncertainty',
      values: ['transparency', 'expertise', 'empowerment', 'trust', 'innovation'],
      personality: ['knowledgeable', 'reassuring', 'practical', 'honest', 'supportive'],
      visualIdentity: {
        description: 'Professional yet approachable design with calming, trustworthy elements',
        colorPalette: 'Deep blues for trust, accent greens for growth, warm grays for balance',
        typography: 'Clean, readable fonts that convey authority and clarity',
        imagery: 'Real people, authentic situations, forward-looking concepts',
        logoDirection: 'Simple, memorable mark that represents guidance and clarity'
      },
      toneOfVoice: {
        description: 'Expert but accessible, reassuring without being dismissive',
        doSay: ['evidence-based insights', 'practical guidance', 'honest assessments'],
        dontSay: ['fear-mongering', 'overly technical jargon', 'false promises']
      },
      messagingFramework: {
        primaryMessage: 'Navigate the future with confidence and clarity',
        secondaryMessages: ['Expert insights for informed decisions', 'Your trusted guide in uncertain times'],
        audienceSpecific: {
          mainAudience: 'Get the insights you need to make confident career decisions',
          secondaryAudience: 'Professional guidance for navigating change'
        }
      },
      contentThemes: ['future insights', 'practical guidance', 'expert analysis', 'real stories'],
      trustBuilders: ['expert credentials', 'data-driven insights', 'user testimonials'],
      differentiation: 'Combines expert analysis with practical, actionable guidance'
    });
  }

  async defineMVPScope(context, businessModel, brandStrategy, tracker = null) {
    const prompt = `
    You are a product strategist. Define an MVP (Minimum Viable Product) scope for "${context.domain}".
    
    Context:
    - Domain meaning: ${businessModel.domainMeaning}
    - Business concept: ${businessModel.businessConcept}
    - Target audience: ${businessModel.targetMarket}
    - Problem solved: ${businessModel.problemSolved}
    - Revenue model: ${businessModel.revenueModel}
    - Brand positioning: ${brandStrategy.positioning}
    - Content themes: ${JSON.stringify(brandStrategy.contentThemes)}
    
    MVP Requirements:
    - Must be launchable within 30 days
    - Should validate core value proposition
    - Address the specific domain-related needs
    - Include user acquisition mechanisms
    - Build trust and credibility from day one
    - Have clear success metrics
    
    Define:
    1. Core Features: 5-7 essential features that deliver value
    2. User Journey: Detailed step-by-step user flow
    3. Content Strategy: What content is needed for launch
    4. Technical Stack: Technology requirements
    5. Design Requirements: UI/UX needs
    6. Launch Timeline: 30-day roadmap
    7. Success Metrics: How to measure success
    8. User Acquisition: How to get first users
    9. Trust Building: How to establish credibility
    10. Monetization: How to start generating revenue
    
    IMPORTANT: Return ONLY a valid JSON object:
    {
      "coreFeatures": [
        {
          "name": "feature name",
          "description": "detailed description",
          "priority": "high/medium/low",
          "timeToImplement": "days"
        }
      ],
      "userJourney": {
        "discovery": "how users find the site",
        "landing": "what they see first",
        "engagement": "how they engage with content",
        "conversion": "how they become users/customers",
        "retention": "how they come back"
      },
      "contentStrategy": {
        "launchContent": ["content type 1", "content type 2"],
        "contentPillars": ["pillar 1", "pillar 2", "pillar 3"],
        "initialPages": ["page 1", "page 2", "page 3"]
      },
      "technicalStack": {
        "frontend": "technology choice",
        "backend": "backend needs",
        "database": "data storage",
        "hosting": "hosting solution",
        "analytics": "tracking tools",
        "integrations": ["integration 1", "integration 2"]
      },
      "designRequirements": {
        "pageTypes": ["page type 1", "page type 2"],
        "components": ["component 1", "component 2"],
        "responsiveNeeds": "mobile/tablet requirements",
        "brandAlignment": "how design reflects brand"
      },
      "launchTimeline": {
        "week1": ["task 1", "task 2"],
        "week2": ["task 1", "task 2"],
        "week3": ["task 1", "task 2"],
        "week4": ["task 1", "task 2"]
      },
      "successMetrics": {
        "traffic": "visitor targets",
        "engagement": "engagement metrics",
        "conversion": "conversion goals",
        "revenue": "revenue targets"
      },
      "userAcquisition": {
        "channels": ["channel 1", "channel 2"],
        "strategies": ["strategy 1", "strategy 2"],
        "budget": "acquisition budget"
      },
      "trustBuilding": ["credibility element 1", "credibility element 2"],
      "monetization": {
        "immediate": "quick revenue opportunities",
        "shortTerm": "30-60 day revenue plan",
        "longTerm": "3-6 month revenue plan"
      }
    }
    `;

    const response = await this.anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1500
    });

    return this.parseJSONResponse(response.content[0].text, 'MVP scope', {
      coreFeatures: [
        { name: 'Informational Hub', description: 'Comprehensive resource center', priority: 'high', timeToImplement: '5 days' },
        { name: 'Interactive Assessment', description: 'User evaluation tool', priority: 'high', timeToImplement: '7 days' },
        { name: 'Expert Insights', description: 'Professional analysis and guidance', priority: 'high', timeToImplement: '5 days' },
        { name: 'Community Features', description: 'User engagement and discussion', priority: 'medium', timeToImplement: '3 days' },
        { name: 'Resource Library', description: 'Curated tools and materials', priority: 'medium', timeToImplement: '4 days' }
      ],
      userJourney: {
        discovery: 'Search engines, social media, word of mouth',
        landing: 'Clear value proposition and immediate value',
        engagement: 'Interactive content and assessment tools',
        conversion: 'Email signup, assessment completion',
        retention: 'Regular content updates, personalized recommendations'
      },
      contentStrategy: {
        launchContent: ['expert articles', 'assessment tools', 'resource guides'],
        contentPillars: ['expert insights', 'practical guidance', 'real experiences'],
        initialPages: ['home', 'assessment', 'insights', 'resources', 'about']
      },
      technicalStack: {
        frontend: 'React.js for interactive features',
        backend: 'Node.js with Express',
        database: 'MongoDB for content and user data',
        hosting: 'Vercel or Netlify',
        analytics: 'Google Analytics, Hotjar',
        integrations: ['email service', 'payment processor']
      },
      designRequirements: {
        pageTypes: ['landing page', 'content pages', 'assessment interface'],
        components: ['navigation', 'content blocks', 'forms', 'interactive elements'],
        responsiveNeeds: 'Mobile-first, tablet optimization',
        brandAlignment: 'Professional, trustworthy, modern design'
      },
      launchTimeline: {
        week1: ['domain setup', 'basic site structure', 'content planning'],
        week2: ['core content creation', 'design implementation', 'basic functionality'],
        week3: ['assessment tool', 'user testing', 'content refinement'],
        week4: ['final testing', 'SEO optimization', 'launch preparation']
      },
      successMetrics: {
        traffic: '500+ unique visitors in first month',
        engagement: '3+ page views per session, 2+ minute average time',
        conversion: '15% email signup rate',
        revenue: 'First paid users within 60 days'
      },
      userAcquisition: {
        channels: ['SEO', 'content marketing', 'social media'],
        strategies: ['thought leadership', 'community engagement', 'expert positioning'],
        budget: '$500-1000 for initial marketing'
      },
      trustBuilding: ['expert credentials', 'user testimonials', 'transparent methodology'],
      monetization: {
        immediate: 'Email list building for future monetization',
        shortTerm: 'Premium content, consultation bookings',
        longTerm: 'Subscription model, course sales, consulting services'
      }
    });
  }

  async createImplementationPlan(strategy, tracker = null) {
    const prompt = `
    Create a detailed implementation plan for launching ${strategy.domain}.
    
    Business Model: ${JSON.stringify(strategy.businessModel)}
    Brand Strategy: ${JSON.stringify(strategy.brandStrategy)}
    MVP Scope: ${JSON.stringify(strategy.mvpPlan)}
    
    Define:
    1. Landing page requirements
      - Key sections and content
      - Calls to action
      - Forms and data collection
    2. Design specifications
      - Color palette
      - Typography
      - Layout structure
    3. Technical implementation
      - Frontend framework
      - Backend requirements
      - Third-party integrations
    4. Launch checklist
    5. Agent task assignments
    
    Format as structured JSON with specific, actionable items.
    `;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4.1-2025-04-14',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    });

    return this.parseJSONResponse(response.choices[0].message.content, 'implementation plan', {
      landingPage: {
        sections: ['hero', 'features', 'pricing', 'testimonials', 'cta'],
        design: { colorPalette: 'modern', layout: 'responsive' },
        content: { tone: 'professional', cta: 'Get Started' }
      },
      technical: {
        framework: 'vanilla HTML/CSS/JS',
        deployment: 'static hosting',
        integrations: ['contact form', 'analytics']
      },
      launchChecklist: ['content creation', 'design implementation', 'testing', 'deployment']
    });
  }

  parseJSONResponse(responseText, context, fallback) {
    try {
      // Remove any markdown formatting
      let cleanText = responseText.trim();
      
      // Remove markdown code blocks
      cleanText = cleanText.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '');
      
      // Try to find JSON object boundaries
      const jsonStart = cleanText.indexOf('{');
      const jsonEnd = cleanText.lastIndexOf('}') + 1;
      
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        const jsonStr = cleanText.substring(jsonStart, jsonEnd);
        return JSON.parse(jsonStr);
      }
      
      // If no braces found, try parsing the whole thing
      return JSON.parse(cleanText);
      
    } catch (parseError) {
      logger.error(`Failed to parse ${context} JSON:`, parseError);
      logger.error('Response text:', responseText.substring(0, 500) + '...');
      
      // Return fallback object
      return fallback;
    }
  }
}