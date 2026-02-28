const { Client } = require('pg')

const client = new Client({
  connectionString: 'postgresql://postgres:ppzSwS0s7uNHUqf2@db.rlsyvgjcxxoregwrwuzf.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
})

async function updateStatusConstraint() {
  try {
    await client.connect()
    console.log('✅ Connected to database')
    
    // Drop old constraint
    console.log('🔧 Dropping old status constraint...')
    await client.query('ALTER TABLE linkedin_accounts DROP CONSTRAINT IF EXISTS linkedin_accounts_status_check;')
    console.log('✅ Old constraint dropped')
    
    // Add new constraint with pending_verification
    console.log('🔧 Adding new status constraint with pending_verification...')
    await client.query(`
      ALTER TABLE linkedin_accounts 
      ADD CONSTRAINT linkedin_accounts_status_check 
      CHECK (status IN ('active', 'paused', 'error', 'connecting', 'pending_verification'));
    `)
    console.log('✅ New constraint added successfully!')
    
    // Verify
    const result = await client.query(`
      SELECT constraint_name, check_clause
      FROM information_schema.check_constraints
      WHERE constraint_name = 'linkedin_accounts_status_check';
    `)
    
    if (result.rows.length > 0) {
      console.log('✅ Verified: Constraint updated')
      console.log('   Check clause:', result.rows[0].check_clause)
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message)
  } finally {
    await client.end()
  }
}

updateStatusConstraint()
