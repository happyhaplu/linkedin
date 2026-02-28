import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { readFileSync } from 'fs'
dotenv.config({ path: '/home/harekrishna/Projects/Linkedin/.env.local' })

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const sql = readFileSync('/home/harekrishna/Projects/Linkedin/migrations/atomic-counter-rpcs.sql', 'utf-8')
  
  // Split by semicolons and run each statement (skip empty ones)
  const statements = sql.split(/;\s*\n/).filter(s => s.trim().length > 10)
  
  for (const stmt of statements) {
    const { error } = await sb.rpc('exec_sql', { sql_text: stmt.trim() + ';' })
    if (error) {
      console.log('Trying via direct SQL...')
      // Supabase doesn't have exec_sql by default - use the SQL editor approach
      // Let's try the Supabase Management API instead
      console.log('Statement preview:', stmt.trim().substring(0, 80) + '...')
      console.log('Error:', error.message)
    } else {
      console.log('OK:', stmt.trim().substring(0, 60))
    }
  }
}
main()
