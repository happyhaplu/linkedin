const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.+)$/);
  if (match) {
    env[match[1]] = match[2];
  }
});

const supabase = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://reach:reach@localhost:5432/reach' })
(async () => {
  console.log('🔧 Checking network_connections schema...\n');
  
  // Check if column exists
  const { data, error } = await supabase
    .from('network_connections')
    .select('connection_profile_id')
    .limit(1);
    
  if (!error) {
    console.log('✅ Column connection_profile_id already exists!');
    console.log('✅ Your database is ready. Just restart your dev server.');
    return;
  }
  
  // Column is missing (any error means it doesn't exist)
  console.log('❌ Column connection_profile_id is MISSING\n');
  console.log('📋 QUICK FIX - Run this SQL:\n');
  console.log('─'.repeat(70));
  console.log('Open: https://app.supabase.com/project/rlsyvgjcxxoregwrwuzf/sql/new');
  console.log('─'.repeat(70));
  console.log('');
  console.log('ALTER TABLE network_connections');
  console.log('ADD COLUMN IF NOT EXISTS connection_profile_id TEXT;');
  console.log('');
  console.log('─'.repeat(70));
  console.log('');
})();
