/**
 * reenqueue-now.ts
 * Clear all stale jobs for ALL active/paused campaigns and re-enqueue immediately.
 *
 * Usage:  node_modules/.bin/tsx --env-file=.env.local scripts/reenqueue-now.ts
 */
import { DbClient } from '../lib/db/query-builder'
import { Queue } from 'bullmq'
import { Redis } from 'ioredis'
import { startCampaign } from '../lib/campaign-executor'

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null })

async function main() {
  const sb = new DbClient()
const q = new Queue('campaign-processor', { connection: redis })

  // Find active/paused campaigns with pending leads
  const { data: campaigns } = await sb
    .from('campaigns')
    .select('id, name, status')
    .in('status', ['active', 'paused'])

  if (!campaigns?.length) {
    console.log('No active/paused campaigns found.')
    await redis.quit(); return
  }

  console.log(`\nFound ${campaigns.length} campaign(s): ${campaigns.map(c => c.name).join(', ')}\n`)

  for (const campaign of campaigns) {
    console.log(`━━━ ${campaign.name} (${campaign.status}) ━━━`)

    // Show lead statuses
    const { data: leads } = await sb
      .from('campaign_leads')
      .select('status, current_step_number')
      .eq('campaign_id', campaign.id)
    const statusMap = leads?.reduce((m: any, l) => { m[l.status] = (m[l.status]||0)+1; return m }, {}) ?? {}
    console.log('  Leads:', JSON.stringify(statusMap))

    // Clear ALL queue states — including completed (fixes deduplication issue)
    const [waiting, delayed, completed, failed] = await Promise.all([
      q.getWaiting(), q.getDelayed(), q.getCompleted(), q.getFailed()
    ])
    let removed = 0
    for (const j of [...waiting, ...delayed, ...completed, ...failed]) {
      if (j.data?.campaign_id === campaign.id) { await j.remove(); removed++ }
    }
    console.log(`  Cleared ${removed} stale jobs`)

    // Ensure active
    if (campaign.status !== 'active') {
      await sb.from('campaigns').update({ status: 'active' }).eq('id', campaign.id)
    }

    // Re-enqueue immediately (bypass working hours)
    try {
      const result = await startCampaign(campaign.id, true)
      console.log(`  🚀 Enqueued ${(result as any).queuedCount ?? 0} leads immediately`)
    } catch (e: any) {
      console.error(`  ❌ ${e.message}`)
    }
  }

  // Final snapshot
  const [w, d, a] = await Promise.all([q.getWaiting(), q.getDelayed(), q.getActive()])
  console.log(`\n📊 Queue: ${w.length} waiting | ${d.length} delayed | ${a.length} active`)
  if (d.length > 0) {
    const firstFire = new Date(d[0].timestamp + (d[0].opts.delay ?? 0))
    const secsAway = Math.max(0, Math.round((firstFire.getTime() - Date.now()) / 1000))
    console.log(`⏰ First job fires in ${secsAway}s (${d[0].data.step_type} | sender: ${d[0].data.sender_account_id})`)
  }

  console.log('\n✅ Done! Start workers:  pnpm workers')
  await redis.quit()
}

main().catch(e => { console.error(e); process.exit(1) })
