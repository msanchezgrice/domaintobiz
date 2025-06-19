#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync } from 'fs';

console.log('🔍 Validating Domain to Biz deployment...');

const tests = [
  {
    name: 'Main site accessibility',
    test: async () => {
      const response = await fetch('https://domaintobiz.vercel.app/');
      return response.ok;
    }
  },
  {
    name: 'Analyze API endpoint',
    test: async () => {
      const response = await fetch('https://domaintobiz.vercel.app/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domains: ['test.com'] })
      });
      return response.ok;
    }
  },
  {
    name: 'Projects API endpoint',
    test: async () => {
      const response = await fetch('https://domaintobiz.vercel.app/api/projects');
      return response.ok;
    }
  },
  {
    name: 'Progress status API endpoint',
    test: async () => {
      const response = await fetch('https://domaintobiz.vercel.app/api/progress-status?sessionId=test');
      return response.ok;
    }
  },
  {
    name: 'Domain analysis flow',
    test: async () => {
      console.log('  📊 Testing domain analysis...');
      const response = await fetch('https://domaintobiz.vercel.app/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domains: ['testdomain.com'] })
      });
      
      if (!response.ok) return false;
      
      const data = await response.json();
      return data.success && data.data.bestDomain;
    }
  },
  {
    name: 'Website generation flow',
    test: async () => {
      console.log('  🌐 Testing website generation...');
      const response = await fetch('https://domaintobiz.vercel.app/api/generate-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: 'testdomain.com',
          strategy: {
            businessModel: { type: 'SaaS' },
            brandStrategy: { positioning: 'Test' },
            mvpScope: { features: ['Test'] }
          },
          executionId: 'test_' + Date.now()
        })
      });
      
      if (!response.ok) return false;
      
      const data = await response.json();
      return data.success && data.data.deploymentUrl;
    }
  }
];

async function runValidation() {
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(`\n🧪 Testing: ${test.name}`);
      const result = await test.test();
      
      if (result) {
        console.log(`✅ ${test.name} - PASSED`);
        passed++;
      } else {
        console.log(`❌ ${test.name} - FAILED`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${test.name} - ERROR: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Validation Results:`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / tests.length) * 100)}%`);

  if (failed === 0) {
    console.log(`\n🎉 All tests passed! Deployment is working correctly.`);
    process.exit(0);
  } else {
    console.log(`\n⚠️  Some tests failed. Please check the issues above.`);
    process.exit(1);
  }
}

// Run validation
runValidation().catch(error => {
  console.error('❌ Validation script failed:', error);
  process.exit(1);
});