/**
 * Reset false-positive leads back to step=1 pending, clear the queue,
 * and re-enqueue them so the campaign restarts cleanly.
 */
import { createClient } from '@supabase/supabase-js'
import { Queue } from 'bullmq'
import { Redis } from 'ioredis'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const CAMP = 'c644a9b8-7df9-411f-95f7-dd9831abf34f'

async function main() {
  // 1. Reset ALL leads back to pending step=1, clear all timestamps
  const { data: updated, error } = await sb
    .from('campaign_leads')
    .update({
      status: 'pending',
      current_step_number: 1,
      connection_sent_at: null,
      connection_accepted_at: null,
      first_message_sent_at: null,
      first_reply_at: null,
      replied_at: null,
      completed_at: null,
    })
    .eq('campaign_id', CAMP)
    .select('id')

  if (error) { console.error('Reset error:', error.message); process.exit(1) }
  console.log(`✅ Reset ${updated?.length ?? 0} leads to pending step=1`)

  // 2. Reset campaign_senders counters to 0
  const { error: sErr } = await sb
    .from('campaign_senders')
    .update({ connection_sent: 0, connection_accepted: 0, messages_sent: 0, replies_received: 0 })
    .eq('campaign_id', CAMP)
  if (sErr) console.error('Sender reset error:', sErr.message)
  else console.log('✅ Reset campaign_senders counters to 0')

  // 3. Drain & clean the queue
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null })
  const q = new Queue('campaign-processor', { connection: redis })

  await q.obliterate({ force: true })
  console.log('✅ Queue obliterated (all jobs cleared)')

  await redis.quit()

  // 4. Verify state
  const { data: leads } = await sb
    .from('campaign_leads')
    .select('id, status, current_step_number, connection_sent_at')
    .eq('campaign_id', CAMP)
  console.log('\n=== Leads after reset ===')
  leads?.forEach((l: any) => console.log(`  ${l.id.slice(0,8)} status=${l.status} step=${l.current_step_number} conn=${l.connection_sent_at ?? 'NULL'}`))

  console.log('\n✅ Done. Now relaunch the campaign from the UI or run startCampaign().')
}

main().catch(console.error)
