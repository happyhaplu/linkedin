import { DbClient } from '../lib/db/query-builder'
import { sessionCookiesToPlaywright } from '../lib/linkedin-cookie-auth'
import { sendConnectionRequest } from '../lib/linkedin-campaign-automation'

async function main() {
  const sb = new DbClient()
  
  const { data: acct } = await sb.from('linkedin_accounts')
    .select('*')
    .eq('id', '67b75216-06b0-49b1-9470-234588fdba45')
    .single()

  const { data: leads } = await sb.from('campaign_leads')
    .select('*, lead:leads(*)')
    .eq('campaign_id', 'c644a9b8-7df9-411f-95f7-dd9831abf34f')
    .eq('status', 'pending')
    .limit(1)

  const campaignLead = leads?.[0]
  const lead = Array.isArray(campaignLead?.lead) ? campaignLead.lead[0] : campaignLead?.lead
  
  if (!lead) {
    console.log('No pending leads found')
    return
  }

  console.log(`Testing connection request to: ${lead.full_name} (${lead.linkedin_url})`)
  
  const account = {
    id: acct!.id,
    email: acct!.email,
    password: (acct as any).password_encrypted || '',
    cookies: sessionCookiesToPlaywright(acct!.session_cookies),
    proxy_url: (acct as any).proxy_url,
  }

  console.log(`Account: ${account.email}, cookies: ${account.cookies.length}`)

  const result = await sendConnectionRequest(
    account,
    {
      linkedin_url: lead.linkedin_url,
      first_name: lead.first_name,
      last_name: lead.last_name,
      full_name: lead.full_name,
      company: lead.company,
      position: lead.position,
    },
    'Hi {{first_name}}, I would love to connect!'
  )
  
  console.log('\n=== RESULT ===')
  console.log(JSON.stringify(result, null, 2))
}

main().catch(console.error)
