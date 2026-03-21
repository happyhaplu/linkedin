import { DbClient } from '../lib/db/query-builder'
import dotenv from 'dotenv'
dotenv.config({ path: '/home/harekrishna/Projects/Linkedin/.env.local' })

const sb = new DbClient()

async function main() {
  // Check campaign_leads columns
  const { data, error } = await sb.from('campaign_leads').select('*').limit(1)
  if (error) { console.log('ERROR:', error.message); return }
  if (data && data[0]) {
    console.log('campaign_leads columns:', Object.keys(data[0]).sort().join(', '))
  } else {
    console.log('No campaign_leads rows found')
  }

  // Check campaign state
  const CID = 'f894669f-d2dd-4194-8480-016135d64cfe'
  const { data: camp } = await sb.from('campaigns').select('status, pending_leads, completed_leads').eq('id', CID).single()
  console.log('\nCampaign:', camp)

  const { data: leads } = await sb.from('campaign_leads').select('id, status, current_step_number').eq('campaign_id', CID)
  console.log('Leads:', leads?.map(l => `${l.id.slice(0,8)}… status=${l.status} step=${l.current_step_number}`))

  const { data: seqs } = await sb.from('campaign_sequences').select('step_number, step_type, delay_days').eq('campaign_id', CID).order('step_number')
  console.log('Sequences:', seqs)

  const { data: senders } = await sb.from('campaign_senders').select('id, linkedin_account_id, is_active').eq('campaign_id', CID)
  console.log('Senders:', senders)

  // Check linkedin account status
  if (senders && senders[0]) {
    const { data: acct } = await sb.from('linkedin_accounts').select('id, email, status, proxy_id').eq('id', senders[0].linkedin_account_id).single()
    console.log('LinkedIn Account:', acct)
  }
}
main()
