import { DbClient } from '../lib/db/query-builder'
import { Queue } from 'bullmq'
import { Redis } from 'ioredis'

const sb = new DbClient()

async function main() {
  // 1. All LinkedIn accounts
  const { data: allAccts, error: e1 } = await sb.from('linkedin_accounts').select('*')
  console.log('=== ALL LINKEDIN ACCOUNTS ===')
  console.log('Count:', allAccts?.length, 'Error:', e1)
  allAccts?.forEach((a: any) => {
    const hasCookies = a.session_cookies && typeof a.session_cookies === 'object' && !Array.isArray(a.session_cookies) ? !!a.session_cookies.li_at : false
    console.log(JSON.stringify({ id: a.id, email: a.email, status: a.status, user_id: a.user_id, has_cookies: hasCookies }))
  })

  // 2. All campaign senders
  const { data: allSenders, error: e2 } = await sb.from('campaign_senders').select('*')
  console.log('\n=== ALL CAMPAIGN SENDERS ===')
  console.log('Count:', allSenders?.length, 'Error:', e2)
  allSenders?.forEach((s: any) => console.log(JSON.stringify(s)))

  // 3. Full campaign row
  const { data: camp } = await sb.from('campaigns').select('*').eq('id', 'f894669f-d2dd-4194-8480-016135d64cfe').single()
  console.log('\n=== CAMPAIGN FULL ROW ===')
  console.log(JSON.stringify(camp, null, 2))

  // 4. Campaign leads detail
  const { data: leads } = await sb.from('campaign_leads').select('*, lead:leads(full_name, linkedin_url)').eq('campaign_id', 'f894669f-d2dd-4194-8480-016135d64cfe')
  console.log('\n=== CAMPAIGN LEADS ===')
  leads?.forEach((l: any) => {
    console.log(JSON.stringify({
      id: l.id,
      name: l.lead?.full_name,
      status: l.status,
      step: l.current_step_number,
      sender_id: l.sender_id,
      sender_account_id: l.sender_account_id,
      conn_sent: l.connection_sent_at,
      conn_accepted: l.connection_accepted_at,
    }))
  })

  // 5. Queue state
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null })
  const q = new Queue('campaign-processor', { connection: redis })
  const [w, d, a, f, c2] = await Promise.all([q.getWaitingCount(), q.getDelayedCount(), q.getActiveCount(), q.getFailedCount(), q.getCompletedCount()])
  console.log('\n=== QUEUE ===')
  console.log('waiting=' + w, 'delayed=' + d, 'active=' + a, 'failed=' + f, 'completed=' + c2)

  const delayed = await q.getDelayed(0, 20)
  delayed.forEach((j: any) => {
    const fire = new Date(j.timestamp + (j.delay || 0))
    console.log('  [D]', j.data?.step_type, '| immediate:', j.data?.immediate, '| fires:', fire.toISOString(), '| lead:', j.data?.lead_id?.slice(0, 8), '| sender:', j.data?.sender_account_id?.slice(0, 8))
  })

  const failed = await q.getFailed(0, 20)
  failed.forEach((j: any) => console.log('  [F]', j.failedReason?.split('\n')[0], '| attempts:', j.attemptsMade))

  await redis.quit()
}

main().catch(console.error)
