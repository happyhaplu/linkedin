const { Client } = require('pg')

const client = new Client({
  connectionString: 'postgresql://postgres:ppzSwS0s7uNHUqf2@db.rlsyvgjcxxoregwrwuzf.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
})

async function addProfileColumns() {
  try {
    await client.connect()
    console.log('✅ Connected to database')
    
    // Add profile_name column
    console.log('🔧 Adding profile_name column...')
    await client.query('ALTER TABLE linkedin_accounts ADD COLUMN IF NOT EXISTS profile_name TEXT;')
    console.log('✅ profile_name column added')
    
    // Add daily_limits column (JSONB)
    console.log('🔧 Adding daily_limits column...')
    await client.query('ALTER TABLE linkedin_accounts ADD COLUMN IF NOT EXISTS daily_limits JSONB DEFAULT \'{"connection_requests_per_day": 20, "messages_per_day": 50, "inmails_per_day": 20}\'::jsonb;')
    console.log('✅ daily_limits column added')
    
    // Verify
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'linkedin_accounts' 
      AND column_name IN ('profile_name', 'daily_limits');
    `)
    
    console.log('\n✅ Verified columns:')
    result.rows.forEach(row => {
      console.log(`   - ${row.column_name}: ${row.data_type}`)
    })
    
  } catch (err) {
    console.error('❌ Error:', err.message)
  } finally {
    await client.end()
  }
}

addProfileColumns()
