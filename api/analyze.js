import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

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
    // Check if environment variables are set
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      return res.status(500).json({ 
        error: 'Server configuration error: Missing database credentials' 
      });
    }
    const { domains, trackProgress } = req.body;

    if (!domains || !Array.isArray(domains) || domains.length === 0) {
      return res.status(400).json({ 
        error: 'Please provide an array of domains to analyze' 
      });
    }

    console.log(`🔍 Analyzing ${domains.length} domains:`, domains);

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
        
        // Calculate domain score based on multiple factors
        let score = 0;
        if (isValidDomain) score += 30;
        if (!hasWebsite) score += 40; // Available domain is good
        if (domain.length <= 12) score += 20; // Shorter is better
        if (!domain.includes('-')) score += 10; // No hyphens is better
        
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
      bestDomain: bestDomain?.domain || domains[0],
      bestDomainData: bestDomain,
      summary: {
        totalDomains: domains.length,
        validDomains: analysisResults.filter(d => d.isValid).length,
        availableDomains: analysisResults.filter(d => !d.hasWebsite).length,
        bestScore: bestDomain?.score || 0
      },
      timestamp: new Date().toISOString()
    };
    
    console.log(`🎯 Analysis complete. Best domain: ${analysis.bestDomain} (score: ${bestDomain?.score || 0})`);;

    // Store in database
    const { data: savedAnalysis, error: dbError } = await supabase
      .from('domain_analyses')
      .insert({
        domains,
        analysis_result: analysis
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
    } else {
      console.log('✅ Successfully saved to database with ID:', savedAnalysis?.id);
    }

    console.log('Analysis completed successfully');

    return res.status(200).json({
      success: true,
      data: analysis,
      id: savedAnalysis?.id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Analysis failed:', error);
    return res.status(500).json({ 
      error: 'Analysis failed', 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}