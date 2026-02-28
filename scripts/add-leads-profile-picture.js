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
-- Add profile_picture column to leads table
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS profile_picture TEXT;

-- Add headline column if missing
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS headline TEXT;

-- Add company_url column if missing
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS company_url TEXT;

COMMENT ON COLUMN leads.profile_picture IS 'LinkedIn profile picture URL';
COMMENT ON COLUMN leads.headline IS 'LinkedIn headline/job title';
COMMENT ON COLUMN leads.company_url IS 'Company website URL';
`;

async function runMigration() {
  console.log('🔧 Adding profile_picture and other columns to leads table...\n');
  
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
    await client.query(sql);
    
    console.log('✅ Migration completed successfully!\n');
    console.log('Added columns to leads table:');
    console.log('  - profile_picture (TEXT)');
    console.log('  - headline (TEXT)');
    console.log('  - company_url (TEXT)');
    
  } catch (error) {
    console.error('❌ Error running migration:', error.message);
  } finally {
    await client.end();
  }
}

runMigration();
