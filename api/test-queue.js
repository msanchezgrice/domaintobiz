import { createClient } from '@supabase/supabase-js';

// Check for required environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables:', {
    SUPABASE_URL: !!supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY
  });
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Check environment variables first
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Missing Supabase environment variables',
        needed: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY'],
        available: {
          SUPABASE_URL: !!supabaseUrl,
          SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY
        }
      });
    }

    if (req.method === 'GET') {
      // Test reading from queue
      console.log('🔍 Testing queue read...');
      
      // First, let's see what pgmq functions are available
      try {
        const { data: functions } = await supabase
          .from('pg_proc')
          .select('proname')
          .like('proname', '%pgmq%')
          .limit(10);
        console.log('🔧 Available pgmq functions:', functions?.map(f => f.proname) || 'none found');
      } catch (funcError) {
        console.log('🔧 Could not query available functions');
      }
      
      // Try to read from pgmq queue using SQL directly
      let messages, readError;
      
      const directRead = await supabase
        .from('pgmq_site_jobs_queue')
        .select('*')
        .limit(5);
      
      messages = directRead.data;
      readError = directRead.error;

      if (readError) {
        console.log('❌ Direct table read failed, trying RPC...');
        // Try alternative RPC call
        const { data: rpcMessages, error: rpcError } = await supabase.rpc('pgmq.read', {
          queue_name: 'site_jobs_queue',
          vt: 30,
          qty: 5
        });
        
        if (rpcError) {
          throw new Error(`Queue read failed: ${rpcError.message}. Available functions might be different.`);
        }
        messages = rpcMessages;
      }

      // Get queue stats - try different approaches
      let stats = null;
      try {
        const { data: queueStats } = await supabase
          .from('pgmq_site_jobs_queue')
          .select('msg_id, enqueued_at, vt')
          .limit(1);
        stats = { messageCount: queueStats?.length || 0 };
      } catch (statsError) {
        console.log('Stats unavailable:', statsError.message);
      }

      return res.status(200).json({
        success: true,
        message: 'Queue test successful',
        data: {
          messages: messages || [],
          messageCount: (messages || []).length,
          stats: stats || null
        }
      });

    } else if (req.method === 'POST') {
      // Test enqueueing a job
      console.log('📋 Testing job enqueue...');
      
      const testDomain = 'test-domain.com';
      const testData = {
        domain: testDomain,
        test: true,
        timestamp: new Date().toISOString()
      };

      // Test enqueueing - check if our custom function exists
      const { data: result, error } = await supabase.rpc('enqueue_site_generation', {
        p_domain: testDomain,
        p_user_id: null,
        p_job_data: testData
      });

      if (error) {
        console.log('❌ Custom enqueue function failed:', error.message);
        
        // Try direct table insert as fallback
        const { data: directInsert, error: insertError } = await supabase
          .from('site_jobs')
          .insert({
            domain: testDomain,
            job_data: testData
          })
          .select()
          .single();
          
        if (insertError) {
          throw new Error(`Both enqueue methods failed. Custom: ${error.message}, Direct: ${insertError.message}`);
        }
        
        return res.status(200).json({
          success: true,
          message: 'Test job created via direct insert (pgmq functions unavailable)',
          data: {
            jobId: directInsert.id,
            domain: testDomain,
            method: 'direct_insert'
          }
        });
      }

      const jobInfo = result[0];
      console.log(`✅ Test job enqueued: ${jobInfo.job_id}`);

      return res.status(200).json({
        success: true,
        message: 'Test job enqueued successfully',
        data: {
          jobId: jobInfo.job_id,
          queueMsgId: jobInfo.queue_msg_id,
          domain: testDomain
        }
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('❌ Queue test failed:', error);
    
    return res.status(500).json({ 
      error: 'Queue test failed', 
      message: error.message,
      details: error.stack
    });
  }
} 