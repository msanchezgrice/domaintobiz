import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function checkDatabase() {
  console.log('🔍 Checking Supabase database...\n');

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
        console.error(`❌ Error accessing ${table}:`, countError.message);
        continue;
      }
      
      console.log(`✅ ${table} exists - ${count || 0} records`);
      
      // Get latest record
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (data && data.length > 0) {
        console.log(`📝 Latest record created:`, data[0].created_at);
        console.log(`🔑 Record ID:`, data[0].id);
        
        // Show specific fields based on table
        if (table === 'domain_analyses' && data[0].best_domain) {
          console.log(`🌐 Best domain:`, data[0].best_domain);
        }
        if (table === 'generated_websites' && data[0].domain) {
          console.log(`🌐 Domain:`, data[0].domain);
          console.log(`📊 Status:`, data[0].status);
        }
      } else {
        console.log(`📭 No records found in ${table}`);
      }
      
    } catch (error) {
      console.error(`❌ Failed to query ${table}:`, error.message);
    }
    
    console.log('');
  }
  
  // Check for recent errors
  console.log('🔍 Checking for recent errors in execution_logs...');
  const { data: errors, error: errorQueryError } = await supabase
    .from('execution_logs')
    .select('*')
    .ilike('log_data', '%error%')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (errors && errors.length > 0) {
    console.log(`⚠️ Found ${errors.length} recent error logs:`);
    errors.forEach((log, i) => {
      console.log(`\nError ${i + 1}:`);
      console.log(`Time: ${log.created_at}`);
      console.log(`Session: ${log.session_id}`);
      console.log(`Data:`, JSON.stringify(log.log_data).substring(0, 200) + '...');
    });
  } else {
    console.log('✅ No recent error logs found');
  }
}

// Run the check
checkDatabase().catch(console.error);