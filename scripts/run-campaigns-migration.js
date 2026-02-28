#!/usr/bin/env node

/**
 * Run Campaigns Migration Script
 * Executes the campaigns tables migration using direct database connection
 */

const { readFileSync } = require('fs');
const { join } = require('path');

async function runMigration() {
  console.log('🚀 Running Campaigns Migration...\n');

  try {
    // Read environment variables from .env.local
    const envPath = join(__dirname, '..', '.env.local');
    const envContent = readFileSync(envPath, 'utf8');
    const envVars = {};
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        envVars[match[1].trim()] = match[2].trim();
      }
    });

    const { DATABASE_URL } = envVars;

    if (!DATABASE_URL) {
      throw new Error('DATABASE_URL not found in .env.local');
    }

    // Import pg
    const { Client } = require('pg');

    // Create client
    const client = new Client({
      connectionString: DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });

    console.log('📡 Connecting to Supabase...');
    await client.connect();
    console.log('✅ Connected successfully\n');

    // Read migration file
    const migrationPath = join(__dirname, '..', 'migrations', 'alter-campaigns-tables.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    console.log('📄 Executing migration: alter-campaigns-tables.sql');
    console.log('=' .repeat(60));

    // Execute migration (no need to drop indexes, ALTER TABLE handles it)
    await client.query(sql);

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Created tables:');
    console.log('  ✓ campaigns');
    console.log('  ✓ campaign_senders');
    console.log('  ✓ campaign_sequences');
    console.log('  ✓ campaign_leads');
    console.log('  ✓ campaign_activity_log');
    console.log('\n🔒 Row Level Security policies applied');
    console.log('⚡ Indexes created for performance');
    console.log('🔄 Triggers set up for auto-updates');

    // Close connection
    await client.end();
    console.log('\n✨ All done! Your campaigns module is ready to use.');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    if (error.detail) {
      console.error('Details:', error.detail);
    }
    if (error.hint) {
      console.error('Hint:', error.hint);
    }
    process.exit(1);
  }
}

// Run migration
runMigration();
