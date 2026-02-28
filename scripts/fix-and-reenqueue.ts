/**
 * Fix + re-enqueue: clears wrong jobs, fixes sender_id in DB, re-enqueues with real account
 */
import { createClient } from '@supabase/supabase-js'
import { Queue } from 'bullmq'
import { Redis } from 'ioredis'
import { startCampaign } from '../lib/campaign-executor'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null })

const COLD_ID = 'c644a9b8-7df9-411f-95f7-dd9831abf34f'

async function main() {
  const q = new Queue('campaign-processor', { connection: redis })

  // ── 1. Check campaign_senders ──────────────────────────────────────────
  console.log('=== campaign_senders for Cold Outreach Copy ===')
  const { data: senders } = await sb
    .from('campaign_senders')
    .select('*, linkedin_account:linkedin_accounts(id,email,status)')
    .eq('campaign_id', COLD_ID)
  console.log(JSON.stringify(senders, null, 2))

  // Real account in DB
  const { data: accs } = await sb.from('linkedin_accounts').select('id,email,status')
  console.log('\nAll linkedin_accounts:', accs)

  // ── 2. Ensure campaign_senders links real account ──────────────────────
  const realAccount = accs?.[0]
  if (!realAccount) { console.error('No LinkedIn accounts found!'); process.exit(1) }

  const alreadyLinked = senders?.some(s => s.linkedin_account_id === realAccount.id)
  if (!alreadyLinked) {
    console.log('\n➕ Linking real account to campaign_senders...')
    // Remove old stale sender rows first
    await sb.from('campaign_senders').delete().eq('campaign_id', COLD_ID)
    const { error } = await sb.from('campaign_senders').insert({
      campaign_id: COLD_ID,
      linkedin_account_id: realAccount.id,
    })
    if (error) console.error('Insert error:', error)
    else console.log('✅ Linked', realAccount.email)
  } else {
    console.log('\n✅ Real account already linked in campaign_senders')
  }

  // ── 3. campaign_leads.sender_id is a FK to campaign_senders.id (NOT linkedin_accounts.id)
  // The executor resolves this correctly via senderMap — no manual fix needed here.
  console.log('\n✅ sender_id resolution handled by executor (campaign_senders.id FK)')

  // ── 4. Clear all existing stale jobs (including completed!) ──────────
  console.log('\n🧹 Clearing stale queue jobs...')
  const [waiting, delayed, completed, failed] = await Promise.all([
    q.getWaiting(), q.getDelayed(), q.getCompleted(), q.getFailed()
  ])
  let removed = 0
  for (const j of [...waiting, ...delayed, ...completed, ...failed]) {
    if (j.data?.campaign_id === COLD_ID) { await j.remove(); removed++ }
  }
  console.log(`   Removed ${removed} stale/completed jobs`)

  // ── 5. Re-enqueue with correct sender ID ─────────────────────────────
  const immediately = process.argv.includes('--now')
  console.log(`\n🚀 Re-enqueuing ${immediately ? 'IMMEDIATELY' : 'on schedule'}...`)
  await startCampaign(COLD_ID, immediately)
  console.log('✅ Done!')

  // ── 6. Final queue state ──────────────────────────────────────────────
  const [w2, d2] = await Promise.all([q.getWaiting(), q.getDelayed()])
  console.log(`\nQueue: ${w2.length} waiting, ${d2.length} delayed`)
  if (d2.length > 0) {
    const j = d2[0]
    console.log('First job fires:', new Date(j.timestamp + (j.opts.delay||0)).toISOString())
    console.log('Sender in job:', j.data.sender_account_id)
  }

  await redis.quit()
}
main().catch(e => { console.error(e); process.exit(1) })
