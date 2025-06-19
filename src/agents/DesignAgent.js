import OpenAI from 'openai';
import { logger } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

export class DesignAgent {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async execute(taskData, tracker = null) {
    logger.info(`Design Agent executing for ${taskData.strategy.domain}`);
    
    if (tracker) {
      tracker.addAgentLog('design', 'Starting design system generation', {
        domain: taskData.strategy.domain,
        domainMeaning: taskData.strategy.businessModel?.domainMeaning,
        businessConcept: taskData.strategy.businessModel?.businessConcept,
        brandValues: taskData.strategy.brandStrategy?.values || []
      });
    }
    
    const designSpec = taskData.task;
    const business = taskData.strategy.businessModel;
    const brand = taskData.strategy.brandStrategy;
    const mvp = taskData.strategy.mvpPlan;
    
    if (tracker) {
      tracker.addAgentLog('design', 'Generating color palette and typography', {
        brandPersonality: brand?.personality || [],
        positioning: brand?.positioning || 'modern business'
      });
    }
    
    const design = await this.generateDesignSystem(business, brand, mvp, designSpec);
    
    if (tracker) {
      tracker.addAgentLog('design', 'Creating wireframes for all sections', {
        colorPalette: design.colors,
        primaryFont: design.typography?.primary?.family
      });
    }
    
    const wireframes = await this.generateWireframes(design, designSpec);
    
    if (tracker) {
      tracker.addAgentLog('design', 'Generating CSS and design assets', {
        sectionsDesigned: Object.keys(wireframes).length,
        responsiveBreakpoints: 3
      });
    }
    
    const assets = await this.generateAssets(design);
    
    const outputDir = path.join('output', taskData.executionId || 'temp', 'design');
    await fs.mkdir(outputDir, { recursive: true });
    
    await fs.writeFile(
      path.join(outputDir, 'design-system.json'),
      JSON.stringify(design, null, 2)
    );
    
    await fs.writeFile(
      path.join(outputDir, 'wireframes.json'),
      JSON.stringify(wireframes, null, 2)
    );
    
    if (tracker) {
      tracker.addAgentLog('design', 'Design system completed successfully', {
        cssLinesGenerated: assets.css.split('\n').length,
        iconsIncluded: assets.icons.length,
        outputFiles: 2
      });
    }
    
    return {
      designSystem: design,
      wireframes,
      assets,
      outputPath: outputDir
    };
  }

  async generateDesignSystem(business, brand, mvp, spec) {
    const prompt = `
    You are a UI/UX designer. Create a comprehensive design system for ${business?.domainMeaning || 'this business'}.
    
    BUSINESS CONTEXT:
    - Domain meaning: ${business?.domainMeaning}
    - Business concept: ${business?.businessConcept}
    - Target audience: ${business?.targetMarket}
    - Industry: ${business?.industry}
    - Problem solved: ${business?.problemSolved}
    
    BRAND CONTEXT:
    - Positioning: ${brand?.positioning}
    - Values: ${JSON.stringify(brand?.values)}
    - Personality: ${JSON.stringify(brand?.personality)}
    - Visual identity: ${JSON.stringify(brand?.visualIdentity)}
    - Tone: ${brand?.toneOfVoice?.description}
    
    MVP CONTEXT:
    - Core features: ${JSON.stringify(mvp?.coreFeatures)}
    - Design requirements: ${JSON.stringify(mvp?.designRequirements)}
    - Target audience needs: ${mvp?.userJourney?.engagement}
    
    Create a design system that:
    1. Reflects the domain meaning and business purpose
    2. Appeals to the specific target audience
    3. Builds trust and credibility for this industry
    4. Supports the core features and user journey
    5. Aligns with brand personality and values
    
    Generate a complete design system with:
    1. Color Palette: Primary, secondary, accent, success, warning, error, neutrals (with specific hex values)
    2. Typography: Font families, sizes, line heights, weights for headings, body, UI elements
    3. Spacing System: 8px grid-based spacing scale
    4. Component Styles: Buttons, forms, cards, navigation, etc.
    5. Layout: Grid system, breakpoints, container widths
    6. Visual Elements: Border radius, shadows, iconography direction
    7. Interactive States: Hover, focus, active, disabled states
    8. Brand Applications: How brand elements translate to UI
    
    Return as detailed JSON with specific values, measurements, and implementation notes.
    `;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content);
  }

  async generateWireframes(design, spec) {
    const sections = spec.sections || [
      'hero',
      'features',
      'pricing',
      'testimonials',
      'cta',
      'footer'
    ];

    const wireframes = {};
    
    for (const section of sections) {
      wireframes[section] = await this.generateSectionWireframe(section, design);
    }

    return wireframes;
  }

  async generateSectionWireframe(section, design) {
    const prompt = `
    Create a detailed wireframe specification for a "${section}" section.
    
    Design System: ${JSON.stringify(design)}
    
    Provide:
    1. Layout structure (flex/grid specifications)
    2. Content blocks with dimensions
    3. Typography assignments
    4. Spacing values
    5. Interactive elements
    6. Mobile responsive behavior
    
    Return as structured JSON.
    `;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content);
  }

  async generateAssets(design) {
    const assets = {
      css: this.generateCSS(design),
      icons: this.getIconSet(design),
      placeholders: this.generatePlaceholders()
    };

    return assets;
  }

  generateCSS(design) {
    const colors = design.colors || {
      primary: '#6366f1',
      secondary: '#8b5cf6',
      accent: '#ec4899',
      background: '#ffffff',
      text: '#1f2937',
      textSecondary: '#6b7280'
    };
    
    const typography = design.typography || {
      primary: { family: 'Inter, sans-serif' },
      secondary: { family: 'Inter, sans-serif' },
      sizes: {
        base: '16px',
        h1: '3rem',
        h2: '2.25rem',
        h3: '1.5rem'
      }
    };
    
    const spacing = design.spacing || {
      xs: '0.5rem',
      sm: '1rem',
      md: '1.5rem',
      lg: '2rem',
      xl: '4rem'
    };
    
    return `
:root {
  /* Colors */
  --color-primary: ${colors.primary};
  --color-secondary: ${colors.secondary};
  --color-accent: ${colors.accent};
  --color-background: ${colors.background};
  --color-text: ${colors.text};
  --color-text-secondary: ${colors.textSecondary};
  
  /* Typography */
  --font-primary: ${typography.primary?.family || 'Inter, sans-serif'};
  --font-secondary: ${typography.secondary?.family || 'Inter, sans-serif'};
  --font-size-base: ${typography.sizes?.base || '16px'};
  --font-size-h1: ${typography.sizes?.h1 || '3rem'};
  --font-size-h2: ${typography.sizes?.h2 || '2.25rem'};
  --font-size-h3: ${typography.sizes?.h3 || '1.5rem'};
  
  /* Spacing */
  --space-xs: ${spacing.xs || '0.5rem'};
  --space-sm: ${spacing.sm || '1rem'};
  --space-md: ${spacing.md || '1.5rem'};
  --space-lg: ${spacing.lg || '2rem'};
  --space-xl: ${spacing.xl || '4rem'};
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
  
  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 16px;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-primary);
  font-size: var(--font-size-base);
  color: var(--color-text);
  background-color: var(--color-background);
  line-height: 1.6;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 var(--space-md);
}

.btn {
  display: inline-block;
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  font-weight: 600;
  text-decoration: none;
  transition: all 0.3s ease;
  cursor: pointer;
  border: none;
}

.btn-primary {
  background-color: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  background-color: color-mix(in srgb, var(--color-primary) 85%, black);
}

.btn-secondary {
  background-color: var(--color-secondary);
  color: white;
}

.card {
  background-color: white;
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  box-shadow: var(--shadow-md);
}
    `.trim();
  }

  getIconSet() {
    return [
      'check-circle',
      'arrow-right',
      'star',
      'users',
      'chart-line',
      'shield-check',
      'rocket',
      'globe'
    ];
  }

  generatePlaceholders() {
    return {
      hero: 'https://via.placeholder.com/1200x600',
      feature: 'https://via.placeholder.com/400x300',
      testimonial: 'https://via.placeholder.com/100x100',
      logo: 'https://via.placeholder.com/200x50'
    };
  }
}