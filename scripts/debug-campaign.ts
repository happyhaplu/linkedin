import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const Q3 = '4094732f-e678-487e-8c7e-1d11c9d66565'
  const COLD = 'c644a9b8-7df9-411f-95f7-dd9831abf34f'

  const [c1, s1, c2, s2, accs] = await Promise.all([
    sb.from('campaign_leads').select('id,status,sender_id').eq('campaign_id', Q3),
    sb.from('campaign_sequences').select('id,step_number,step_type,delay_days,delay_hours').eq('campaign_id', Q3).order('step_number'),
    sb.from('campaign_leads').select('id,status,sender_id').eq('campaign_id', COLD),
    sb.from('campaign_sequences').select('id,step_number,step_type,delay_days,delay_hours').eq('campaign_id', COLD).order('step_number'),
    sb.from('linkedin_accounts').select('id,email,status,session_cookies').limit(5),
  ])

  console.log('\n=== q3 (PAUSED, has 6 queued jobs) ===')
  console.log('Leads:', c1.data?.length, '  statuses:', c1.data?.map(l => l.status))
  console.log('Sender IDs in leads:', [...new Set(c1.data?.map(l => l.sender_id))])
  console.log('Sequences:', s1.data?.map(s => `step${s.step_number}:${s.step_type}(+${s.delay_days}d${s.delay_hours}h)`))

  console.log('\n=== Cold Outreach Copy (ACTIVE, NO queued jobs) ===')
  console.log('Leads:', c2.data?.length, '  statuses:', c2.data?.map(l => l.status))
  console.log('Sender IDs in leads:', [...new Set(c2.data?.map(l => l.sender_id))])
  console.log('Sequences:', s2.data?.map(s => `step${s.step_number}:${s.step_type}(+${s.delay_days}d${s.delay_hours}h)`))

  console.log('\n=== LinkedIn Accounts ===')
  accs.data?.forEach(a => {
    const cookies = a.session_cookies
    const hasCookies = cookies !== null && cookies !== undefined && cookies !== ''
    console.log(` - ${a.email}  status=${a.status}  hasCookies=${hasCookies}`)
  })

  console.log('\n=== Current time ===')
  console.log('UTC:', new Date().toISOString())
  console.log('IST:', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }))
}

main().catch(console.error)
