const { Client } = require('pg')

const client = new Client({
  connectionString: 'postgresql://postgres:ppzSwS0s7uNHUqf2@db.rlsyvgjcxxoregwrwuzf.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
})

async function addSessionIdColumn() {
  try {
    await client.connect()
    console.log('✅ Connected to database')
    
    // Add the column
    console.log('🔧 Adding session_id column...')
    await client.query('ALTER TABLE linkedin_accounts ADD COLUMN IF NOT EXISTS session_id TEXT;')
    console.log('✅ Column added successfully!')
    
    // Verify
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'linkedin_accounts' 
      AND column_name = 'session_id';
    `)
    
    if (result.rows.length > 0) {
      console.log('✅ Verified: session_id column exists')
      console.log('   Type:', result.rows[0].data_type)
    } else {
      console.log('❌ Column not found after adding')
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message)
  } finally {
    await client.end()
  }
}

addSessionIdColumn()
