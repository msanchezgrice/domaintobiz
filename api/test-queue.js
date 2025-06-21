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
      
      const { data: messages, error: readError } = await supabase.rpc('pgmq_read', {
        queue_name: 'site_jobs_queue',
        vt: 30,
        qty: 5
      });

      if (readError) {
        throw new Error(`Queue read failed: ${readError.message}`);
      }

      // Get queue stats
      const { data: stats, error: statsError } = await supabase.rpc('pgmq_metrics', {
        queue_name: 'site_jobs_queue'
      });

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

      const { data: result, error } = await supabase.rpc('enqueue_site_generation', {
        p_domain: testDomain,
        p_user_id: null,
        p_job_data: testData
      });

      if (error) {
        throw new Error(`Enqueue failed: ${error.message}`);
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