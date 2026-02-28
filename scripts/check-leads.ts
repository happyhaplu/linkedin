import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '/home/harekrishna/Projects/Linkedin/.env.local' })

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const CID = 'f894669f-d2dd-4194-8480-016135d64cfe'

async function check() {
  const {data: c} = await sb.from('campaigns').select('status,connection_sent,messages_sent,pending_leads,completed_leads').eq('id', CID).single()
  console.log('Campaign:', c)

  const {data: l, error} = await sb.from('campaign_leads').select('status,current_step_number,connection_sent_at,started_at,error_message').eq('campaign_id', CID)
  if (error) { console.log('Error:', error.message); return }
  if (!l) { console.log('No data'); return }
  l.forEach((lead: any, i: number) => console.log(`Lead ${i+1}:`, JSON.stringify(lead)))
}
check()
