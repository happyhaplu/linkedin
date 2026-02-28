const { Client } = require('pg');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.+)$/);
  if (match) {
    env[match[1]] = match[2];
  }
});

const sql = `
-- Add missing connection_profile_id column
ALTER TABLE network_connections 
ADD COLUMN IF NOT EXISTS connection_profile_id TEXT;

-- Add connection_linkedin_url if not exists (legacy)
ALTER TABLE network_connections 
ADD COLUMN IF NOT EXISTS connection_linkedin_url TEXT;

-- Add UNIQUE constraint for upsert operations
DO $$ 
BEGIN
  -- Drop existing constraint if it exists with wrong name
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'network_connections_linkedin_account_id_connection_profile_id_key'
  ) THEN
    ALTER TABLE network_connections 
    DROP CONSTRAINT network_connections_linkedin_account_id_connection_profile_id_key;
  END IF;
  
  -- Add the unique constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'network_connections_unique_account_profile'
  ) THEN
    ALTER TABLE network_connections 
    ADD CONSTRAINT network_connections_unique_account_profile 
    UNIQUE (linkedin_account_id, connection_profile_id);
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_network_connections_linkedin_url 
ON network_connections(connection_linkedin_url);

CREATE INDEX IF NOT EXISTS idx_network_connections_profile_id 
ON network_connections(connection_profile_id);
`;

async function runMigration() {
  console.log('🔧 Connecting to Supabase PostgreSQL database...\n');
  
  const client = new Client({
    connectionString: env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    console.log('Running migration SQL...\n');
    console.log(sql);
    console.log('');
    
    await client.query(sql);
    
    console.log('✅ Migration completed successfully!\n');
    console.log('Column "connection_linkedin_url" has been added to network_connections table.');
    console.log('\nYou can now sync your LinkedIn connections with URLs!');
    
  } catch (error) {
    console.error('❌ Error running migration:', error.message);
    console.error('Details:', error);
  } finally {
    await client.end();
  }
}

runMigration();
