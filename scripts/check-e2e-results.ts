import dotenv from 'dotenv'
dotenv.config({ path: '/home/harekrishna/Projects/Linkedin/.env.local' })

import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)
const CID = 'f894669f-d2dd-4194-8480-016135d64cfe'
const ACCT = 'b4884875-d423-402f-b717-2e339bc34223'

async function main() {
  // 1. Check account
  const { data: acct } = await sb.from('linkedin_accounts')
    .select('status, email, proxy_id, session_cookie')
    .eq('id', ACCT)
    .single()
  console.log('=== LinkedIn Account ===')
  console.log('  Status:', acct?.status)
  console.log('  Email:', acct?.email)
  console.log('  Has cookies:', acct?.session_cookie ? 'YES' : 'NO')
  console.log('  Proxy:', acct?.proxy_id ? 'assigned' : 'none')

  // 2. Check campaign
  const { data: camp } = await sb.from('campaigns')
    .select('status, connection_sent, messages_sent, completed_leads, started_at')
    .eq('id', CID)
    .single()
  console.log('\n=== Campaign ===')
  console.log('  Status:', camp?.status)
  console.log('  Connections sent:', camp?.connection_sent)
  console.log('  Messages sent:', camp?.messages_sent)
  console.log('  Completed leads:', camp?.completed_leads)

  // 3. Check leads
  const { data: leads } = await sb.from('campaign_leads')
    .select('id, status, current_step_number, connection_sent_at, sender_account_id, lead:leads(full_name)')
    .eq('campaign_id', CID)
  console.log('\n=== Campaign Leads ===')
  if (leads) {
    for (const l of leads) {
      const lead = l.lead as any
      console.log(`  ${lead?.full_name}: status=${l.status}, step=${l.current_step_number}, sender=${l.sender_account_id ? 'assigned' : 'none'}, conn_sent=${l.connection_sent_at ? 'YES' : 'no'}`)
    }
  }

  // 4. Check senders
  const { data: senders } = await sb.from('campaign_senders')
    .select('linkedin_account_id, connection_sent, messages_sent, is_active')
    .eq('campaign_id', CID)
  console.log('\n=== Senders ===')
  if (senders) {
    for (const s of senders) {
      console.log(`  ${s.linkedin_account_id}: active=${s.is_active}, conn_sent=${s.connection_sent}, msgs=${s.messages_sent}`)
    }
  }
}

main().catch(console.error)
