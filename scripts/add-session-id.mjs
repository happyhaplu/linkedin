import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://reach:reach@localhost:5432/reach' })
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
