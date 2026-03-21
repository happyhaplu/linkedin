import { DbClient } from '../lib/db/query-builder'
import dotenv from 'dotenv'
dotenv.config({ path: '/home/harekrishna/Projects/Linkedin/.env.local' })

const sb = new DbClient()

async function main() {
  const { data } = await sb.from('linkedin_accounts')
    .select('id,email,status,session_cookies')
    .eq('id', 'ca6f5d6f-421e-4d3f-a4dd-6120afa9f7e4')
    .single()

  if (!data) { console.log('Account not found'); return }
  console.log('Email:', data.email)
  console.log('Status:', data.status)

  const cookies = data.session_cookies as Record<string, string> | null
  if (!cookies) { console.log('NO COOKIES AT ALL'); return }

  const keys = Object.keys(cookies)
  console.log('Cookie keys:', keys)

  if (cookies.li_at) {
    const val = String(cookies.li_at)
    console.log('li_at length:', val.length)
    console.log('li_at preview:', val.substring(0, 60) + '...')
  } else {
    console.log('li_at: MISSING')
  }

  // Also check campaign_senders to verify which account is linked
  const { data: senders } = await sb.from('campaign_senders')
    .select('id,linkedin_account_id')
    .eq('campaign_id', 'f894669f-d2dd-4194-8480-016135d64cfe')
  console.log('\nCampaign senders:', JSON.stringify(senders))
}
main()
