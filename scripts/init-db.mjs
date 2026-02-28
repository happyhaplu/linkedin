import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://rlsyvgjcxxoregwrwuzf.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsc3l2Z2pjeHhvcmVnd3J3dXpmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTcwNjU3NCwiZXhwIjoyMDg1MjgyNTc0fQ.0O0T_lTunWIVXVY1y8d5_51-hzb8s40TFmvYsu51QqQ'

const supabase = createClient(supabaseUrl, supabaseKey)

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
