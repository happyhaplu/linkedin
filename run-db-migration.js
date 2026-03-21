const { Pool } = require('pg');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.+)$/);
  if (match) {
    env[match[1]] = match[2];
  }
});

const supabase = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://reach:reach@localhost:5432/reach' })
const sql = `
ALTER TABLE network_connections 
ADD COLUMN IF NOT EXISTS connection_linkedin_url TEXT;

CREATE INDEX IF NOT EXISTS idx_network_connections_linkedin_url 
ON network_connections(connection_linkedin_url);
`;

(async () => {
  console.log('🔧 Adding connection_linkedin_url column...\n');
  
  // Try to insert with the column to test if it exists
  const { error: testError } = await supabase
    .from('network_connections')
    .insert({
      user_id: '00000000-0000-0000-0000-000000000000',
      linkedin_account_id: '00000000-0000-0000-0000-000000000000',
      full_name: 'Test Column Check',
      connection_linkedin_url: 'https://linkedin.com/in/test'
    });
  
  if (testError) {
    if (testError.message.includes('Could not find') || testError.code === 'PGRST204') {
      console.log('❌ Column "connection_linkedin_url" does not exist in database.\n');
      console.log('📋 SQL to run in Supabase SQL Editor:');
      console.log('   https://supabase.com/dashboard/project/rlsyvgjcxxoregwrwuzf/sql/new\n');
      console.log('─'.repeat(60));
      console.log(sql);
      console.log('─'.repeat(60));
    } else if (testError.message.includes('foreign key') || testError.message.includes('violates')) {
      console.log('✅ Column exists! (Got validation error, meaning column is there)\n');
      console.log('The connection_linkedin_url column is already in the database.');
      console.log('You can now sync your connections!');
    } else {
      console.log('⚠️  Unexpected error:', testError.message);
    }
  } else {
    console.log('✅ Column exists and working!');
    // Delete test row
    await supabase.from('network_connections').delete().eq('full_name', 'Test Column Check');
  }
})();
