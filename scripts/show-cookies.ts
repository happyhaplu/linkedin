import { DbClient } from '../lib/db/query-builder'

async function main() {
  const sb = new DbClient()
  const { data: acct } = await sb.from('linkedin_accounts')
    .select('id, session_cookies')
    .eq('id', '67b75216-06b0-49b1-9470-234588fdba45')
    .single()
  
  const sc = acct?.session_cookies
  console.log('type:', typeof sc)
  console.log('isArray:', Array.isArray(sc))
  console.log('raw:', JSON.stringify(sc, null, 2).slice(0, 2000))
}

main().catch(console.error)
