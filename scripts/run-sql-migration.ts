import { Client } from 'pg'
import dotenv from 'dotenv'
import { readFileSync } from 'fs'

dotenv.config({ path: '/home/harekrishna/Projects/Linkedin/.env.local' })

async function main() {
  const sql = readFileSync('/home/harekrishna/Projects/Linkedin/migrations/atomic-counter-rpcs.sql', 'utf-8')
  
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  console.log('Connected to database')
  
  try {
    await client.query(sql)
    console.log('✅ Migration executed successfully!')
    
    // Verify functions exist
    const { rows } = await client.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
        AND routine_name IN ('increment_sender_stat', 'increment_campaign_stat')
    `)
    console.log('Functions created:', rows.map(r => r.routine_name))
  } catch (err: any) {
    console.error('❌ Migration failed:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
