import { DbClient } from '../lib/db/query-builder'
import { Queue } from 'bullmq'
import { Redis } from 'ioredis'

const sb = new DbClient()
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null })
const COLD_ID = 'c644a9b8-7df9-411f-95f7-dd9831abf34f'

async function main() {
  // Lead statuses
  const { data: leads, error: leadsErr } = await sb
    .from('campaign_leads')
    .select('id, status, current_step_number, connection_sent_at, message_sent_at, error_message')
    .eq('campaign_id', COLD_ID)

  console.log('=== Campaign Leads ===')
  if (leadsErr) console.log('Error:', leadsErr)
  leads?.forEach(l => console.log(
    ` ${l.id.slice(0,8)}  status=${l.status}  step=${l.current_step_number}`,
    l.connection_sent_at ? '✓conn' : '',
    l.message_sent_at ? '✓msg' : '',
    l.error_message ? `ERR:${l.error_message}` : ''
  ))

  // Completed job return values
  const q = new Queue('campaign-processor', { connection: redis })
  const completed = await q.getCompleted(0, 10)
  console.log('\n=== Last Completed Jobs ===')
  completed.forEach(j => console.log(
    ` step=${j.data.step_type}  result=${JSON.stringify(j.returnvalue)}`
  ))

  const failed = await q.getFailed(0, 10)
  console.log('\n=== Failed Jobs ===')
  if (failed.length === 0) console.log('  (none)')
  failed.forEach(j => console.log(` step=${j.data.step_type}  reason=${j.failedReason}`))

  // Campaign stats
  const { data: camp } = await sb
    .from('campaigns')
    .select('status, connection_sent, connection_accepted, messages_sent, replies_received, total_leads')
    .eq('id', COLD_ID).single()
  console.log('\n=== Campaign Stats ===', JSON.stringify(camp))

  await redis.quit()
}
main().catch(e => { console.error(e); process.exit(1) })
