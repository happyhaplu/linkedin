import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://reach:reach@localhost:5432/reach' })
async function createTables() {
  console.log('🚀 Creating database tables...\n')

  // First, let's just insert a test record to trigger table creation via Supabase
  // But first we need the tables to exist. Let me use a different approach.
  
  // Check if tables exist by trying to query them
  const { error: checkError } = await supabase.from('linkedin_accounts').select('count').limit(1)
  
  if (checkError?.code === 'PGRST204' || checkError?.code === 'PGRST205') {
    console.log('❌ Tables not found. Creating via Supabase Dashboard is required.\n')
    console.log('Quick fix: Run this in your terminal:\n')
    console.log('curl -X POST https://rlsyvgjcxxoregwrwuzf.supabase.co/rest/v1/rpc/exec_sql \\')
    console.log('  -H "apikey: ' + supabaseKey + '" \\')
    console.log('  -H "Authorization: Bearer ' + supabaseKey + '" \\')
    console.log('  -H "Content-Type: application/json" \\')
    console.log('  -d \'{"query": "SELECT version()"}\'')
    return false
  }
  
  console.log('✅ Tables already exist!')
  return true
}

createTables()
