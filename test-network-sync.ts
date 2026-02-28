#!/usr/bin/env node

/**
 * Test script for LinkedIn network sync functionality
 * This script tests the syncLinkedInNetwork function directly
 */

import { syncLinkedInNetwork } from './lib/linkedin-network-sync';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Mock cookies for testing (replace with real ones for actual testing)
const mockCookies = {
  li_at: 'your_li_at_cookie_here',
  JSESSIONID: 'your_jsessionid_here',
  bcookie: 'your_bcookie_here',
  bscookie: 'your_bscookie_here',
  lidc: 'your_lidc_here'
};

const mockLinkedInAccountId = 'your_linkedin_account_id_here';
const mockUserId = 'your_user_id_here';

async function testNetworkSync() {
  console.log('🧪 Testing LinkedIn Network Sync...');

  // Check if we have valid credentials
  if (mockCookies.li_at === 'your_li_at_cookie_here' || 
      mockLinkedInAccountId === 'your_linkedin_account_id_here') {
    console.log('⚠️  Integration test skipped: No valid LinkedIn credentials provided.');
    console.log('   This is expected in development. To run this test:');
    console.log('   1. Update mockCookies in test-network-sync.ts with real LinkedIn cookies');
    console.log('   2. Update mockLinkedInAccountId and mockUserId with real values');
    console.log('   3. Ensure .env.local has valid Supabase credentials');
    console.log('✅ Test skipped successfully (no credentials)');
    process.exit(0);
  }

  try {
    const results = await syncLinkedInNetwork(
      mockCookies,
      mockLinkedInAccountId,
      mockUserId,
      'full'
    );

    console.log('✅ Sync test completed successfully!');
    console.log('Results:', results);

    // Validate results
    if (results.total_connections_synced > 0) {
      console.log(`✅ Successfully synced ${results.total_connections_synced} connections`);
    } else {
      console.log('⚠️ No connections were synced. Check your cookies and account setup.');
    }

  } catch (error: any) {
    console.error('❌ Sync test failed:', error?.message || error);
    process.exit(1);
  }
}

// Only run if this script is called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testNetworkSync();
}