import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const CAMP = 'c644a9b8-7df9-411f-95f7-dd9831abf34f'

  // Campaign leads full state
  const { data: leads } = await sb.from('campaign_leads')
    .select('id, status, current_step_number, connection_sent_at, connection_accepted_at, first_message_sent_at, sender_account_id, lead:leads(full_name, linkedin_url)')
    .eq('campaign_id', CAMP)
  console.log('\n=== Campaign Leads ===')
  leads?.forEach((l: any) => {
    const lead = Array.isArray(l.lead) ? l.lead[0] : l.lead
    console.log(`  ${lead?.full_name?.padEnd(20)} | status=${l.status?.padEnd(12)} | step=${l.current_step_number} | conn_sent=${l.connection_sent_at ? 'YES' : 'NO '} | conn_accepted=${l.connection_accepted_at ? 'YES' : 'NO '} | sender_acct=${l.sender_account_id?.slice(0,8) ?? 'NULL'}`)
  })

  // Campaign senders stats
  const { data: senders } = await sb.from('campaign_senders')
    .select('id, linkedin_account_id, connection_sent, connection_accepted, messages_sent, replies_received')
    .eq('campaign_id', CAMP)
  console.log('\n=== Campaign Senders Stats ===')
  senders?.forEach((s: any) => console.log(`  acct=${s.linkedin_account_id?.slice(0,8)} | conn_sent=${s.connection_sent} | conn_accepted=${s.connection_accepted} | msg_sent=${s.messages_sent} | replies=${s.replies_received}`))

  // Queue state
  const { Queue } = await import('bullmq')
  const { Redis } = await import('ioredis')
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null })
  const q = new Queue('campaign-processor', { connection: redis })
  const [w, d, a, f, c] = await Promise.all([q.getWaitingCount(), q.getDelayedCount(), q.getActiveCount(), q.getFailedCount(), q.getCompletedCount()])
  console.log(`\n=== Queue State ===\n  waiting=${w} delayed=${d} active=${a} failed=${f} completed=${c}`)

  // Last 5 completed jobs
  const completed = await q.getCompleted(0, 4)
  if (completed.length) {
    console.log('\n=== Last Completed Jobs ===')
    completed.forEach((j: any) => console.log(`  [${j.id}] step=${j.data?.step_type} lead=${j.data?.lead_id?.slice(0,8)} result=${JSON.stringify(j.returnvalue)?.slice(0,80)}`))
  }

  // Last 5 failed jobs
  const failed = await q.getFailed(0, 4)
  if (failed.length) {
    console.log('\n=== Last Failed Jobs ===')
    failed.forEach((j: any) => console.log(`  [${j.id}] ${j.failedReason?.split('\n')[0]}`))
  }

  await redis.quit()
}
main().catch(console.error)
