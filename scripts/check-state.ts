import { createClient } from '@supabase/supabase-js'
import { Queue } from 'bullmq'
import { Redis } from 'ioredis'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null })
const q = new Queue('campaign-processor', { connection: redis })

const [w, d, f, c, a] = await Promise.all([
  q.getWaiting(), q.getDelayed(), q.getFailed(), q.getCompleted(), q.getActive()
])
console.log('Queue:', { waiting: w.length, delayed: d.length, failed: f.length, completed: c.length, active: a.length })

if (f.length > 0) {
  console.log('\nFailed jobs:')
  f.forEach(j => console.log(' -', j.data?.step_type, '|', j.failedReason?.slice(0, 120)))
}
if (c.length > 0) {
  console.log('\nCompleted jobs (last 3):')
  c.slice(-3).forEach(j => console.log(' - step:', j.data?.step_type, '| returnval:', JSON.stringify(j.returnvalue)?.slice(0, 100)))
}

const { data: leads, error } = await sb
  .from('campaign_leads')
  .select('id, status, current_step_number')
  .eq('campaign_id', 'c644a9b8-7df9-411f-95f7-dd9831abf34f')
console.log('\nLeads error:', error?.message ?? 'none')
console.log('Leads:', leads?.map(l => ({ status: l.status, step: l.current_step_number })))

// Also check what columns exist on campaign_leads
const { data: sample } = await sb.from('campaign_leads').select('*').limit(1)
if (sample?.[0]) console.log('\nActual campaign_leads columns:', Object.keys(sample[0]))

await redis.quit()
