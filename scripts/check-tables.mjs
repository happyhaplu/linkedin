import pg from 'pg'
import fs from 'fs'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://reach:reach@localhost:5432/reach' })
async function createTables() {
  console.log('🚀 Creating tables using Supabase Admin API...\n')

  // Read the SQL file
  const sql = fs.readFileSync('setup-all-tables.sql', 'utf8')
  
  // Split into individual statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  console.log(`Found ${statements.length} SQL statements\n`)

  // Try to create tables by testing if they exist first
  console.log('Checking if tables exist...')
  
  const tables = ['proxies', 'linkedin_accounts', 'campaigns', 'campaign_activities', 'account_health_logs']
  
  for (const table of tables) {
    const { error } = await supabase.from(table).select('count').limit(1)
    
    if (error) {
      console.log(`❌ ${table}: Not found (${error.code})`)
    } else {
      console.log(`✅ ${table}: Already exists`)
    }
  }
  
  console.log('\n⚠️  Tables need to be created via SQL Editor')
  console.log('📋 Copy the SQL from setup-all-tables.sql')
  console.log('🔗 Paste and run here: https://app.supabase.com/project/rlsyvgjcxxoregwrwuzf/editor/sql/new')
}

createTables()
