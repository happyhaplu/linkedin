const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

const client = new Client({
  connectionString: 'postgresql://postgres:ppzSwS0s7uNHUqf2@db.rlsyvgjcxxoregwrwuzf.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
})

async function runMigration() {
  try {
    await client.connect()
    console.log('✅ Connected to database')
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '..', 'migrations', 'create-network-tables.sql')
    let migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    // Fix column name: connection_profile_id -> linkedin_profile_id
    migrationSQL = migrationSQL.replace(/connection_profile_id/g, 'linkedin_profile_id')
    migrationSQL = migrationSQL.replace(/connection_linkedin_url/g, 'profile_url')
    
    console.log('🚀 Running network tables migration...\n')
    
    // Execute the migration
    await client.query(migrationSQL)
    
    console.log('✅ Migration executed successfully!\n')
    
    // Verify the tables were created
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('network_connections', 'connection_requests', 'network_sync_logs')
      ORDER BY table_name;
    `)
    
    console.log('📋 Verified tables created:')
    result.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`)
    })
    
    // Verify columns
    const columnsResult = await client.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_name IN ('network_connections', 'connection_requests', 'network_sync_logs')
      AND column_name IN ('linkedin_profile_id', 'profile_url')
      ORDER BY table_name, column_name;
    `)
    
    console.log('\n📋 Verified key columns:')
    columnsResult.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}.${row.column_name}`)
    })
    
    console.log('\n🎉 Network tables setup complete!')
    console.log('\n🔄 Next steps:')
    console.log('   1. Restart your Next.js dev server')
    console.log('   2. Go to My Network page')
    console.log('   3. Click "Sync Network" to test\n')
    
  } catch (err) {
    console.error('❌ Migration error:', err.message)
    console.error('\nFull error:', err)
  } finally {
    await client.end()
  }
}

runMigration()
