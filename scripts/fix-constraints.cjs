const { Client } = require('pg')

const client = new Client({
  connectionString: 'postgresql://postgres.rlsyvgjcxxoregwrwuzf:ppzSwS0s7uNHUqf2@aws-1-ap-south-1.pooler.supabase.com:5432/postgres',
})

async function run() {
  try {
    await client.connect()
    console.log('✅ Connected to database')

    // 1. Add unique constraint on (user_id, email)
    console.log('Adding unique constraint on (user_id, email)...')
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_linkedin_accounts_user_email 
        ON linkedin_accounts(user_id, email);
    `)
    console.log('✅ Unique constraint added')

    // 2. Expand connection_method CHECK
    console.log('Updating connection_method CHECK constraint...')
    await client.query(`ALTER TABLE linkedin_accounts DROP CONSTRAINT IF EXISTS linkedin_accounts_connection_method_check;`)
    await client.query(`
      ALTER TABLE linkedin_accounts ADD CONSTRAINT linkedin_accounts_connection_method_check 
        CHECK (connection_method IN ('credentials', 'extension', 'proxy', 'cookie', 'proxy_login'));
    `)
    console.log('✅ connection_method CHECK updated')

    // 3. Expand status CHECK
    console.log('Updating status CHECK constraint...')
    await client.query(`ALTER TABLE linkedin_accounts DROP CONSTRAINT IF EXISTS linkedin_accounts_status_check;`)
    await client.query(`
      ALTER TABLE linkedin_accounts ADD CONSTRAINT linkedin_accounts_status_check 
        CHECK (status IN ('active', 'paused', 'error', 'pending', 'connecting', 'pending_verification', 'disconnected'));
    `)
    console.log('✅ status CHECK updated')

    // Verify
    const result = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) 
      FROM pg_constraint 
      WHERE conrelid = 'linkedin_accounts'::regclass
      ORDER BY conname;
    `)
    console.log('\n📋 Current constraints:')
    result.rows.forEach(r => console.log(`  ${r.conname}: ${r.pg_get_constraintdef}`))

    const idxResult = await client.query(`
      SELECT indexname FROM pg_indexes 
      WHERE tablename = 'linkedin_accounts' AND indexname LIKE '%user_email%';
    `)
    console.log('\n📋 Unique index:', idxResult.rows)

  } catch (err) {
    console.error('❌ Migration error:', err.message)
  } finally {
    await client.end()
  }
}

run()
