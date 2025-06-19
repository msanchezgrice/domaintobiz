export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const envCheck = {
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY,
      hasOpenAI: !!process.env.OPENAI_API_KEY,
      hasAnthropic: !!process.env.ANTHROPIC_API_KEY,
      nodeEnv: process.env.NODE_ENV,
      supabaseUrlPartial: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.substring(0, 30) + '...' : null
    };

    // Test database connection
    let dbTest = { connected: false, error: null };
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY
      );
      
      const { data, error } = await supabase
        .from('domain_analyses')
        .select('count')
        .limit(1);
      
      if (error) {
        dbTest.error = error;
      } else {
        dbTest.connected = true;
      }
    } catch (error) {
      dbTest.error = error.message;
    }

    return res.status(200).json({
      success: true,
      message: 'API is working',
      timestamp: new Date().toISOString(),
      environment: envCheck,
      database: dbTest
    });

  } catch (error) {
    console.error('Test endpoint error:', error);
    return res.status(500).json({ 
      error: 'Test failed', 
      message: error.message
    });
  }
}