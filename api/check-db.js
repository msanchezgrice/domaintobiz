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

  try {
    console.log('🔍 Checking Supabase database...\n');
    
    const report = {
      timestamp: new Date().toISOString(),
      tables: {},
      recentErrors: [],
      summary: {}
    };

    // Check if environment variables are set
    report.envVarsSet = {
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY
    };

    // Check if tables exist
    const tables = ['domain_analyses', 'business_strategies', 'generated_websites', 'execution_logs'];
    
    for (const table of tables) {
      console.log(`📊 Checking table: ${table}`);
      
      try {
        // Get count and recent records
        const { count, error: countError } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (countError) {
          report.tables[table] = {
            exists: false,
            error: countError.message
          };
          continue;
        }
        
        // Get latest records
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .order('created_at', { ascending: false })
          .limit(3);
        
        report.tables[table] = {
          exists: true,
          count: count || 0,
          latestRecords: data || [],
          hasData: data && data.length > 0
        };
        
        // Get sample of domains for domain_analyses
        if (table === 'domain_analyses' && data && data.length > 0) {
          report.tables[table].sampleDomains = data.map(d => ({
            id: d.id,
            domains: d.domains,
            best_domain: d.best_domain,
            created_at: d.created_at
          }));
        }
        
      } catch (error) {
        report.tables[table] = {
          exists: false,
          error: error.message
        };
      }
    }
    
    // Check for recent errors
    try {
      const { data: errors } = await supabase
        .from('execution_logs')
        .select('*')
        .ilike('log_data', '%error%')
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (errors && errors.length > 0) {
        report.recentErrors = errors.map(e => ({
          created_at: e.created_at,
          session_id: e.session_id,
          log_data: JSON.stringify(e.log_data).substring(0, 200) + '...'
        }));
      }
    } catch (error) {
      console.log('Could not check error logs:', error.message);
    }
    
    // Summary
    report.summary = {
      totalTables: Object.keys(report.tables).length,
      existingTables: Object.values(report.tables).filter(t => t.exists).length,
      tablesWithData: Object.values(report.tables).filter(t => t.hasData).length,
      totalRecords: Object.values(report.tables).reduce((sum, t) => sum + (t.count || 0), 0),
      hasRecentErrors: report.recentErrors.length > 0
    };

    return res.status(200).json({
      success: true,
      report,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Database check failed:', error);
    return res.status(500).json({ 
      error: 'Database check failed', 
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}