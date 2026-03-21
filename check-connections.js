const { Pool } = require('pg');
const fs = require('fs');

// Read .env.local
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
  console.log('Checking network_connections table...\n');
  
  const { data, error, count } = await supabase
    .from('network_connections')
    .select('*', { count: 'exact' })
    .limit(5);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`Total connections in DB: ${count}`);
  console.log('\nFirst 5 connections:');
  data.forEach((conn, i) => {
    console.log(`${i+1}. ${conn.full_name} - ${conn.position || 'No position'} at ${conn.company || 'No company'}`);
    console.log(`   User ID: ${conn.user_id}`);
    console.log(`   LinkedIn Account ID: ${conn.linkedin_account_id}`);
  });
})();
