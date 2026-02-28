import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://rlsyvgjcxxoregwrwuzf.supabase.co'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsc3l2Z2pjeHhvcmVnd3J3dXpmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTcwNjU3NCwiZXhwIjoyMDg1MjgyNTc0fQ.0O0T_lTunWIVXVY1y8d5_51-hzb8s40TFmvYsu51QqQ'

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function addSessionIdColumn() {
  try {
    console.log('🔧 Adding session_id column to linkedin_accounts table...')
    
    // First check if column exists
    const { data: testData, error: testError } = await supabase
      .from('linkedin_accounts')
      .select('session_id')
      .limit(1)
    
    if (testError) {
      if (testError.message.includes('column') && testError.message.includes('session_id')) {
        console.log('⚠️  Column does not exist, needs to be added via SQL')
        console.log('')
        console.log('Please run this SQL command in Supabase Dashboard:')
        console.log('https://supabase.com/dashboard/project/rlsyvgjcxxoregwrwuzf/sql/new')
        console.log('')
        console.log('ALTER TABLE linkedin_accounts ADD COLUMN session_id TEXT;')
        console.log('')
        
        // Try using raw SQL via RPC if available
        const { data, error } = await supabase.rpc('exec_sql', {
          query: 'ALTER TABLE linkedin_accounts ADD COLUMN session_id TEXT;'
        })
        
        if (error) {
          console.log('❌ Cannot add column via API:', error.message)
          console.log('Please add it manually using the SQL command above')
        } else {
          console.log('✅ Column added successfully!')
        }
      } else {
        console.error('❌ Error checking column:', testError.message)
      }
    } else {
      console.log('✅ Column session_id already exists!')
    }
  } catch (err) {
    console.error('❌ Exception:', err.message)
  }
}

addSessionIdColumn()
