import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Lazy load OpenAI to handle missing dependency gracefully
let openai = null;
let OpenAI = null;

async function getOpenAI() {
  if (!openai && process.env.OPENAI_API_KEY) {
    try {
      if (!OpenAI) {
        OpenAI = (await import('openai')).default;
      }
      openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    } catch (error) {
      console.error('❌ Failed to load OpenAI:', error);
      return null;
    }
  }
  return openai;
}

async function analyzeDomainWithLLM(domains) {
  const openaiClient = await getOpenAI();
  
  if (!openaiClient) {
    console.log('⚠️ OpenAI not available, using basic analysis');
    return null;
  }

  // Skip AI analysis for large batches to avoid timeout
  if (domains.length > 10) {
    console.log(`⚠️ Skipping AI analysis for ${domains.length} domains (too many for timeout limits)`);
    return null;
  }

  try {
    console.log('🤖 Using AI to analyze domains:', domains);
    
    // Shorter, more focused prompt to reduce processing time
    const prompt = `Analyze these domains for business potential. Score each 0-100 and identify the best one.

Domains: ${domains.join(', ')}

Consider: brandability, SEO potential, market appeal. Return JSON only:

{
  "rankings": [
    {"domain": "example.com", "overallScore": 85, "brandability": 90, "seoValue": 80, "marketAppeal": 88, "strengths": ["Short"], "reasoning": "Brief analysis"}
  ],
  "bestDomain": "example.com"
}`;

    // Use faster model and shorter timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await openaiClient.chat.completions.create({
        model: "gpt-3.5-turbo", // Faster than GPT-4
        messages: [
          {
            role: "system",
            content: "You are a domain analyst. Always return valid JSON only, no other text."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3, // Lower temperature for faster, more consistent responses
        max_tokens: 1000 // Reduced token limit
      }, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      const content = response.choices[0].message.content.trim();
      console.log('🤖 AI analysis response received');
      
      // Clean up response - remove any markdown formatting
      const jsonContent = content.replace(/```json\n?|\n?```/g, '').trim();
      
      try {
        return JSON.parse(jsonContent);
      } catch (parseError) {
        console.error('❌ Failed to parse AI response:', parseError);
        console.log('Raw response:', content);
        return null;
      }
    } catch (requestError) {
      clearTimeout(timeoutId);
      throw requestError;
    }
    
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('❌ AI analysis timed out');
    } else {
      console.error('❌ AI analysis failed:', error);
    }
    return null;
  }
}

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

    // Check if environment variables are set
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      return res.status(500).json({ 
        error: 'Server configuration error: Missing database credentials' 
      });
    }
    
    const { domains, trackProgress } = parsedBody;

    if (!domains || !Array.isArray(domains) || domains.length === 0) {
      return res.status(400).json({ 
        error: 'Please provide an array of domains to analyze' 
      });
    }

    // Limit domain count to prevent timeouts
    if (domains.length > 20) {
      return res.status(400).json({
        error: 'Too many domains to analyze at once. Please limit to 20 domains maximum.',
        maxAllowed: 20,
        provided: domains.length
      });
    }

    console.log(`🔍 Analyzing ${domains.length} domains:`, domains);

    // Get AI-powered analysis first (only for smaller batches)
    const aiAnalysis = await analyzeDomainWithLLM(domains);

    // Proper domain analysis implementation
    const analysisResults = [];
    
    for (const domain of domains) {
      console.log(`📊 Analyzing domain: ${domain}`);
      
      try {
        // Basic domain validation
        const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
        const isValidDomain = domainRegex.test(domain);
        
        // Simple website check
        let hasWebsite = false;
        let statusCode = null;
        let title = '';
        
        try {
          console.log(`🌐 Checking website for ${domain}`);
          const response = await fetch(`https://${domain}`, {
            method: 'HEAD',
            headers: { 'User-Agent': 'DomainAnalyzer/1.0' },
            signal: AbortSignal.timeout(5000)
          });
          hasWebsite = response.ok;
          statusCode = response.status;
          console.log(`✅ Website check for ${domain}: ${statusCode}`);
        } catch (error) {
          console.log(`❌ Website check failed for ${domain}:`, error.message);
        }
        
        // Use AI analysis if available, otherwise fall back to basic scoring
        let score = 0;
        let aiDomainData = null;
        
        if (aiAnalysis && aiAnalysis.rankings) {
          aiDomainData = aiAnalysis.rankings.find(r => r.domain === domain);
          if (aiDomainData) {
            score = aiDomainData.overallScore;
            console.log(`🤖 Using AI score for ${domain}: ${score}`);
          }
        }
        
        // Fallback to basic scoring if no AI analysis
        if (!aiDomainData) {
          console.log(`📊 Using basic scoring for ${domain}`);
          if (isValidDomain) score += 30;
          if (!hasWebsite) score += 40; // Available domain is good
          if (domain.length <= 12) score += 20; // Shorter is better
          if (!domain.includes('-')) score += 10; // No hyphens is better
          
          // Additional scoring factors
          const extension = domain.split('.').pop().toLowerCase();
          if (extension === 'com') score += 15; // .com is premium
          if (extension === 'io') score += 10; // .io is tech-friendly
          if (extension === 'ai') score += 8; // .ai is trendy
          
          // Check for common words that make domains valuable
          const domainName = domain.split('.')[0].toLowerCase();
          const valuableKeywords = ['app', 'tech', 'ai', 'data', 'cloud', 'digital', 'smart', 'auto', 'pro', 'hub'];
          if (valuableKeywords.some(keyword => domainName.includes(keyword))) {
            score += 15;
          }
          
          // Penalize very long domains
          if (domain.length > 15) score -= 10;
          if (domain.length > 20) score -= 20;
        }
        
        const domainAnalysis = {
          domain,
          score,
          isValid: isValidDomain,
          hasWebsite,
          statusCode,
          title,
          metrics: {
            length: domain.length,
            hasHyphens: domain.includes('-'),
            extension: domain.split('.').pop(),
            availability: !hasWebsite ? 'likely available' : 'taken'
          },
          // Use AI breakdown if available, otherwise generate basic breakdown
          breakdown: aiDomainData ? {
            memorability: aiDomainData.brandability || 70,
            brandability: aiDomainData.brandability || 70,
            seoValue: aiDomainData.seoValue || 65,
            marketPotential: aiDomainData.marketAppeal || 68
          } : {
            memorability: Math.min(100, Math.max(20, 
              (domain.length <= 8 ? 80 : 50) + 
              (!domain.includes('-') ? 15 : 0) + 
              (Math.random() * 20 - 10)
            )),
            brandability: Math.min(100, Math.max(15,
              (domain.match(/[aeiou]/g)?.length || 0) * 8 + // Vowels make it more brandable
              (domain.length <= 10 ? 60 : 30) +
              (domain.split('.').pop() === 'com' ? 20 : 5) +
              (Math.random() * 25 - 12)
            )),
            seoValue: Math.min(100, Math.max(10,
              (!hasWebsite ? 70 : 20) + 
              (domain.split('.').pop() === 'com' ? 25 : 10) +
              (Math.random() * 30 - 15)
            )),
            marketPotential: Math.min(100, Math.max(25,
              score * 0.7 + 
              (!hasWebsite ? 20 : 5) +
              (Math.random() * 35 - 17)
            ))
          },
          // Add AI insights if available
          ...(aiDomainData && {
            aiInsights: {
              strengths: aiDomainData.strengths || [],
              weaknesses: aiDomainData.weaknesses || [],
              businessSuggestions: aiDomainData.businessSuggestions || [],
              reasoning: aiDomainData.reasoning || '',
              detailedScores: {
                brandability: aiDomainData.brandability,
                seoValue: aiDomainData.seoValue,
                marketAppeal: aiDomainData.marketAppeal,
                versatility: aiDomainData.versatility,
                globalAppeal: aiDomainData.globalAppeal,
                commercialValue: aiDomainData.commercialValue
              }
            }
          }),
          timestamp: new Date().toISOString()
        };
        
        analysisResults.push(domainAnalysis);
        console.log(`✅ Analysis complete for ${domain}:`, { score, isValid: isValidDomain, hasWebsite });
        
      } catch (error) {
        console.error(`❌ Error analyzing ${domain}:`, error);
        analysisResults.push({
          domain,
          score: 0,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Find best domain
    const bestDomain = analysisResults
      .filter(d => !d.error)
      .sort((a, b) => b.score - a.score)[0];
    
    const analysis = {
      domains: analysisResults,
      bestDomain: bestDomain || { domain: domains[0], error: 'No valid domains found' }, // Return full object
      bestDomainData: bestDomain,
      summary: {
        totalDomains: domains.length,
        validDomains: analysisResults.filter(d => d.isValid).length,
        availableDomains: analysisResults.filter(d => !d.hasWebsite).length,
        bestScore: bestDomain?.score || 0
      },
      timestamp: new Date().toISOString()
    };
    
    console.log(`🎯 Analysis complete. Best domain: ${analysis.bestDomain.domain} (score: ${bestDomain?.score || 0})`);

    // Generate a unique ID for this analysis
    const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Try to store in database (but don't fail if it doesn't work)
    let savedAnalysis = null;
    try {
      const { data, error: dbError } = await supabase
        .from('domain_analyses')
        .insert({
          domains,
          analysis_result: analysis,
          best_domain: analysis.bestDomain
        })
        .select()
        .single();

      if (dbError) {
        console.error('❌ Database error details:', {
          error: dbError,
          message: dbError.message,
          details: dbError.details,
          hint: dbError.hint,
          code: dbError.code
        });
        console.log('📝 Continuing without database - using generated ID:', analysisId);
      } else {
        savedAnalysis = data;
        console.log('✅ Successfully saved to database with ID:', savedAnalysis?.id);
      }
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      console.log('📝 Continuing without database - using generated ID:', analysisId);
    }

    console.log('Analysis completed successfully');

    return res.status(200).json({
      success: true,
      analysis: analysis, // Keep this for frontend compatibility
      data: analysis,
      id: savedAnalysis?.id || analysisId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Analysis failed:', error);
    
    // Ensure we always return valid JSON
    const errorResponse = {
      success: false,
      error: 'Analysis failed',
      message: error.message || 'Unknown error occurred',
      timestamp: new Date().toISOString()
    };

    // Add stack trace only in development
    if (process.env.NODE_ENV === 'development') {
      errorResponse.stack = error.stack;
    }

    return res.status(500).json(errorResponse);
  }
}