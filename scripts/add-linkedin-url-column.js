const https = require('https');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.+)$/);
  if (match) {
    env[match[1]] = match[2];
  }
});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const PROJECT_REF = SUPABASE_URL.replace('https://', '').split('.')[0];

const sql = `
ALTER TABLE network_connections 
ADD COLUMN IF NOT EXISTS connection_linkedin_url TEXT;

CREATE INDEX IF NOT EXISTS idx_network_connections_linkedin_url 
ON network_connections(connection_linkedin_url);
`;

console.log('🔧 Running database migration...\n');

// Use Supabase Management API
const options = {
  hostname: 'api.supabase.com',
  path: `/v1/projects/${PROJECT_REF}/database/query`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json'
  }
};

const postData = JSON.stringify({ query: sql });

const req = https.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200 || res.statusCode === 201) {
      console.log('✅ Migration successful!');
      console.log('Column "connection_linkedin_url" added to network_connections table.\n');
      console.log('You can now sync your LinkedIn connections!');
    } else {
      console.log('⚠️  API response:', res.statusCode);
      console.log(data);
      console.log('\nTrying alternative method...');
      
      // Fallback: Use psql if available
      const { execSync } = require('child_process');
      try {
        const dbUrl = env.DATABASE_URL || env.SUPABASE_DB_URL;
        if (dbUrl) {
          console.log('Using DATABASE_URL to run migration...');
          execSync(`echo "${sql}" | psql "${dbUrl}"`, { stdio: 'inherit' });
          console.log('\n✅ Migration completed via psql!');
        } else {
          console.log('\n❌ No DATABASE_URL found.');
          console.log('Please add your database connection string to .env.local as DATABASE_URL');
          console.log('Or run this SQL manually in Supabase dashboard:');
          console.log('\n' + sql);
        }
      } catch (e) {
        console.log('\n❌ Could not run migration automatically.');
        console.log('Please run this SQL in Supabase SQL Editor:');
        console.log('https://supabase.com/dashboard/project/' + PROJECT_REF + '/sql/new');
        console.log('\n' + sql);
      }
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request error:', e.message);
  console.log('\nPlease run this SQL in Supabase SQL Editor:');
  console.log('https://supabase.com/dashboard/project/' + PROJECT_REF + '/sql/new');
  console.log('\n' + sql);
});

req.write(postData);
req.end();
