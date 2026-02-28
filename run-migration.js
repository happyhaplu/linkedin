const { createClient } = require('@supabase/supabase-js');
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

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

const migration = fs.readFileSync('migrations/add-connection-profile-id.sql', 'utf8');

(async () => {
  console.log('Running migration...\n');
  console.log(migration);
  console.log('\n---\n');
  
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: migration
  });
  
  if (error) {
    console.error('Migration error:', error);
    
    // Try direct query
    console.log('\nTrying ALTER TABLE directly...');
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE network_connections ADD COLUMN IF NOT EXISTS connection_profile_id TEXT;'
    });
    
    if (alterError) {
      console.error('Direct ALTER failed:', alterError);
    } else {
      console.log('✅ Column added successfully!');
    }
  } else {
    console.log('✅ Migration completed:', data);
  }
})();
