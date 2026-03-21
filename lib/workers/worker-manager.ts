/**
 * Worker Manager — starts all BullMQ workers inside the Next.js process.
 * Called from instrumentation.ts on server boot so no extra terminal is needed.
 *
 * Guards against multiple starts (e.g. HMR re-imports in dev).
 */

import { Worker, Job, DelayedError } from 'bullmq'
import { Redis } from 'ioredis'
import { processCampaignLeadStep } from '@/lib/campaign-executor'
import { QUEUE_NAMES, type CampaignLeadJobData } from '@/lib/queue/campaign-queue'
import { DbClient } from '@/lib/db/query-builder'

// ─── Singleton guard ─────────────────────────────────────────────────────────
let started = false

// ─── Redis factory (one connection per worker set) ───────────────────────────
function makeRedis() {
  return new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => {
      if (times > 10) return null // stop retrying after 10 attempts
      return Math.min(times * 500, 5000)
    },
  })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function supabase() {
  return new DbClient()
}

function randomSleep(min: number, max: number) {
  return new Promise<void>((r) => setTimeout(r, Math.random() * (max - min) + min))
}

/** Check if current time falls within campaign working hours */
async function isWithinWorkingHours(
  campaignId: string,
): Promise<{ ok: boolean; delayUntil?: number }> {
  const { data: campaign } = await supabase()
    .from('campaigns')
    .select('working_hours_start, working_hours_end, working_days, timezone')
    .eq('id', campaignId)
    .single()

  if (!campaign?.working_hours_start || !campaign?.working_hours_end) return { ok: true }

  const tz = (campaign.timezone as string) || 'UTC'
  const workDays: string[] = campaign.working_days ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  const [sH, sM] = (campaign.working_hours_start as string).split(':').map(Number)
  const [eH, eM] = (campaign.working_hours_end as string).split(':').map(Number)

  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now)

  const day = parts.find((p) => p.type === 'weekday')?.value ?? ''
  const h = parseInt(parts.find((p) => p.type === 'hour')?.value?.replace('24', '0') ?? '0')
  const m = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0')
  const nowMin = h * 60 + m
  const startMin = sH * 60 + sM
  const endMin = eH * 60 + eM

  if (workDays.includes(day) && nowMin >= startMin && nowMin < endMin) return { ok: true }

  // Calculate how many minutes until the next working-hours start, entirely
  // in the campaign's configured timezone to avoid machine-local-time bugs.
  // We compute the offset from "now in tz" to the next valid start-of-window.
  let minutesUntilNextWindow = 0

  if (nowMin < startMin && workDays.includes(day)) {
    // Today is a working day and we're before the window — wait until start
    minutesUntilNextWindow = startMin - nowMin
  } else {
    // After today's window (or today is not a work day) — advance to next work day
    // Minutes remaining until midnight in tz
    minutesUntilNextWindow = (24 * 60 - nowMin)

    // Walk forward up to 7 days to find the next working day
    const candidate = new Date(now.getTime() + minutesUntilNextWindow * 60 * 1000)
    for (let i = 0; i < 7; i++) {
      const candidateDay = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' })
        .formatToParts(candidate).find((p) => p.type === 'weekday')?.value ?? ''
      if (workDays.includes(candidateDay)) break
      minutesUntilNextWindow += 24 * 60
      candidate.setDate(candidate.getDate() + 1)
    }

    // Add the start-of-window offset (e.g. 09:00 = 540 minutes from midnight)
    minutesUntilNextWindow += startMin
  }

  const delayUntil = now.getTime() + minutesUntilNextWindow * 60 * 1000
  return { ok: false, delayUntil }
}

// ─── Campaign worker processor ───────────────────────────────────────────────
async function campaignProcessor(job: Job<CampaignLeadJobData>, token?: string) {
  console.log(`\n📋 [CampaignWorker] Processing job ${job.id}`)
  console.log(`   Campaign : ${job.data.campaign_id}`)
  console.log(`   Lead     : ${job.data.lead_id}`)
  console.log(`   Step     : ${job.data.step_type}`)

  // Working-hours pre-check — skip entirely for immediately-launched jobs
  if (!job.data.immediate) {
    const hoursCheck = await isWithinWorkingHours(job.data.campaign_id)
    if (!hoursCheck.ok && hoursCheck.delayUntil) {
      const delayMs = hoursCheck.delayUntil - Date.now()
      if (delayMs > 0) {
        console.log(`⏰ [CampaignWorker] Outside working hours — rescheduling in ${Math.round(delayMs / 60000)} min`)
        await job.moveToDelayed(hoursCheck.delayUntil, token)
        // Must throw DelayedError — returning normally would cause BullMQ to also
        // try to move the job to 'completed', resulting in 'Missing lock' errors.
        throw new DelayedError()
      }
    }
  } else {
    console.log(`⚡ [CampaignWorker] immediate=true — skipping working-hours check`)
  }

  // Human-like random delay
  const { data: s } = await supabase()
    .from('campaigns')
    .select('delay_min_seconds, delay_max_seconds')
    .eq('id', job.data.campaign_id)
    .maybeSingle()

  const minMs = ((s?.delay_min_seconds as number | null) ?? 45) * 1000
  const maxMs = ((s?.delay_max_seconds as number | null) ?? 120) * 1000
  await randomSleep(minMs, maxMs)

  try {
    const result = await processCampaignLeadStep(job.data)
    console.log(`✅ [CampaignWorker] Job ${job.id} completed`)
    return result
  } catch (err: any) {
    console.error(`❌ [CampaignWorker] Job ${job.id} failed:`, err.message)
    throw err
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────
export async function startWorkers() {
  if (started) {
    console.log('[Workers] Already running — skipping re-init')
    return
  }
  started = true

  console.log('\n🚀 [Workers] Initialising BullMQ workers...')

  // ── Campaign processor ──────────────────────────────────────────────────────
  const campaignConn = makeRedis()
  const campaignWorker = new Worker<CampaignLeadJobData>(
    QUEUE_NAMES.CAMPAIGN_PROCESSOR,
    campaignProcessor,
    {
      connection: campaignConn as any,
      concurrency: 2,
      lockDuration: 180_000,   // 3-min lock — prevents stalled jobs on worker crash
      stalledInterval: 30_000, // Check for stalled jobs every 30 s
      limiter: { max: 5, duration: 60_000 },
    },
  )

  campaignWorker.on('completed', (job) => console.log(`✅ [CampaignWorker] Job ${job.id} done`))
  campaignWorker.on('failed', async (job, err) => {
    console.error(`❌ [CampaignWorker] Job ${job?.id} failed:`, err.message)

    // When all retry attempts are exhausted, mark the lead as 'failed' and
    // check whether the entire campaign should auto-pause.
    if (job && job.attemptsMade >= (job.opts.attempts ?? 3)) {
      console.log(`🛑 [CampaignWorker] All ${job.attemptsMade} retries exhausted for job ${job.id}`)
      const sb = supabase()
      try {
        // Mark lead as failed
        await sb.from('campaign_leads')
          .update({ status: 'failed', completed_at: new Date().toISOString() })
          .eq('id', job.data.campaign_lead_id)
        console.log(`[CampaignWorker] Lead ${job.data.campaign_lead_id} marked as failed`)

        // Check if all leads for this campaign are now done (completed/failed/removed)
        const { count: pendingCount } = await sb.from('campaign_leads')
          .select('id', { count: 'exact', head: true })
          .eq('campaign_id', job.data.campaign_id)
          .in('status', ['pending', 'in_progress'])
        if (pendingCount === 0) {
          console.log(`🛑 [CampaignWorker] All leads done — auto-pausing campaign ${job.data.campaign_id}`)
          await sb.from('campaigns')
            .update({ status: 'paused', paused_at: new Date().toISOString() })
            .eq('id', job.data.campaign_id)
        }
      } catch (e: any) {
        console.error(`[CampaignWorker] Failed to mark lead/campaign after retries exhausted:`, e.message)
      }
    }
  })
  campaignWorker.on('stalled', (jobId) =>
    console.warn(`⏸️  [CampaignWorker] Job ${jobId} stalled — will be retried`),
  )
  campaignWorker.on('error', (err) => console.error('[CampaignWorker] Error:', err.message))

  console.log(`✅ [Workers] Campaign worker running (concurrency: 2, lockDuration: 3 min)`)

  // ── Message-sync worker ─────────────────────────────────────────────────────
  try {
    const { startMessageSyncWorker } = await import('./message-sync-worker')
    const { scheduleMessageSync } = await import('@/lib/queue/message-sync-queue')
    await startMessageSyncWorker()
    await scheduleMessageSync(3) // every 3 minutes
    console.log(`✅ [Workers] Message-sync worker running (repeat: 3 min)`)
  } catch (err: any) {
    console.error(`⚠️  [Workers] Message-sync worker failed to start:`, err.message)
  }

  // ── Graceful shutdown (no process.exit — Next.js handles that) ─────────────
  const shutdown = async (signal: string) => {
    console.log(`\n[Workers] ${signal} received — closing workers gracefully…`)
    try {
      const { stopMessageSyncWorker } = await import('./message-sync-worker')
      await stopMessageSyncWorker()
    } catch {}
    await campaignWorker.close()
    await campaignConn.quit()
    console.log('[Workers] All workers closed')
  }

  // Only register once (guard against multiple registrations in dev HMR)
  if (!process.listenerCount('SIGTERM')) process.once('SIGTERM', () => shutdown('SIGTERM'))
  if (!process.listenerCount('SIGINT')) process.once('SIGINT', () => shutdown('SIGINT'))
}
