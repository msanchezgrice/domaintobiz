import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
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
    if (req.method === 'GET') {
      console.log('🔍 Testing basic database access...');

      // Test 1: Can we read from site_jobs table?
      const { data: jobs, error: jobsError } = await supabase
        .from('site_jobs')
        .select('*')
        .limit(5);

      console.log('📋 site_jobs query:', { jobs, error: jobsError?.message });

      // Test 2: Can we read from users table?
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('*')
        .limit(5);

      console.log('👥 users query:', { users, error: usersError?.message });

      // Test 3: Can we call our custom function?
      let customFunctionResult = null;
      try {
        const { data: customResult, error: customError } = await supabase.rpc('enqueue_site_generation', {
          p_domain: 'test.com',
          p_user_id: null,
          p_job_data: { test: true }
        });
        
        customFunctionResult = { 
          success: !customError, 
          data: customResult, 
          error: customError?.message 
        };
        console.log('🔧 Custom function test:', customFunctionResult);
      } catch (funcError) {
        customFunctionResult = { 
          success: false, 
          error: funcError.message 
        };
      }

      return res.status(200).json({
        success: true,
        message: 'Database connectivity test',
        tests: {
          site_jobs_table: {
            success: !jobsError,
            count: jobs?.length || 0,
            error: jobsError?.message
          },
          users_table: {
            success: !usersError,
            count: users?.length || 0,
            error: usersError?.message
          },
          custom_function: customFunctionResult
        },
        environment: {
          hasSupabaseUrl: !!process.env.SUPABASE_URL,
          hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          hasAnonKey: !!process.env.SUPABASE_ANON_KEY
        }
      });

    } else if (req.method === 'POST') {
      console.log('📋 Testing job creation...');

      const testDomain = `test-${Date.now()}.com`;
      const testData = {
        domain: testDomain,
        test: true,
        timestamp: new Date().toISOString()
      };

      // Test direct table insert
      const { data: directInsert, error: insertError } = await supabase
        .from('site_jobs')
        .insert({
          domain: testDomain,
          job_data: testData
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Direct insert failed: ${insertError.message}`);
      }

      console.log(`✅ Job created via direct insert: ${directInsert.id}`);

      return res.status(200).json({
        success: true,
        message: 'Test job created successfully',
        data: {
          jobId: directInsert.id,
          domain: testDomain,
          method: 'direct_insert',
          created_at: directInsert.created_at
        }
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('❌ Test failed:', error);
    
    return res.status(500).json({ 
      error: 'Test failed', 
      message: error.message,
      details: error.stack
    });
  }
} 