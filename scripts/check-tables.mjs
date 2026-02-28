import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseUrl = 'https://rlsyvgjcxxoregwrwuzf.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsc3l2Z2pjeHhvcmVnd3J3dXpmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTcwNjU3NCwiZXhwIjoyMDg1MjgyNTc0fQ.0O0T_lTunWIVXVY1y8d5_51-hzb8s40TFmvYsu51QqQ'

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  }
})

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
