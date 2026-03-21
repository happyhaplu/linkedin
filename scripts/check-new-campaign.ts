import { DbClient } from '../lib/db/query-builder'
import { Queue } from 'bullmq'
import { Redis } from 'ioredis'
const sb = new DbClient()

async function main() {
  const NEW_CAMP = 'f894669f-c1db-4339-8c11-72b8c7289e93'

  const { data: leads } = await sb.from('campaign_leads')
    .select('id, status, current_step_number, connection_sent_at, sender_account_id, lead:leads(full_name, linkedin_url)')
    .eq('campaign_id', NEW_CAMP)
  console.log('\n=== New Campaign Leads ===')
  leads?.forEach((l: any) => {
    const lead = Array.isArray(l.lead) ? l.lead[0] : l.lead
    console.log(`  ${(lead?.full_name || '?').padEnd(20)} | ${l.status?.padEnd(12)} | step=${l.current_step_number} | conn=${l.connection_sent_at?'YES':'NO'} | url=${lead?.linkedin_url}`)
  })

  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null })
  const q = new Queue('campaign-processor', { connection: redis })

  // Get all jobs and show which campaign they belong to
  const [waiting, delayed, active] = await Promise.all([q.getWaiting(), q.getDelayed(), q.getActive()])
  const allJobs = [...waiting, ...delayed, ...active]
  console.log(`\n=== Queue Jobs by Campaign ===`)
  const bycamp: Record<string, any[]> = {}
  allJobs.forEach((j: any) => {
    const cid = j.data?.campaign_id?.slice(0,8) || 'unknown'
    bycamp[cid] = bycamp[cid] || []
    bycamp[cid].push({ state: j.data?.campaign_id === 'c644a9b8-7df9-411f-95f7-dd9831abf34f' ? 'OLD' : 'NEW', step: j.data?.step_type, lead: j.data?.lead_id?.slice(0,8), acct: j.data?.sender_account_id?.slice(0,8) })
  })
  Object.entries(bycamp).forEach(([cid, jobs]) => console.log(`  Campaign ${cid}: ${jobs.length} jobs — ${JSON.stringify(jobs[0])}`))

  await redis.quit()
}
main().catch(console.error)
