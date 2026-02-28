import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data: camps } = await sb.from('campaigns').select('id, name, status, created_at').order('created_at', { ascending: false }).limit(5)
  console.log('\n=== Campaigns ===')
  for (const c of (camps || [])) {
    const { data: leads } = await sb.from('campaign_leads').select('status').eq('campaign_id', c.id)
    const byStatus: Record<string,number> = {}
    leads?.forEach((l: any) => { byStatus[l.status] = (byStatus[l.status]||0)+1 })
    console.log('  ' + c.id + ' | ' + c.status.padEnd(10) + ' | ' + c.name + ' | leads: ' + JSON.stringify(byStatus))
  }

  const { data: accts } = await sb.from('linkedin_accounts').select('id, email, status, session_cookies')
  console.log('\n=== LinkedIn Accounts ===')
  accts?.forEach((a: any) => {
    const sc = a.session_cookies
    const hasLiAt = sc && typeof sc === 'object' && !Array.isArray(sc) ? !!sc.li_at : false
    console.log('  ' + a.id + ' | ' + a.status + ' | ' + a.email + ' | li_at=' + (hasLiAt ? 'YES' : '*** MISSING ***'))
  })

  const { Queue } = await import('bullmq')
  const { Redis } = await import('ioredis')
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null })
  const q = new Queue('campaign-processor', { connection: redis })
  const [w, d, a, f, c2] = await Promise.all([q.getWaitingCount(), q.getDelayedCount(), q.getActiveCount(), q.getFailedCount(), q.getCompletedCount()])
  console.log('\n=== Queue: waiting=' + w + ' delayed=' + d + ' active=' + a + ' failed=' + f + ' completed=' + c2)
  const allW = await q.getWaiting(0, 9)
  allW.forEach((j: any) => console.log('  [W] camp=' + j.data?.campaign_id?.slice(0,8) + ' step=' + j.data?.step_type))
  const allD = await q.getDelayed(0, 9)
  allD.forEach((j: any) => console.log('  [D] camp=' + j.data?.campaign_id?.slice(0,8) + ' step=' + j.data?.step_type))
  await redis.quit()
}
main().catch(console.error)
