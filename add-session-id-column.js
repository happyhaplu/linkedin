const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' })

const supabase = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://reach:reach@localhost:5432/reach' })
async function addColumn() {
  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE linkedin_accounts ADD COLUMN IF NOT EXISTS session_id TEXT'
    })
    
    if (error) {
      console.error('Error:', error)
      
      // Try direct SQL if exec_sql doesn't exist
      const { error: directError } = await supabase
        .from('linkedin_accounts')
        .select('session_id')
        .limit(1)
      
      if (directError && directError.message.includes('column')) {
        console.log('Column needs to be added via SQL console')
        console.log('Run this in Supabase SQL Editor:')
        console.log('ALTER TABLE linkedin_accounts ADD COLUMN session_id TEXT;')
      } else {
        console.log('Column already exists or other error')
      }
    } else {
      console.log('✅ Column added successfully')
    }
  } catch (err) {
    console.error('Exception:', err.message)
  }
}

addColumn()
