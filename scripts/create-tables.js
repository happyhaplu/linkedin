const { Client } = require('pg');
const fs = require('fs');

const client = new Client({
  host: 'db.rlsyvgjcxxoregwrwuzf.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'ppzSwS0s7uNHUqf2',
});

async function createTables() {
  try {
    console.log('🔌 Connecting to Supabase database...');
    await client.connect();
    console.log('✅ Connected!\n');

    console.log('📝 Reading SQL file...');
    const sql = fs.readFileSync('setup-all-tables.sql', 'utf8');
    
    console.log('🚀 Executing SQL...');
    await client.query(sql);
    
    console.log('\n✨ Success! All tables created:');
    console.log('   ✅ proxies');
    console.log('   ✅ linkedin_accounts');
    console.log('   ✅ campaigns');
    console.log('   ✅ campaign_activities');
    console.log('   ✅ account_health_logs');
    console.log('\n🎉 Database setup complete!');
    console.log('\nRefresh your app at http://localhost:3000/linkedin-account\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

createTables();
