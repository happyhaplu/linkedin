import { DbClient } from '../lib/db/query-builder'
import { sendConnectionRequest } from '../lib/linkedin-campaign-automation'
import { sessionCookiesToPlaywright } from '../lib/linkedin-cookie-auth'

async function main() {
  const sb = new DbClient()
  const { data: acct } = await sb.from('linkedin_accounts').select('id, email, session_cookies, password_encrypted').eq('id', '67b75216-06b0-49b1-9470-234588fdba45').single()

  const { data: leads } = await sb.from('campaign_leads')
    .select('id, lead:leads(full_name, linkedin_url)')
    .eq('campaign_id', 'c644a9b8-7df9-411f-95f7-dd9831abf34f')
    .eq('status', 'pending')

  console.log(`Found ${leads?.length} pending leads\n`)

  for (const cl of (leads || [])) {
    const lead = Array.isArray(cl.lead) ? (cl.lead as any[])[0] : cl.lead as any
    console.log(`Testing: ${lead.full_name} (${lead.linkedin_url})`)
    try {
      const r = await sendConnectionRequest(
        { id: acct!.id, email: acct!.email, password: (acct as any).password_encrypted || '', cookies: sessionCookiesToPlaywright(acct!.session_cookies) },
        { linkedin_url: lead.linkedin_url, full_name: lead.full_name },
        ''
      )
      console.log(`  → ${r.success ? '✅ SENT' : `❌ ${r.error}`}\n`)
    } catch (e: any) {
      console.log(`  → 💥 THROW: ${e.message}\n`)
    }
  }
}
main().catch(console.error)
