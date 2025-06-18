import { DomainAnalyzer } from '../src/analyzers/DomainAnalyzer.js';
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
    const { domains, trackProgress } = req.body;

    if (!domains || !Array.isArray(domains) || domains.length === 0) {
      return res.status(400).json({ 
        error: 'Please provide an array of domains to analyze' 
      });
    }

    console.log(`Analyzing ${domains.length} domains:`, domains);

    // Initialize domain analyzer
    const domainAnalyzer = new DomainAnalyzer();
    
    // Perform analysis
    const analysis = await domainAnalyzer.analyzeDomains(domains);

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
      console.error('Database error:', dbError);
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