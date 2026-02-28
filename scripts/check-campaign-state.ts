import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '/home/harekrishna/Projects/Linkedin/.env.local' })

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const CID = 'f894669f-d2dd-4194-8480-016135d64cfe'

async function check() {
  const { data: c } = await sb.from('campaigns').select('id,name,status,total_leads,pending_leads').eq('id', CID).single()
  console.log('Campaign:', JSON.stringify(c, null, 2))

  const { data: senders } = await sb.from('campaign_senders').select('id,linkedin_account_id,is_active').eq('campaign_id', CID)
  console.log('Senders:', JSON.stringify(senders, null, 2))

  const { data: seqs } = await sb.from('campaign_sequences').select('id,step_number,step_type,message_template,delay_days').eq('campaign_id', CID).order('step_number')
  console.log('Sequences:', JSON.stringify(seqs, null, 2))

  const { data: leads } = await sb.from('campaign_leads').select('id,lead_id,sender_id,status,current_step_number').eq('campaign_id', CID).limit(5)
  console.log('Leads (first 5):', JSON.stringify(leads, null, 2))

  // Check the LinkedIn account
  const { data: acc } = await sb.from('linkedin_accounts').select('id,email,status,proxy_id').eq('id', 'b4884875-d423-402f-b717-2e339bc34223').single()
  console.log('LinkedIn Account:', JSON.stringify(acc, null, 2))

  // Check if account has session cookies
  const { data: accFull } = await sb.from('linkedin_accounts').select('session_cookies').eq('id', 'b4884875-d423-402f-b717-2e339bc34223').single()
  const cookies = accFull?.session_cookies
  console.log('Has cookies:', !!cookies)
  if (cookies && typeof cookies === 'object') {
    console.log('Cookie keys:', Object.keys(cookies))
  }
}
check()
