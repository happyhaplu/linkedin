/**
 * Force-test: temporarily remove working_hours constraint, drain queue NOW, 
 * then restore. Run this to verify end-to-end without waiting until Monday.
 * 
 * Usage: node_modules/.bin/tsx --env-file=.env.local scripts/force-test-now.ts
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

  // ── 1. Save current working hours ─────────────────────────────────────
  const { data: camp } = await sb
    .from('campaigns')
    .select('working_hours_start, working_hours_end, working_days, timezone')
    .eq('id', COLD_ID)
    .single()

  console.log('Current working hours:', camp?.working_hours_start, '-', camp?.working_hours_end, camp?.timezone)

  // ── 2. Temporarily null out working hours so jobs fire immediately ─────
  console.log('⏸  Removing working hours constraint temporarily...')
  await sb.from('campaigns')
    .update({ working_hours_start: null, working_hours_end: null })
    .eq('id', COLD_ID)

  // ── 3. Clear existing delayed jobs ────────────────────────────────────
  console.log('🧹 Clearing delayed jobs...')
  const delayed = await q.getDelayed()
  for (const j of delayed) {
    if (j.data?.campaign_id === COLD_ID) await j.remove()
  }

  // ── 4. Re-enqueue (will use 60-120s jitter only, no working-hours delay) ─
  console.log('🚀 Re-enqueuing without working hours constraint...')
  await startCampaign(COLD_ID)

  const [w, d] = await Promise.all([q.getWaiting(), q.getDelayed()])
  console.log(`Queue: ${w.length} waiting, ${d.length} delayed`)
  if (d.length > 0) {
    console.log('First job fires in:', Math.round(((d[0].timestamp + (d[0].opts.delay||0)) - Date.now()) / 1000), 'seconds')
  }

  console.log('\n✅ Jobs will fire in ~60-120s jitter window.')
  console.log('📌 Start workers now: pnpm workers')
  console.log('\n💡 To restore working hours after testing, run:')
  console.log(`   node_modules/.bin/tsx --env-file=.env.local scripts/restore-working-hours.ts`)

  await redis.quit()
}
main().catch(e => { console.error(e); process.exit(1) })
