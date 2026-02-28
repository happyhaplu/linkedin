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
    const migrationPath = path.join(__dirname, '..', 'migrations', 'add-profile-fields.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    console.log('🚀 Running profile fields migration...\n')
    
    // Execute the migration
    await client.query(migrationSQL)
    
    console.log('✅ Migration executed successfully!\n')
    
    // Verify the columns were added
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'linkedin_accounts' 
      AND column_name IN ('profile_name', 'profile_picture_url', 'headline', 'job_title', 'company', 'location', 'profile_url', 'connections_count', 'about')
      ORDER BY column_name;
    `)
    
    console.log('📋 Verified new profile columns:')
    result.rows.forEach(row => {
      console.log(`   ✓ ${row.column_name.padEnd(25)} (${row.data_type})`)
    })
    
    console.log('\n🎉 All profile fields added successfully!')
    console.log('\n🔄 Next steps:')
    console.log('   1. Reconnect your LinkedIn accounts using cookie method')
    console.log('   2. Profile data will be automatically synced!')
    console.log('   3. Check the LinkedIn Accounts page to see the data\n')
    
  } catch (err) {
    console.error('❌ Migration error:', err.message)
    console.error('\nFull error:', err)
  } finally {
    await client.end()
  }
}

runMigration()
