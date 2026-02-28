const { Client } = require('pg')

const client = new Client({
  connectionString: 'postgresql://postgres:ppzSwS0s7uNHUqf2@db.rlsyvgjcxxoregwrwuzf.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
})

async function addProfilePictureColumn() {
  try {
    await client.connect()
    console.log('✅ Connected to database')
    
    // Add profile_picture_url column
    console.log('🔧 Adding profile_picture_url column...')
    await client.query('ALTER TABLE linkedin_accounts ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;')
    console.log('✅ profile_picture_url column added')
    
    // Add disconnected status to constraint
    console.log('🔧 Updating status constraint to include disconnected...')
    await client.query('ALTER TABLE linkedin_accounts DROP CONSTRAINT IF EXISTS linkedin_accounts_status_check;')
    await client.query(`
      ALTER TABLE linkedin_accounts 
      ADD CONSTRAINT linkedin_accounts_status_check 
      CHECK (status IN ('active', 'paused', 'error', 'connecting', 'pending_verification', 'disconnected'));
    `)
    console.log('✅ Status constraint updated')
    
    // Verify
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'linkedin_accounts' 
      AND column_name = 'profile_picture_url';
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

addProfilePictureColumn()
