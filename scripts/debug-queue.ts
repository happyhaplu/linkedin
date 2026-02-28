/**
 * Full state dump: queue jobs + account IDs
 */
import { createClient } from '@supabase/supabase-js'
import { Queue } from 'bullmq'
import { Redis } from 'ioredis'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null })

async function main() {
  const q = new Queue('campaign-processor', { connection: redis })
  const [waiting, delayed, failed, completed, active] = await Promise.all([
    q.getWaiting(), q.getDelayed(), q.getFailed(), q.getCompleted(), q.getActive(),
  ])

  console.log('Queue state:')
  console.log('  Waiting:', waiting.length)
  console.log('  Delayed:', delayed.length)
  console.log('  Failed:', failed.length)
  console.log('  Completed:', completed.length)
  console.log('  Active:', active.length)

  if (failed.length > 0) {
    console.log('\nFailed jobs:')
    failed.forEach(j => console.log(' -', j.name, '|', j.failedReason))
  }
  if (delayed.length > 0) {
    console.log('\nDelayed jobs (first 3):')
    delayed.slice(0,3).forEach(j => {
      console.log(' -', j.data.step_type, 'for lead', j.data.campaign_lead_id?.slice(0,8), 
        '| fires:', new Date(j.timestamp + (j.opts.delay||0)).toISOString(),
        '| sender_account_id:', j.data.sender_account_id)
    })
  }
  if (waiting.length > 0) {
    console.log('\nWaiting jobs (first 3):')
    waiting.slice(0,3).forEach(j => console.log(' -', j.data.step_type, '| sender:', j.data.sender_account_id))
  }

  // Check what linkedin account ID actually exists
  const { data: accs } = await sb.from('linkedin_accounts').select('id,email,status')
  console.log('\nLinkedIn accounts in DB:')
  accs?.forEach(a => console.log(' -', a.id, a.email, a.status))

  // Check sender_id in campaign_leads vs accounts
  const { data: leads } = await sb.from('campaign_leads')
    .select('id,sender_id,status')
    .eq('campaign_id', 'c644a9b8-7df9-411f-95f7-dd9831abf34f')
  console.log('\nCampaign leads sender_id:', Array.from(new Set(leads?.map(l => l.sender_id))))

  await redis.quit()
}
main().catch(e => { console.error(e); process.exit(1) })
