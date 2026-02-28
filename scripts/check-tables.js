#!/usr/bin/env node

/**
 * Check existing database tables
 */

const { readFileSync } = require('fs');
const { join } = require('path');

async function checkTables() {
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
    const { Client } = require('pg');

    const client = new Client({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    await client.connect();

    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log('\n📊 Existing tables in database:');
    console.log('=' .repeat(40));
    result.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });
    console.log('=' .repeat(40));
    console.log(`Total: ${result.rows.length} tables\n`);

    await client.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkTables();
