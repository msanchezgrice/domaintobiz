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
    // Validate request body exists
    if (!req.body) {
      console.error('❌ No request body provided');
      return res.status(400).json({ 
        error: 'Request body is required' 
      });
    }

    // Handle potential JSON parsing errors
    let parsedBody;
    try {
      parsedBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (parseError) {
      console.error('❌ JSON parsing error:', parseError);
      return res.status(400).json({ 
        error: 'Invalid JSON in request body',
        details: parseError.message 
      });
    }

    const { domain, strategy, executionId } = parsedBody;

    if (!domain || !strategy) {
      return res.status(400).json({ 
        error: 'Please provide domain and strategy data' 
      });
    }

    console.log(`🎨 Design Agent starting for ${domain}`);
    console.log(`📊 Business type: ${strategy.businessModel.type}`);
    console.log(`🎯 Brand personality: ${strategy.brandStrategy.brandPersonality}`);

    // Real AI design generation
    let designSystem;
    
    try {
      if (!process.env.OPENAI_API_KEY) {
        console.log('⚠️ No OpenAI API key - using mock design');
        designSystem = {
          status: 'completed',
          colorPalette: {
            primary: '#5730ec',
            secondary: '#8b5cf6',
            accent: '#a78bfa',
            background: '#ffffff',
            text: '#1a1a1a'
          },
          typography: {
            primary: 'Inter',
            secondary: 'Georgia',
            sizes: {
              h1: '3.5rem',
              h2: '2.5rem',
              h3: '1.75rem',
              body: '1rem'
            }
          },
          layout: 'modern-minimal',
          components: ['hero', 'features', 'cta', 'testimonials']
        };
      } else {
        console.log('🤖 Calling OpenAI for design generation...');
        
        const { OpenAI } = await import('openai');
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY
        });

        const prompt = `
You are an expert UI/UX designer. Create a comprehensive design system for:

Domain: ${domain}
Business Type: ${strategy.businessModel.type}
Target Audience: ${strategy.brandStrategy.targetAudience}
Brand Personality: ${strategy.brandStrategy.brandPersonality}
Brand Positioning: ${strategy.brandStrategy.positioning}

Create a design system that perfectly aligns with the brand strategy.

Return ONLY a valid JSON object with this structure:
{
  "colorPalette": {
    "primary": "#hexcolor",
    "secondary": "#hexcolor",
    "accent": "#hexcolor",
    "background": "#hexcolor",
    "text": "#hexcolor",
    "success": "#hexcolor",
    "error": "#hexcolor"
  },
  "typography": {
    "primary": "font name",
    "secondary": "font name",
    "sizes": {
      "h1": "size with unit",
      "h2": "size with unit",
      "h3": "size with unit",
      "body": "size with unit",
      "small": "size with unit"
    }
  },
  "layout": "modern-minimal|corporate|playful|elegant|tech-focused",
  "spacing": {
    "unit": "8px",
    "small": "8px",
    "medium": "16px",
    "large": "32px",
    "xlarge": "64px"
  },
  "components": ["component1", "component2", "component3"],
  "designPrinciples": ["principle1", "principle2", "principle3"]
}`;

        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a world-class UI/UX designer. Always respond with valid JSON only."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 1000
        });

        const responseText = completion.choices[0].message.content;
        console.log('📥 Design AI response received');
        
        // Parse JSON response - handle markdown formatting
        try {
          // Clean the response text
          let cleanedResponse = responseText.trim();
          
          // Remove markdown code blocks if present
          if (cleanedResponse.startsWith('```json')) {
            cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          } else if (cleanedResponse.startsWith('```')) {
            cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
          }
          
          designSystem = JSON.parse(cleanedResponse);
          designSystem.status = 'completed';
          console.log('✅ Successfully parsed design system');
        } catch (parseError) {
          console.error('❌ Failed to parse design response:', parseError);
          console.log('🔍 Raw response:', responseText);
          
          // Try to extract JSON from response
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              designSystem = JSON.parse(jsonMatch[0]);
              designSystem.status = 'completed';
              console.log('✅ Successfully extracted JSON from response');
            } catch (extractError) {
              console.error('❌ Failed to parse extracted JSON:', extractError);
              throw parseError;
            }
          } else {
            throw parseError;
          }
        }
      }
    } catch (error) {
      console.error('❌ Error generating design:', error);
      designSystem = {
        status: 'error',
        error: error.message,
        fallback: true
      };
    }

    console.log('🎨 Design generation completed');

    return res.status(200).json({
      success: true,
      agent: 'design',
      data: designSystem,
      executionId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Design agent failed:', error);
    return res.status(500).json({ 
      error: 'Design agent failed', 
      message: error.message
    });
  }
}