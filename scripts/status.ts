import { createClient } from '@supabase/supabase-js'
import { Queue } from 'bullmq'
import { Redis } from 'ioredis'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const COLD = 'c644a9b8-7df9-411f-95f7-dd9831abf34f'

async function main() {
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null })
  const q = new Queue('campaign-processor', { connection: redis })

  // ── Queue state ──────────────────────────────────────────────────────
  const [waiting, delayed, failed, completed, active] = await Promise.all([
    q.getWaiting(), q.getDelayed(), q.getFailed(), q.getCompleted(), q.getActive()
  ])
  console.log('=== Queue ===')
  console.log('waiting:', waiting.length, '| delayed:', delayed.length, '| active:', active.length, '| failed:', failed.length, '| completed:', completed.length)

  const allJobs = [...waiting, ...delayed, ...active, ...failed, ...completed]
  const campaignJobs = allJobs.filter(j => j.data?.campaign_id === COLD)
  console.log('Jobs for this campaign:', campaignJobs.length)
  campaignJobs.slice(0, 3).forEach(j => {
    const state = waiting.includes(j) ? 'waiting' : delayed.includes(j) ? 'delayed' : active.includes(j) ? 'active' : failed.includes(j) ? 'failed' : 'completed'
    console.log(' -', state, '| step:', j.data?.step_type, '| returnval:', JSON.stringify(j.returnvalue)?.slice(0, 80))
  })

  if (failed.length > 0) {
    console.log('\nFailed reason:', failed[0].failedReason?.slice(0, 200))
  }

  await redis.quit()

  // ── Lead statuses ────────────────────────────────────────────────────
  console.log('\n=== Leads ===')
  const { data: leads, error } = await sb
    .from('campaign_leads')
    .select('id, status, current_step_number, connection_sent_at, first_message_sent_at, completed_at')
    .eq('campaign_id', COLD)
  
  if (error) console.log('Error:', error.message)
  leads?.forEach(l => {
    console.log(
      ' status:', l.status,
      '| step:', l.current_step_number,
      '| conn_sent:', l.connection_sent_at ? 'YES' : 'no',
      '| msg_sent:', l.first_message_sent_at ? 'YES' : 'no',
      '| completed:', l.completed_at ? 'YES' : 'no'
    )
  })
}

main().catch(e => { console.error(e); process.exit(1) })
