#!/usr/bin/env node

const { readFileSync } = require('fs');
const { join } = require('path');

async function checkCampaignsTable() {
  try {
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

    // Check campaigns table structure
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'campaigns'
      ORDER BY ordinal_position;
    `);

    console.log('\n📋 Campaigns table structure:');
    console.log('=' .repeat(80));
    result.rows.forEach(row => {
      console.log(`  ${row.column_name.padEnd(30)} ${row.data_type.padEnd(20)} ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    console.log('=' .repeat(80));
    console.log(`Total columns: ${result.rows.length}\n`);

    await client.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkCampaignsTable();
