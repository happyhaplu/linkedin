import { DbClient } from '../lib/db/query-builder'
import dotenv from 'dotenv'
dotenv.config({ path: '/home/harekrishna/Projects/Linkedin/.env.local' })

const sb = new DbClient()
const CID = 'f894669f-d2dd-4194-8480-016135d64cfe'
const ACCT = 'ca6f5d6f-e77d-4063-b7ba-79e28da217d8'

async function audit() {
  // Campaign
  const { data: c } = await sb.from('campaigns')
    .select('status,connection_sent,connection_accepted,messages_sent,replies_received,total_sent,pending_leads,completed_leads')
    .eq('id', CID).single()
  console.log('\n=== CAMPAIGN ===')
  console.log(JSON.stringify(c, null, 2))

  // Sender
  const { data: s } = await sb.from('campaign_senders')
    .select('connection_sent,connection_accepted,messages_sent,replies_received')
    .eq('campaign_id', CID)
  console.log('\n=== SENDERS ===')
  console.log(JSON.stringify(s, null, 2))

  // Leads
  const { data: l } = await sb.from('campaign_leads')
    .select('status,current_step_number,connection_sent_at,started_at,completed_at')
    .eq('campaign_id', CID)
  console.log('\n=== LEADS ===')
  if (l) l.forEach((lead: any, i: number) => console.log(`  Lead ${i + 1}:`, JSON.stringify(lead)))

  // LinkedIn account
  const { data: a } = await sb.from('linkedin_accounts')
    .select('id,email,status,session_cookies')
    .eq('id', ACCT).single()
  const cookies = a?.session_cookies as any
  console.log('\n=== LINKEDIN ACCOUNT ===')
  console.log('  Email:', a?.email)
  console.log('  Status:', a?.status)
  console.log('  has li_at:', !!cookies?.li_at)
  if (cookies?.li_at) {
    console.log('  li_at preview:', String(cookies.li_at).substring(0, 40) + '...')
  }
}
audit()
