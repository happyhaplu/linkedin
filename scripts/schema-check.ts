import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data: cl, error: e1 } = await sb.from('campaign_leads').select('*').limit(1)
  if (e1) console.log('campaign_leads error:', e1.message)
  else console.log('campaign_leads columns:\n ', cl?.[0] ? Object.keys(cl[0]).join('\n  ') : 'no rows - inserting test')

  // If no rows, check via count
  const { count } = await sb.from('campaign_leads').select('*', { count: 'exact', head: true })
  console.log('campaign_leads row count:', count)

  // Select just id to confirm table access
  const { data: ids } = await sb.from('campaign_leads').select('id').limit(3)
  console.log('IDs found:', ids?.map(r => r.id.slice(0,8)))

  const { data: la, error: e2 } = await sb.from('linkedin_accounts').select('*').limit(1)
  if (e2) console.log('linkedin_accounts error:', e2.message)
  else console.log('\nlinkedin_accounts columns:\n ', la?.[0] ? Object.keys(la[0]).join('\n  ') : 'no rows')
}
main().catch(console.error)
