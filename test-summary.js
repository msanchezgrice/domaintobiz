#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runTests() {
  console.log('🧪 Running Test Suite...\n');
  
  const testGroups = [
    { name: 'Analyzers', pattern: 'tests/unit/analyzers/*.test.js' },
    { name: 'Agents', pattern: 'tests/unit/agents/*.test.js' },
    { name: 'Models', pattern: 'tests/unit/models/*.test.js' },
    { name: 'Utilities', pattern: 'tests/unit/utils/*.test.js' }
  ];
  
  let totalPassed = 0;
  let totalFailed = 0;
  
  for (const group of testGroups) {
    console.log(`\n📁 Testing ${group.name}...`);
    
    try {
      const { stdout, stderr } = await execAsync(
        `node --test ${group.pattern} 2>&1 | grep -E "(# pass|# fail|# tests)" | tail -3`,
        { timeout: 30000 }
      );
      
      const lines = stdout.trim().split('\n');
      const stats = {};
      
      lines.forEach(line => {
        const match = line.match(/# (\w+) (\d+)/);
        if (match) {
          stats[match[1]] = parseInt(match[2]);
        }
      });
      
      console.log(`  ✅ Passed: ${stats.pass || 0}`);
      console.log(`  ❌ Failed: ${stats.fail || 0}`);
      console.log(`  📊 Total: ${stats.tests || 0}`);
      
      totalPassed += stats.pass || 0;
      totalFailed += stats.fail || 0;
      
    } catch (error) {
      console.log(`  ⚠️  Error running tests: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📈 OVERALL TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Total Passed: ${totalPassed}`);
  console.log(`❌ Total Failed: ${totalFailed}`);
  console.log(`📊 Total Tests: ${totalPassed + totalFailed}`);
  console.log(`🎯 Success Rate: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1)}%`);
  console.log('='.repeat(50));
}

runTests().catch(console.error);