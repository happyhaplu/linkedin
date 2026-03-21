/**
 * Trigger script: enqueue the active "Cold Outreach Copy" campaign immediately.
 * Also cleans up stale delayed jobs for the paused q3 campaign.
 *
 * Usage: node_modules/.bin/tsx --env-file=.env.local scripts/trigger-campaign.ts
 */

import { DbClient } from '../lib/db/query-builder'
import { Queue } from 'bullmq'
import { Redis } from 'ioredis'
import { startCampaign } from '../lib/campaign-executor'

const sb = new DbClient()
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

const COLD_OUTREACH_ID = 'c644a9b8-7df9-411f-95f7-dd9831abf34f'
const Q3_ID = '4094732f-e678-487e-8c7e-1d11c9d66565'

async function main() {
  // ── 1. Clean up stale delayed jobs for paused campaign q3 ──────────────
  console.log('\n🧹 Cleaning stale delayed jobs for paused campaign q3...')
  const q = new Queue('campaign-processor', { connection: redis })
  const delayed = await q.getDelayed()
  let cleaned = 0
  for (const job of delayed) {
    if (job.data?.campaign_id === Q3_ID) {
      await job.remove()
      cleaned++
    }
  }
  console.log(`   Removed ${cleaned} stale jobs`)

  // ── 2. Verify active campaign state ───────────────────────────────────
  console.log('\n🔍 Checking active campaign...')
  const { data: campaign } = await sb
    .from('campaigns')
    .select('id, name, status, working_hours_start, working_hours_end, timezone')
    .eq('id', COLD_OUTREACH_ID)
    .single()

  console.log(`   Campaign: ${campaign?.name}`)
  console.log(`   Status: ${campaign?.status}`)
  console.log(`   Working hours: ${campaign?.working_hours_start} - ${campaign?.working_hours_end} (${campaign?.timezone})`)

  // Show current time in campaign timezone
  const tz = campaign?.timezone || 'UTC'
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date())
  const weekday = parts.find(p => p.type === 'weekday')?.value
  const hour = parts.find(p => p.type === 'hour')?.value
  const minute = parts.find(p => p.type === 'minute')?.value
  console.log(`   Current time in ${tz}: ${weekday} ${hour}:${minute}`)

  if (campaign?.status !== 'active') {
    console.log('\n⚠️  Campaign is not active. Setting to active first...')
    await sb.from('campaigns').update({ status: 'active' }).eq('id', COLD_OUTREACH_ID)
  }

  // ── 3. Enqueue all pending leads ──────────────────────────────────────
  console.log('\n🚀 Enqueuing jobs for Cold Outreach Copy campaign...')
  try {
    await startCampaign(COLD_OUTREACH_ID)
    console.log('✅ Jobs enqueued successfully!')
  } catch (err) {
    console.error('❌ Error enqueuing jobs:', err)
  }

  // ── 4. Show queue state ───────────────────────────────────────────────
  console.log('\n📊 Queue state after trigger:')
  const [waiting, delayed2, active] = await Promise.all([
    q.getWaiting(),
    q.getDelayed(),
    q.getActive(),
  ])
  console.log(`   Waiting: ${waiting.length}`)
  console.log(`   Delayed: ${delayed2.length}`)
  console.log(`   Active: ${active.length}`)

  if (waiting.length > 0) {
    console.log('\n🎯 First waiting job:')
    console.log('  ', JSON.stringify(waiting[0].data, null, 2))
    console.log('   Delay:', waiting[0].opts.delay, 'ms')
  }
  if (delayed2.length > 0) {
    const j = delayed2[0]
    console.log('\n⏰ First delayed job fires at:', new Date(j.timestamp + (j.opts.delay || 0)))
  }

  await redis.quit()
}

main().catch(e => { console.error(e); process.exit(1) })
