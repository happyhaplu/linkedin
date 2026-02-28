import { createClient } from '@supabase/supabase-js'
import { sessionCookiesToPlaywright } from '../lib/linkedin-cookie-auth'

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  
  // Get ALL linkedin accounts
  const { data: allAccts } = await sb.from('linkedin_accounts').select('id, email, status').limit(10)
  console.log('\n=== All LinkedIn Accounts ===')
  allAccts?.forEach((a: any) => console.log(`  id=${a.id} email=${a.email} status=${a.status}`))
  
  // Get campaign sender account
  const { data: senders } = await sb.from('campaign_senders')
    .select('id, campaign_id, linkedin_account_id, is_active')
    .eq('campaign_id', 'c644a9b8-7df9-411f-95f7-dd9831abf34f')
  console.log('\n=== Campaign Senders ===')
  senders?.forEach((s: any) => console.log(`  sender_id=${s.id} acct=${s.linkedin_account_id} active=${s.is_active}`))
  
  // Check what sender_account_id leads use
  const { data: leads } = await sb.from('campaign_leads')
    .select('id, status, current_step_number, sender_account_id, connection_sent_at')
    .eq('campaign_id', 'c644a9b8-7df9-411f-95f7-dd9831abf34f')
  console.log('\n=== Leads sender_account_id ===')
  leads?.forEach((l: any) => console.log(`  lead=${l.id.slice(0,8)} status=${l.status} step=${l.current_step_number} conn=${l.connection_sent_at?'YES':'NO'} sender_acct=${l.sender_account_id}`))
  
  // Test cookie conversion with the actual stored value
  if (senders?.[0]) {
    const acctId = senders[0].linkedin_account_id
    const { data: acct } = await sb.from('linkedin_accounts').select('id, email, session_cookies, password_encrypted').eq('id', acctId).single()
    console.log('\n=== Sender Account Cookies ===')
    console.log(`  id=${acct?.id}`)
    console.log(`  email=${acct?.email}`)
    const sc = acct?.session_cookies
    console.log(`  session_cookies type=${typeof sc} isArray=${Array.isArray(sc)} keys=${sc ? Object.keys(sc as object).join(',') : 'NULL'}`)
    if (sc) {
      const converted = sessionCookiesToPlaywright(sc)
      console.log(`  Playwright cookies: ${converted.length} cookies`)
      converted.forEach((c: any) => console.log(`    ${c.name} = ${c.value?.slice(0,20)}...`))
    }
  }
}

main().catch(console.error)
