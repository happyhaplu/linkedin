const { Pool } = require('pg')

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'ppzSwS0s7uNHUqf2',
  ssl: { rejectUnauthorized: false }
})

async function migrate() {
  const client = await pool.connect()
  
  try {
    console.log('🚀 Adding new columns to leads table...')
    
    await client.query(`
      ALTER TABLE leads 
      ADD COLUMN IF NOT EXISTS headline TEXT,
      ADD COLUMN IF NOT EXISTS company_url TEXT,
      ADD COLUMN IF NOT EXISTS enriched_email TEXT,
      ADD COLUMN IF NOT EXISTS custom_address TEXT,
      ADD COLUMN IF NOT EXISTS tags TEXT;
    `)
    
    console.log('✅ Columns added successfully!')
    
  } catch (error) {
    console.error('❌ Migration error:', error.message)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

migrate().catch(console.error)
