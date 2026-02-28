/**
 * Campaign Worker
 * Background worker that processes campaign jobs from the queue
 */

import { Worker, Job } from 'bullmq'
import { Redis } from 'ioredis'
import { QUEUE_NAMES, type CampaignLeadJobData } from '../campaign-queue'
import { processCampaignLeadStep, incrementDailyCounter } from '../../campaign-executor'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabase = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
})

console.log('🚀 Starting Campaign Worker...')

/** Random sleep between min and max ms */
function randomSleep(minMs: number, maxMs: number): Promise<void> {
  const duration = Math.random() * (maxMs - minMs) + minMs
  return new Promise(resolve => setTimeout(resolve, duration))
}

/** Check if current time is within working hours for a campaign */
async function isWithinWorkingHours(campaignId: string): Promise<{ ok: boolean; delayUntil?: number }> {
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('working_hours_start, working_hours_end, working_days, timezone')
    .eq('id', campaignId)
    .single()

  if (!campaign?.working_hours_start || !campaign?.working_hours_end) {
    return { ok: true }
  }

  const workDays: string[] = campaign.working_days ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  const tz = (campaign.timezone as string) || 'UTC'
  const [startH, startM] = (campaign.working_hours_start as string).split(':').map(Number)
  const [endH, endM] = (campaign.working_hours_end as string).split(':').map(Number)
  const startMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM

  // Use campaign's configured timezone (not machine local time)
  const now = new Date()
  const tzParts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now)
  const currentDayName = tzParts.find(p => p.type === 'weekday')?.value ?? 'Mon'
  const h = parseInt(tzParts.find(p => p.type === 'hour')?.value?.replace('24', '0') ?? '0')
  const m = parseInt(tzParts.find(p => p.type === 'minute')?.value ?? '0')
  const nowMinutes = h * 60 + m

  const inHours = workDays.includes(currentDayName) &&
    nowMinutes >= startMinutes && nowMinutes < endMinutes

  if (inHours) return { ok: true }

  // Find next working window start
  const nextStart = new Date(now)
  nextStart.setHours(startH, startM, 0, 0) // local-time approximation
  if (nextStart <= now) {
    nextStart.setDate(nextStart.getDate() + 1)
  }
  // Skip non-working days (check weekday in campaign timezone)
  for (let i = 0; i < 7; i++) {
    const candWeekday = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' })
      .formatToParts(nextStart).find(p => p.type === 'weekday')?.value ?? ''
    if (workDays.includes(candWeekday)) break
    nextStart.setDate(nextStart.getDate() + 1)
  }

  return { ok: false, delayUntil: nextStart.getTime() }
}

// Main campaign processor worker
const campaignWorker = new Worker<CampaignLeadJobData>(
  QUEUE_NAMES.CAMPAIGN_PROCESSOR,
  async (job: Job<CampaignLeadJobData>, token?: string) => {
    console.log(`\n📋 Processing job ${job.id}`)
    console.log(`   Campaign: ${job.data.campaign_id}`)
    console.log(`   Lead: ${job.data.lead_id}`)
    console.log(`   Step: ${job.data.step_type}`)

    // ── Phase 3.2: Working-hours pre-check ────────────────────────────────
    // If current time is outside the campaign's working window, delay the job
    // to the next window start WITHOUT consuming a retry attempt.
    const hoursCheck = await isWithinWorkingHours(job.data.campaign_id)
    if (!hoursCheck.ok && hoursCheck.delayUntil) {
      const delayMs = hoursCheck.delayUntil - Date.now()
      if (delayMs > 0) {
        console.log(
          `⏰ Job ${job.id} outside working hours — rescheduling in ${Math.round(delayMs / 60000)} min`
        )
        // moveToDelayed re-queues at the given timestamp; token prevents double-move
        await job.moveToDelayed(hoursCheck.delayUntil, token)
        return { rescheduled: true, reason: 'outside_working_hours' }
      }
    }

    // ── Phase 3.1: Inter-action random delay (humanize timing) ────────────
    // Fetch the campaign's configured min/max delay and sleep a random amount
    // before executing the Playwright action, mimicking human cadence.
    const { data: campSettings } = await supabase
      .from('campaigns')
      .select('delay_min_seconds, delay_max_seconds')
      .eq('id', job.data.campaign_id)
      .maybeSingle()

    const minMs = ((campSettings?.delay_min_seconds as number | null) ?? 45) * 1000
    const maxMs = ((campSettings?.delay_max_seconds as number | null) ?? 120) * 1000
    await randomSleep(minMs, maxMs)

    // ── Execute the step ──────────────────────────────────────────────────
    try {
      const result = await processCampaignLeadStep(job.data)
      
      console.log(`✅ Job ${job.id} completed successfully`)
      if (result && typeof result === 'object' && 'message' in result) {
        console.log(`   Result: ${(result as any).message}`)
      }
      
      return result
    } catch (error: any) {
      console.error(`❌ Job ${job.id} failed:`, error.message)
      throw error
    }
  },
  {
    connection: connection as any, // Type assertion to resolve ioredis version conflicts
    concurrency: 2, // Process 2 jobs concurrently (LinkedIn needs more time per job)
    lockDuration: 180000, // 3 min lock — job auto-moves to failed if worker dies mid-job
    stalledInterval: 30000, // Check for stalled jobs every 30s and re-queue them
    limiter: {
      max: 5, // Max 5 jobs per duration
      duration: 60000 // Per 60 seconds (1 minute)
    }
  }
)

// Event listeners
campaignWorker.on('completed', (job: Job) => {
  console.log(`✅ Job ${job.id} has been completed`)
})

campaignWorker.on('failed', (job: Job | undefined, err: Error) => {
  console.error(`❌ Job ${job?.id} has failed with error:`, err.message)
})

campaignWorker.on('error', (err: Error) => {
  console.error('⚠️  Worker error:', err)
})

campaignWorker.on('stalled', (jobId: string) => {
  console.warn(`⏸️  Job ${jobId} has stalled`)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n🛑 SIGTERM received, closing worker gracefully...')
  await campaignWorker.close()
  await connection.quit()
  console.log('👋 Worker closed')
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('\n🛑 SIGINT received, closing worker gracefully...')
  await campaignWorker.close()
  await connection.quit()
  console.log('👋 Worker closed')
  process.exit(0)
})

console.log('✅ Campaign Worker is ready and waiting for jobs...')
console.log(`   Queue: ${QUEUE_NAMES.CAMPAIGN_PROCESSOR}`)
console.log(`   Concurrency: 5`)
console.log(`   Rate limit: 10 jobs/minute`)
