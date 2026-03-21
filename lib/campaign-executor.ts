/**
 * Campaign Executor Service
 * Main orchestrator for campaign execution
 */

import { DbClient } from '@/lib/db/query-builder'
import { processTemplate, checkCharacterLimit } from './template-engine'
import { addCampaignLeadJob, addConnectionRequestJob, addMessageJob, addStatusCheckJob, campaignProcessorQueue } from './queue/campaign-queue'
import type { Campaign, CampaignLead, Lead, LinkedInAccount } from '@/types/linkedin'

let _supabase: DbClient | null = null
function getSupabase(): DbClient {
  if (!_supabase) {
    _supabase = new DbClient()
  }
  return _supabase
}
/** @deprecated Use getSupabase() — kept for compatibility with existing code */
const supabase = new Proxy({} as DbClient, {
  get(_target, prop) {
    return (getSupabase() as any)[prop]
  }
})

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Action-type → daily-counter column */
function actionCounterColumn(actionType: string): string {
  if (actionType === 'connection_request') return 'connections_sent'
  if (actionType === 'message') return 'messages_sent'
  if (actionType === 'inmail') return 'inmails_sent'
  if (actionType === 'view_profile') return 'profile_views'
  return 'total_actions'
}

/** Full action limit per type */
function fullDailyLimit(actionType: string): number {
  if (actionType === 'connection_request') return 50
  if (actionType === 'message') return 100
  if (actionType === 'inmail') return 25
  return 150
}

// ── Phase-2 new exports ───────────────────────────────────────────────────────

/**
 * 2.3  Upsert account_daily_counters and increment the relevant column
 */
export async function incrementDailyCounter(
  senderAccountId: string,
  actionType: string
): Promise<void> {
  const today = new Date().toISOString().split('T')[0]
  const col = actionCounterColumn(actionType)

  // Try insert first
  const { error: insertError } = await supabase
    .from('account_daily_counters')
    .insert({
      linkedin_account_id: senderAccountId,
      date: today,
      [col]: 1,
      total_actions: 1
    })

  if (insertError) {
    // Row already exists — use Postgres RPC for atomic increment to avoid race
    // conditions when concurrent workers read-then-write the same daily counter.
    const { error: rpcErr } = await supabase.rpc('increment_daily_counter', {
      p_account_id: senderAccountId,
      p_date: today,
      p_column: col,
    })
    if (rpcErr) {
      // Fallback: read-then-write (race-prone but better than nothing)
      console.warn('[incrementDailyCounter] RPC failed, falling back:', rpcErr.message)
      const { data: existing } = await supabase
        .from('account_daily_counters')
        .select('*')
        .eq('linkedin_account_id', senderAccountId)
        .eq('date', today)
        .single()

      if (existing) {
        const current = (existing[col] as number) || 0
        await supabase
          .from('account_daily_counters')
          .update({
            [col]: current + 1,
            total_actions: (existing.total_actions || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('linkedin_account_id', senderAccountId)
          .eq('date', today)
      }
    }
  }
}

/**
 * 2.4  Assign A/B variant (alternating based on even/odd count of existing leads)
 */
export async function assignVariant(
  campaignLeadId: string,
  campaignId: string
): Promise<'A' | 'B'> {
  const { count } = await supabase
    .from('campaign_leads')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)

  const variant: 'A' | 'B' = (count ?? 0) % 2 === 0 ? 'A' : 'B'

  await supabase
    .from('campaign_leads')
    .update({ variant })
    .eq('id', campaignLeadId)

  return variant
}

/**
 * 2.6  Auto-pause campaign if acceptance rate drops below threshold
 */
export async function checkAcceptanceRateCircuitBreaker(campaignId: string): Promise<void> {
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('connection_sent, connection_accepted, auto_pause_below_acceptance, status')
    .eq('id', campaignId)
    .single()

  if (!campaign || campaign.status !== 'active') return

  const sent = campaign.connection_sent || 0
  const accepted = campaign.connection_accepted || 0
  const threshold = campaign.auto_pause_below_acceptance ?? 0.15

  if (sent > 20) {
    const rate = accepted / sent
    if (rate < threshold) {
      await supabase
        .from('campaigns')
        .update({
          status: 'paused',
          paused_at: new Date().toISOString(),
          // store reason in description so UI can surface it
        })
        .eq('id', campaignId)

      console.log(
        `[Circuit Breaker] Campaign ${campaignId} auto-paused. Acceptance rate ${(rate * 100).toFixed(1)}% < ${(threshold * 100).toFixed(0)}% threshold`
      )
    }
  }
}

/**
 * 2.7  Generate AI icebreakers for all leads in a campaign (fire-and-forget)
 */
export async function generateAIIcebreakers(campaignId: string): Promise<void> {
  if (!process.env.OPENAI_API_KEY) {
    console.log('[AI Icebreaker] OPENAI_API_KEY not set, skipping')
    return
  }

  try {
    // Lazy import so that the file compiles even without the key
    const { OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const { data: campaignLeads } = await supabase
      .from('campaign_leads')
      .select('lead_id, lead:leads(id, full_name, first_name, position, company, location, ai_icebreaker)')
      .eq('campaign_id', campaignId)

    if (!campaignLeads || campaignLeads.length === 0) return

    // Filter leads that don't have an icebreaker yet
    const leadsNeedingIcebreaker = campaignLeads
      .map((cl: any) => cl.lead)
      .filter((lead: any) => lead && !lead.ai_icebreaker)

    // Process in batches of 10
    const BATCH = 10
    for (let i = 0; i < leadsNeedingIcebreaker.length; i += BATCH) {
      const batch = leadsNeedingIcebreaker.slice(i, i + BATCH)

      await Promise.allSettled(
        batch.map(async (lead: any) => {
          const fullName = lead.full_name || lead.first_name || 'the person'
          const position = lead.position || 'professional'
          const company = lead.company || 'their company'
          const location = lead.location || ''

          const response = await client.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'user',
                content: `Write a single natural-sounding sentence (max 20 words) that could open a LinkedIn message to ${fullName}, ${position} at ${company}${location ? ` in ${location}` : ''}. Make it specific to their role. No generic phrases. No emojis. Just the sentence.`
              }
            ],
            max_tokens: 60,
            temperature: 0.7
          })

          const icebreaker = response.choices[0]?.message?.content?.trim() || ''
          if (icebreaker) {
            await supabase
              .from('leads')
              .update({
                ai_icebreaker: icebreaker,
                ai_icebreaker_generated_at: new Date().toISOString()
              })
              .eq('id', lead.id)
          }
        })
      )
    }

    console.log(`[AI Icebreaker] Generated icebreakers for ${leadsNeedingIcebreaker.length} leads in campaign ${campaignId}`)
  } catch (err) {
    console.error('[AI Icebreaker] Error generating icebreakers:', err)
  }
}

/**
 * 2.8  Check if lead is already being contacted in another active campaign
 */
export async function skipAlreadyContactedCheck(
  leadId: string,
  currentCampaignId: string,
  skipEnabled: boolean
): Promise<boolean> {
  if (!skipEnabled) return false

  const { data } = await supabase
    .from('campaign_leads')
    .select('id, campaign:campaigns(status)')
    .eq('lead_id', leadId)
    .neq('campaign_id', currentCampaignId)
    .not('status', 'in', '("pending","failed","removed")')

  const activeEntries = (data || []).filter(
    (cl: any) => cl.campaign?.status === 'active'
  )

  return activeEntries.length > 0
}

/**
 * Start a campaign
 * Initializes campaign leads and queues initial jobs
 */
export async function startCampaign(campaignId: string, launchImmediately = false) {
  try {
    console.log(`[Campaign Executor] Starting campaign: ${campaignId}${launchImmediately ? ' (immediate)' : ''}`)

    // ── Stale job cleanup ──────────────────────────────────────────────────
    // Remove any leftover waiting/delayed jobs for this campaign from previous
    // runs before enqueuing fresh ones.  Active jobs are left alone (they are
    // currently being processed by a worker).
    try {
      const [waiting, delayed] = await Promise.all([
        campaignProcessorQueue.getWaiting(),
        campaignProcessorQueue.getDelayed(),
      ])
      const stale = [...waiting, ...delayed].filter(
        (j: any) => j.data?.campaign_id === campaignId
      )
      if (stale.length > 0) {
        for (const j of stale) {
          await j.remove().catch(() => {})
        }
        console.log(`[Campaign Executor] Removed ${stale.length} stale queued/delayed jobs for campaign ${campaignId}`)
      }

      // If jobs are currently active (being processed right now), warn but proceed.
      const active = await campaignProcessorQueue.getActive()
      const activeForCampaign = active.filter((j: any) => j.data?.campaign_id === campaignId)
      if (activeForCampaign.length > 0) {
        console.warn(`[Campaign Executor] ${activeForCampaign.length} jobs are currently active for campaign ${campaignId} — they will finish before new jobs start`)
      }
    } catch (guardErr: any) {
      // Guard failed (Redis not reachable) — proceed to attempt enqueue anyway
      console.warn('[Campaign Executor] Stale-job cleanup skipped:', guardErr.message)
    }
    
    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select(`
        *,
        campaign_senders(*, linkedin_account:linkedin_accounts(*))
      `)
      .eq('id', campaignId)
      .single()
    
    if (campaignError || !campaign) {
      throw new Error(`Campaign not found: ${campaignId}`)
    }
    
    // Get leads assigned to this campaign.
    // Fetch both 'pending' AND 'in_progress' leads.
    // 'in_progress' leads can get orphaned when Redis restarts (their BullMQ
    // jobs are lost) and must be re-enqueued from their current step so they
    // don't stay stuck forever.
    const { data: campaignLeads, error: leadsError } = await supabase
      .from('campaign_leads')
      .select('*, lead:leads(*)')
      .eq('campaign_id', campaignId)
      .in('status', ['pending', 'in_progress'])
    
    if (leadsError) {
      throw new Error(`Failed to fetch campaign leads: ${leadsError.message}`)
    }
    
    if (!campaignLeads || campaignLeads.length === 0) {
      console.log(`[Campaign Executor] No pending/in-progress leads found for campaign: ${campaignId}`)
      return { success: false, message: 'No pending leads to process' }
    }
    
    // Get first step of the campaign from campaign_sequences
    const { data: allSteps } = await supabase
      .from('campaign_sequences')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('step_number', { ascending: true })

    // Build a step-number lookup so in_progress leads resume from the right step
    const stepByNumber = new Map<number, any>(
      (allSteps || []).map((s: any) => [s.step_number, s])
    )

    const firstStep = allSteps?.[0]
    
    if (!firstStep) {
      throw new Error('No campaign steps found')
    }
    
    // Resolve valid sender accounts from campaign_senders
    // campaign_leads.sender_id is a FK to campaign_senders.id (NOT linkedin_accounts.id)
    // Build a map: campaign_senders.id → linkedin_accounts.id
    const senderRows: any[] = (campaign.campaign_senders || [])
      .filter((s: any) => s.linkedin_account?.status === 'active')

    if (senderRows.length === 0) {
      throw new Error('No active LinkedIn sender accounts linked to this campaign')
    }

    // Map campaign_senders.id → actual linkedin_account.id
    const senderMap = new Map<string, string>(
      senderRows.map((s: any) => [s.id, s.linkedin_account.id])
    )

    // ── Set campaign to active BEFORE enqueuing jobs ──────────────────────
    // Workers check campaign status when they pick up a job.  If we enqueue
    // first and set active second, there is a race window where a fast worker
    // sees the campaign as 'draft'/'paused' and throws.
    const updatePayload: any = {
      status: 'active',
      started_at: new Date().toISOString()
    }
    if (campaign.warm_up_enabled && !campaign.warm_up_start_date) {
      updatePayload.warm_up_start_date = new Date().toISOString()
    }
    await supabase
      .from('campaigns')
      .update(updatePayload)
      .eq('id', campaignId)
    console.log(`[Campaign Executor] Campaign ${campaignId} set to active`)

    // Queue jobs for each lead
    let queuedCount = 0
    let senderIdx = 0  // round-robin across senders

    for (const campaignLead of campaignLeads) {
      // For 'pending' leads: assign A/B variant and start from step 1.
      // For 'in_progress' leads: they were already started — resume from the
      // next step after their highest completed step (current_step_number).
      const isPending = campaignLead.status === 'pending'

      if (isPending) {
        await assignVariant(campaignLead.id, campaignId)
      }

      // Determine which step to start from
      let stepToEnqueue = firstStep
      if (!isPending) {
        const nextStepNumber = (campaignLead.current_step_number || 1) + 1
        const resumeStep = stepByNumber.get(nextStepNumber)
        if (!resumeStep) {
          // All steps already completed — mark as completed and skip
          await supabase
            .from('campaign_leads')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', campaignLead.id)
          console.log(`[Campaign Executor] in_progress lead ${campaignLead.id} has no remaining steps — marking completed`)
          continue
        }
        stepToEnqueue = resumeStep
        console.log(`[Campaign Executor] Resuming in_progress lead ${campaignLead.id} from step ${nextStepNumber}`)
      }

      // campaign_lead.sender_id is a campaign_senders.id → resolve to linkedin_account.id
      let resolvedLinkedInAccountId: string | undefined = senderMap.get(campaignLead.sender_id)
      if (!resolvedLinkedInAccountId) {
        // Fallback: round-robin across active senders
        resolvedLinkedInAccountId = senderRows[senderIdx % senderRows.length].linkedin_account.id as string
        senderIdx++
      }

      await queueCampaignLeadStep(
        campaign,
        campaignLead,
        stepToEnqueue,
        resolvedLinkedInAccountId,
        isPending ? launchImmediately : false  // in_progress leads always follow schedule
      )
      queuedCount++
    }
    
    // Fire-and-forget AI icebreaker generation
    generateAIIcebreakers(campaignId).catch(err =>
      console.error('[Campaign Executor] AI icebreaker error:', err)
    )
    
    console.log(`[Campaign Executor] Queued ${queuedCount} leads for campaign: ${campaignId}`)
    
    return {
      success: true,
      message: `Campaign started with ${queuedCount} leads`,
      queuedCount
    }
    
  } catch (error) {
    console.error('[Campaign Executor] Error starting campaign:', error)
    throw error
  }
}

/**
 * Pause a campaign
 * Stops processing new jobs but doesn't cancel existing ones
 */
export async function pauseCampaign(campaignId: string) {
  await supabase
    .from('campaigns')
    .update({
      status: 'paused',
      paused_at: new Date().toISOString()
    })
    .eq('id', campaignId)

  // Drain queued/delayed jobs so they don't fire against a paused campaign
  try {
    const [waiting, delayed] = await Promise.all([
      campaignProcessorQueue.getWaiting(),
      campaignProcessorQueue.getDelayed(),
    ])
    const toRemove = [...waiting, ...delayed].filter(
      (j: any) => j.data?.campaign_id === campaignId
    )
    for (const j of toRemove) await j.remove().catch(() => {})
    if (toRemove.length > 0) {
      console.log(`[pauseCampaign/executor] Removed ${toRemove.length} queued jobs for campaign ${campaignId}`)
    }
  } catch (e: any) {
    console.warn('[pauseCampaign/executor] Queue drain skipped:', e.message)
  }

  console.log(`[Campaign Executor] Paused campaign: ${campaignId}`)
  
  return { success: true, message: 'Campaign paused' }
}

/**
 * Resume a paused campaign
 */
export async function resumeCampaign(campaignId: string) {
  await supabase
    .from('campaigns')
    .update({
      status: 'active',
      paused_at: null
    })
    .eq('id', campaignId)
  
  // Re-queue pending leads
  const result = await startCampaign(campaignId)
  
  console.log(`[Campaign Executor] Resumed campaign: ${campaignId}`)
  
  // Return result with queuedCount
  return { 
    success: true, 
    message: 'Campaign resumed',
    queuedCount: result.queuedCount || 0
  }
}

/**
 * Stop a campaign completely
 */
export async function stopCampaign(campaignId: string) {
  await supabase
    .from('campaigns')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString()
    })
    .eq('id', campaignId)

  // Drain queued/delayed jobs from BullMQ so they don't fire against a completed campaign
  try {
    const [waiting, delayed] = await Promise.all([
      campaignProcessorQueue.getWaiting(),
      campaignProcessorQueue.getDelayed(),
    ])
    const toRemove = [...waiting, ...delayed].filter(
      (j: any) => j.data?.campaign_id === campaignId
    )
    for (const j of toRemove) await j.remove().catch(() => {})
    if (toRemove.length > 0) {
      console.log(`[stopCampaign] Removed ${toRemove.length} queued jobs for campaign ${campaignId}`)
    }
  } catch (e: any) {
    console.warn('[stopCampaign] Queue drain skipped:', e.message)
  }
  
  // Mark all pending/in_progress/paused leads as removed
  // in_progress leads whose BullMQ jobs were just drained would otherwise be stuck forever
  const { data: stoppedLeads } = await supabase
    .from('campaign_leads')
    .update({ status: 'removed' })
    .eq('campaign_id', campaignId)
    .in('status', ['pending', 'in_progress', 'paused'])
    .select()
  
  const stoppedCount = stoppedLeads?.length || 0
  
  console.log(`[Campaign Executor] Stopped campaign: ${campaignId}`)
  
  return { 
    success: true, 
    message: 'Campaign stopped',
    stoppedCount
  }
}

/**
 * Queue a campaign lead for processing
 */
async function queueCampaignLeadStep(
  campaign: any,
  campaignLead: any,
  step: any,
  senderAccountId: string,
  immediate = false
) {
  // immediate=true: bypass working-hours & step delay — fire within seconds (jitter only)
  const delay = immediate
    ? Math.random() * 5000 + 1000  // 1-6 second stagger so workers don't pile up
    : calculateDelay(step, campaign)

  await addCampaignLeadJob(
    {
      campaign_id: campaign.id,
      campaign_lead_id: campaignLead.id,
      lead_id: campaignLead.lead_id,
      sender_account_id: senderAccountId,
      step_id: step.id,
      step_type: step.step_type,
      message_template: step.message_template,
      subject_template: step.subject_template,
      delay_days: step.delay_days,
      delay_hours: step.delay_hours,
      immediate: immediate || undefined,
    },
    delay
  )
}

/**
 * 2.1  Calculate delay in milliseconds with random jitter and working-hours offset
 */
/** Return current day-name and minute-of-day in a specific IANA timezone */
function getNowInTz(tz: string): { dayName: string; nowMinutes: number } {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const weekday = parts.find(p => p.type === 'weekday')?.value ?? 'Mon'
  const h = parseInt(parts.find(p => p.type === 'hour')?.value?.replace('24', '0') ?? '0')
  const m = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0')
  return { dayName: weekday, nowMinutes: h * 60 + m }
}

/** Get the weekday name for a given Date in a specific timezone */
function getWeekdayInTz(date: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' })
    .formatToParts(date)
    .find(p => p.type === 'weekday')?.value ?? 'Mon'
}

export function calculateDelay(step: any, campaign?: any): number {
  const days = step.delay_days || 0
  const hours = step.delay_hours || 0
  const baseMs = (days * 86400 + hours * 3600) * 1000

  // Random jitter between min and max seconds
  const minSec = campaign?.delay_min_seconds ?? 45
  const maxSec = campaign?.delay_max_seconds ?? 120
  const jitterMs = (Math.random() * (maxSec - minSec) + minSec) * 1000

  let totalMs = baseMs + jitterMs

  // Working-hours adjustment — all checks done in campaign's configured timezone
  if (campaign?.working_hours_start && campaign?.working_hours_end) {
    const tz = campaign.timezone || 'UTC'
    const now = new Date()
    const workDays: string[] = campaign.working_days ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    const [startH, startM] = (campaign.working_hours_start as string).split(':').map(Number)
    const [endH, endM] = (campaign.working_hours_end as string).split(':').map(Number)
    const startMinutes = startH * 60 + startM
    const endMinutes = endH * 60 + endM

    // Use campaign timezone (not machine local time)
    const { dayName: currentDayName, nowMinutes } = getNowInTz(tz)

    const inWorkingHours = workDays.includes(currentDayName) &&
      nowMinutes >= startMinutes && nowMinutes < endMinutes

    if (!inWorkingHours) {
      // Advance candidate to next working window (approximate — worker will re-check on pickup)
      let candidateDate = new Date(now.getTime() + totalMs)

      for (let tries = 0; tries < 8; tries++) {
        const candWeekday = getWeekdayInTz(candidateDate, tz)
        const candParts = new Intl.DateTimeFormat('en-US', {
          timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
        }).formatToParts(candidateDate)
        const candH = parseInt(candParts.find(p => p.type === 'hour')?.value?.replace('24','0') ?? '0')
        const candM = parseInt(candParts.find(p => p.type === 'minute')?.value ?? '0')
        const candMinutes = candH * 60 + candM

        if (workDays.includes(candWeekday) && candMinutes >= startMinutes && candMinutes < endMinutes) {
          break
        }

        // Move to start of next working day (in local time — approximation)
        const nextStart = new Date(candidateDate)
        nextStart.setHours(startH, startM, 0, 0)
        if (nextStart <= candidateDate) {
          nextStart.setDate(nextStart.getDate() + 1)
        }
        candidateDate = nextStart
      }

      totalMs = candidateDate.getTime() - now.getTime()
    }
  }

  return Math.max(totalMs, jitterMs)
}

/**
 * Process a campaign lead step
 * Called by the worker when job is picked up
 */
export async function processCampaignLeadStep(jobData: {
  campaign_id: string
  campaign_lead_id: string
  lead_id: string
  sender_account_id: string
  step_id: string
  step_type: string
  message_template?: string
  subject_template?: string
}) {
  try {
    console.log(`[Campaign Executor] Processing step ${jobData.step_id} for lead ${jobData.lead_id}`)
    
    // Check if campaign is still active
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', jobData.campaign_id)
      .single()
    
    if (!campaign) {
      throw new Error(`Campaign not found: ${jobData.campaign_id}`)
    }
    if (campaign.status !== 'active') {
      // Throw so BullMQ marks this job as FAILED (not completed).
      // If the campaign is later resumed, startCampaign will re-enqueue fresh jobs.
      // Silently returning {success:false} caused BullMQ to mark jobs as 'completed'
      // which permanently orphaned the leads — they'd never be processed again.
      console.log(`[Campaign Executor] Campaign ${jobData.campaign_id} is ${campaign.status}, not active — job will fail`)
      throw new Error(`Campaign is ${campaign.status}, not active`)
    }
    
    // Check if lead has replied (stop-on-reply)
    const { data: campaignLead } = await supabase
      .from('campaign_leads')
      .select('replied_at, status, variant')
      .eq('id', jobData.campaign_lead_id)
      .single()
    
    if (campaignLead?.replied_at || campaignLead?.status === 'replied') {
      // Ensure lead is marked completed so it doesn't stay in_progress forever
      if (campaignLead.status === 'in_progress') {
        await supabase
          .from('campaign_leads')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', jobData.campaign_lead_id)
      }
      console.log(`[Campaign Executor] Lead ${jobData.lead_id} has replied, stopping sequence`)
      return { success: false, message: 'Lead replied, sequence stopped' }
    }

    // ── Phase 2.5: A/B Variant template selection ─────────────────────────
    // If the lead is assigned variant 'B' and the campaign step has
    // ab_test_enabled=true with a message_template_b, use template B.
    let resolvedMessageTemplate = jobData.message_template
    if (jobData.step_id && campaignLead?.variant === 'B') {
      const { data: stepRow } = await supabase
        .from('campaign_sequences')
        .select('ab_test_enabled, message_template_b')
        .eq('id', jobData.step_id)
        .maybeSingle()

      if (stepRow?.ab_test_enabled && stepRow.message_template_b) {
        resolvedMessageTemplate = stepRow.message_template_b
        console.log(`[Campaign Executor] Using Variant B template for lead ${jobData.lead_id}`)
      }
    }
    
    // Get lead details
    const { data: lead } = await supabase
      .from('leads')
      .select('*')
      .eq('id', jobData.lead_id)
      .single()
    
    if (!lead) {
      throw new Error(`Lead not found: ${jobData.lead_id}`)
    }
    
    // Get sender account with proxy data (JOIN proxies table to resolve proxy URL)
    const { data: senderAccount } = await supabase
      .from('linkedin_accounts')
      .select('*, proxy:proxies(*)')
      .eq('id', jobData.sender_account_id)
      .single()
    
    if (!senderAccount) {
      throw new Error(`Sender account not found: ${jobData.sender_account_id}`)
    }

    // Resolve proxy_config from the joined proxy record (Playwright native proxy support)
    if (senderAccount.proxy) {
      const { buildPlaywrightProxyConfig } = await import('./utils/proxy-helpers')
      const proxyRecord = Array.isArray(senderAccount.proxy) ? senderAccount.proxy[0] : senderAccount.proxy
      if (proxyRecord) {
        ;(senderAccount as any).proxy_config = buildPlaywrightProxyConfig(proxyRecord)
        console.log(`[Campaign Executor] Using proxy for account ${jobData.sender_account_id}: ${(senderAccount as any).proxy_config.server}`)
      }
    }

    // Fast-fail if the account has been disconnected (e.g. by a concurrent job
    // that detected expired cookies).  This prevents wasting a Playwright
    // browser launch when we already know the session is dead.
    if (senderAccount.status === 'disconnected') {
      console.log(`[Campaign Executor] Account ${jobData.sender_account_id} is disconnected — pausing campaign`)
      await pauseCampaign(jobData.campaign_id)
      throw new Error(`LinkedIn account is disconnected: ${senderAccount.error_message || 'session expired'}`)
    }
    
    // Check daily limits
    const canSend = await checkDailyLimit(jobData.sender_account_id, jobData.step_type, campaign)
    if (!canSend) {
      console.log(`[Campaign Executor] Daily limit reached for account ${jobData.sender_account_id}`)
      // Re-queue for tomorrow
      const tomorrowDelay = 24 * 60 * 60 * 1000
      await addCampaignLeadJob(jobData, tomorrowDelay)
      return { success: false, message: 'Daily limit reached, re-queued for tomorrow' }
    }
    
    // Process template if exists
    let processedMessage = ''
    let processedSubject = ''
    
    if (resolvedMessageTemplate) {
      processedMessage = processTemplate(resolvedMessageTemplate, lead)
      
      // Check character limit
      const messageType = jobData.step_type === 'connection_request' 
        ? 'connection_note' 
        : jobData.step_type === 'inmail' 
          ? 'inmail' 
          : 'message'
      
      const limitCheck = checkCharacterLimit(processedMessage, messageType)
      if (!limitCheck.valid) {
        console.warn(`[Campaign Executor] Message exceeds character limit by ${limitCheck.overflow} chars`)
        processedMessage = processedMessage.substring(0, limitCheck.limit)
      }
    }
    
    if (jobData.subject_template) {
      processedSubject = processTemplate(jobData.subject_template, lead)
    }
    
    // Execute the appropriate action based on step type
    let result
    switch (jobData.step_type) {
      case 'connection_request':
        result = await sendConnectionRequest(senderAccount, lead, processedMessage)
        break
      case 'message':
        result = await sendMessage(senderAccount, lead, processedMessage)
        break
      case 'inmail':
        result = await sendInMail(senderAccount, lead, processedSubject, processedMessage)
        break
      case 'delay':
        result = { success: true, message: 'Delay step completed' }
        break
      case 'view_profile':
        // View profile is a lightweight action — we just visit the profile URL
        // The actual page visit happens during the sendConnectionRequest/sendMessage
        // automation, but as a standalone step it's a soft touch (profile view).
        result = { success: true, message: 'Profile view step completed' }
        break
      case 'follow':
        // Follow step — soft engagement before connecting
        result = { success: true, message: 'Follow step completed' }
        break
      case 'like_post':
        // Like post step — requires post_url in the step config
        result = { success: true, message: 'Like post step completed' }
        break
      case 'email':
        // Email step — external email, not LinkedIn automation
        result = { success: true, message: 'Email step completed (external)' }
        break
      default:
        console.warn(`[Campaign Executor] Unknown step type: ${jobData.step_type} — treating as no-op`)
        result = { success: true, message: `Step type '${jobData.step_type}' not implemented yet` }
        break
    }
    
    if (result.success) {
      // Update campaign lead status
      await updateCampaignLeadStatus(jobData.campaign_lead_id, jobData.step_type, jobData.step_id)
      
      // Update campaign sender stats
      await updateSenderStats(jobData.campaign_id, jobData.sender_account_id, jobData.step_type)

      // Increment daily counter for warm-up and rate limiting
      await incrementDailyCounter(jobData.sender_account_id, jobData.step_type)

      // Fire outbound webhooks (fire-and-forget)
      const webhookEvent =
        jobData.step_type === 'connection_request' ? 'connection_sent' :
        jobData.step_type === 'message' ? 'message_sent' :
        jobData.step_type === 'inmail' ? 'message_sent' : null

      if (webhookEvent) {
        triggerWebhook(
          webhookEvent as any,
          jobData.campaign_id,
          campaign.name || '',
          lead ? {
            id: lead.id,
            full_name: lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
            company: lead.company,
            position: lead.position,
            linkedin_url: lead.linkedin_url,
          } : undefined
        ).catch(err => console.error('[Webhook] Error:', err))
      }

      // Check circuit breaker asynchronously
      checkAcceptanceRateCircuitBreaker(jobData.campaign_id).catch(err =>
        console.error('[Circuit Breaker] Error:', err)
      )
      
      // Queue next step if exists
      await queueNextStep(jobData.campaign_id, jobData.campaign_lead_id, jobData.step_id, jobData.sender_account_id)

    } else if (
      jobData.step_type === 'connection_request' &&
      (['Already connected', 'Already pending', 'Invitation already sent'].includes((result as any).error))
    ) {
      // Lead is already connected or request already sent — treat as accepted and advance.
      const alreadyConnected = (result as any).error === 'Already connected'
      console.log(`[Campaign Executor] Lead ${jobData.lead_id} — ${(result as any).error} — advancing to next step`)

      const { error: updErr } = await supabase
        .from('campaign_leads')
        .update({
          status: 'in_progress',
          connection_sent_at: new Date().toISOString(),
          ...(alreadyConnected ? { connection_accepted_at: new Date().toISOString() } : {}),
          current_step_number: 2,
        })
        .eq('id', jobData.campaign_lead_id)

      if (updErr) {
        console.error(`[Campaign Executor] Failed to update lead status:`, updErr.message)
      }

      await queueNextStep(jobData.campaign_id, jobData.campaign_lead_id, jobData.step_id, jobData.sender_account_id)

    } else {
      // result.success === false and not an "advance anyway" case.
      // ── Permanent failures: mark lead failed, do NOT retry ────────────────
      const errMsg: string = (result as any).error || 'Unknown error'
      const permanentErrors = [
        'Profile not found',           // 404 page
        'Not connected - cannot send message', // no connection yet
        'InMail not available',        // requires Premium
        'InMail button not found',     // no InMail option on profile
        'Message interface not found', // messaging UI didn't load
        'Connect button not found',    // can't send connection request
      ]
      const isPermanent = permanentErrors.some(e => errMsg.includes(e))

      if (isPermanent) {
        console.log(`[Campaign Executor] Lead ${jobData.lead_id} permanently failed: ${errMsg}`)
        await supabase
          .from('campaign_leads')
          .update({ status: 'failed' })
          .eq('id', jobData.campaign_lead_id)
      } else {
        // Retryable failure (auth error, timeout, page error) — throw so BullMQ retries
        console.error(`[Campaign Executor] Lead ${jobData.lead_id} retryable failure: ${errMsg}`)
        throw new Error(errMsg)
      }
    }

    return result
    
  } catch (error) {
    console.error('[Campaign Executor] Error processing step:', error)
    throw error
  }
}

/**
 * 2.2  Check daily limit with warm-up ramp support
 */
export async function checkDailyLimit(
  senderAccountId: string,
  actionType: string,
  campaign?: any
): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0]
  const col = actionCounterColumn(actionType)
  const limit = fullDailyLimit(actionType)

  // Calculate effective limit (warm-up ramp)
  let effectiveLimit = limit
  if (campaign?.warm_up_enabled && campaign?.warm_up_start_date) {
    const startDate = new Date(campaign.warm_up_start_date)
    const diffDays = Math.floor((Date.now() - startDate.getTime()) / 86400000)
    const warmUpDays = campaign.warm_up_days ?? 14
    effectiveLimit = Math.min(
      5 + Math.floor(diffDays * (limit - 5) / warmUpDays),
      limit
    )
  }

  // Check today's count from account_daily_counters
  const { data: counter } = await supabase
    .from('account_daily_counters')
    .select('*')
    .eq('linkedin_account_id', senderAccountId)
    .eq('date', today)
    .maybeSingle()

  const usedToday = counter ? (counter[col] as number) || 0 : 0
  if (usedToday >= effectiveLimit) return false

  // Additional weekly rolling limit for connection requests (LinkedIn: ~100/week)
  if (actionType === 'connection_request') {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]

    const { data: weeklyCounters } = await supabase
      .from('account_daily_counters')
      .select('connections_sent')
      .eq('linkedin_account_id', senderAccountId)
      .gte('date', sevenDaysAgoStr)

    const weeklyTotal = (weeklyCounters || []).reduce(
      (sum: any, row: any) => sum + ((row.connections_sent as number) || 0),
      0
    )

    const WEEKLY_CONNECTION_LIMIT = 100
    if (weeklyTotal >= WEEKLY_CONNECTION_LIMIT) {
      console.log(
        `[Daily Limit] Weekly connection limit reached for ${senderAccountId}: ${weeklyTotal}/${WEEKLY_CONNECTION_LIMIT}`
      )
      return false
    }
  }

  return true
}

/**
 * Update campaign lead status after action
 */
async function updateCampaignLeadStatus(campaignLeadId: string, stepType: string, stepId?: string) {
  const updates: any = {
    status: 'in_progress',
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
  
  if (stepType === 'connection_request') {
    updates.connection_sent_at = new Date().toISOString()
  } else if (stepType === 'message') {
    updates.first_message_sent_at = new Date().toISOString()
  }

  // Track current step number so in_progress leads can resume from the right
  // step after a server restart (startCampaign uses current_step_number + 1).
  if (stepId) {
    const { data: step } = await supabase.from('campaign_sequences')
      .select('step_number').eq('id', stepId).maybeSingle()
    if (step) updates.current_step_number = step.step_number
  }
  
  const { error } = await supabase
    .from('campaign_leads')
    .update(updates)
    .eq('id', campaignLeadId)

  if (error) {
    console.error(`[Campaign Executor] updateCampaignLeadStatus failed:`, error.message)
  }
}

/**
 * Update sender statistics (direct column update — no RPC needed)
 * Also keeps the campaigns table aggregate counters in sync so the
 * circuit breaker (checkAcceptanceRateCircuitBreaker) has real data.
 */
async function updateSenderStats(campaignId: string, senderAccountId: string, stepType: string) {
  // Use Postgres RPC for atomic increment to avoid race conditions when
  // concurrent workers read-then-write the same counter simultaneously.
  // Fallback: direct column arithmetic via raw .rpc or SELECT ... + 1
  if (stepType === 'connection_request') {
    // Atomic increment on campaign_senders
    const { error: senderErr } = await supabase.rpc('increment_sender_stat', {
      p_campaign_id: campaignId,
      p_account_id: senderAccountId,
      p_column: 'connection_sent',
    })
    if (senderErr) {
      console.warn('[updateSenderStats] RPC failed, falling back to direct update:', senderErr.message)
      // Fallback: fetch current value and increment (race-prone but better than nothing)
      const { data: current } = await supabase.from('campaign_senders')
        .select('connection_sent')
        .eq('campaign_id', campaignId)
        .eq('linkedin_account_id', senderAccountId)
        .single()
      await supabase.from('campaign_senders')
        .update({ connection_sent: (current?.connection_sent ?? 0) + 1 })
        .eq('campaign_id', campaignId)
        .eq('linkedin_account_id', senderAccountId)
    }

    // Atomic increment on campaigns aggregate
    const { error: campErr } = await supabase.rpc('increment_campaign_stat', {
      p_campaign_id: campaignId,
      p_column: 'connection_sent',
    })
    if (campErr) {
      console.warn('[updateSenderStats] Campaign RPC failed:', campErr.message)
    }
  } else if (stepType === 'message' || stepType === 'inmail') {
    const { error: senderMsgErr } = await supabase.rpc('increment_sender_stat', {
      p_campaign_id: campaignId,
      p_account_id: senderAccountId,
      p_column: 'messages_sent',
    })
    if (senderMsgErr) {
      console.warn('[updateSenderStats] Sender messages_sent RPC failed:', senderMsgErr.message)
    }

    const { error: campMsgErr } = await supabase.rpc('increment_campaign_stat', {
      p_campaign_id: campaignId,
      p_column: 'messages_sent',
    })
    if (campMsgErr) {
      console.warn('[updateSenderStats] Campaign messages_sent RPC failed:', campMsgErr.message)
    }
  }
}

/**
 * Queue the next step in the sequence
 */
async function queueNextStep(
  campaignId: string,
  campaignLeadId: string,
  currentStepId: string,
  senderAccountId: string
) {
  // Find next step by step_number (sequence-based, not tree-based)
  const { data: currentStep } = await supabase
    .from('campaign_sequences')
    .select('step_number')
    .eq('id', currentStepId)
    .single()

  // Fetch ALL remaining steps (not just limit 1) so we can skip steps
  // whose condition_type is not met and advance to the next eligible one.
  const { data: remainingSteps } = await supabase
    .from('campaign_sequences')
    .select('*')
    .eq('campaign_id', campaignId)
    .gt('step_number', currentStep?.step_number ?? 0)
    .order('step_number', { ascending: true })

  if (!remainingSteps || remainingSteps.length === 0) {
    // No more steps, mark as completed
    const { error: doneErr } = await supabase
      .from('campaign_leads')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', campaignLeadId)
    if (doneErr) console.error(`[queueNextStep] mark-completed failed:`, doneErr.message)
    console.log(`[Campaign Executor] Campaign lead ${campaignLeadId} completed all steps`)
    return
  }

  // Get campaign lead data (needed for condition evaluation + queueing)
  const { data: campaignLead } = await supabase
    .from('campaign_leads')
    .select('*, lead:leads(*)')
    .eq('id', campaignLeadId)
    .single()

  // Evaluate condition_type for each remaining step and pick the first eligible one
  let nextStep: any = null
  for (const step of remainingSteps) {
    const condition = step.condition_type as string | null
    if (!condition) {
      // No condition — always eligible
      nextStep = step
      break
    }

    const hasAccepted = !!campaignLead?.connection_accepted_at
    const hasReplied = !!campaignLead?.replied_at || campaignLead?.status === 'replied'

    if (condition === 'accepted' && hasAccepted) {
      nextStep = step
      break
    } else if (condition === 'not_accepted' && !hasAccepted) {
      nextStep = step
      break
    } else if (condition === 'replied' && hasReplied) {
      nextStep = step
      break
    } else if (condition === 'not_replied' && !hasReplied) {
      nextStep = step
      break
    } else {
      // Condition not met — skip this step and try the next one
      console.log(`[queueNextStep] Skipping step ${step.step_number} (condition '${condition}' not met for lead ${campaignLeadId})`)
      continue
    }
  }

  if (!nextStep) {
    // All remaining steps had unmet conditions — mark lead as completed
    const { error: doneErr } = await supabase
      .from('campaign_leads')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', campaignLeadId)
    if (doneErr) console.error(`[queueNextStep] mark-completed failed:`, doneErr.message)
    console.log(`[Campaign Executor] Campaign lead ${campaignLeadId} completed (no eligible steps remain)`)
    return
  }

  // Get campaign data
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single()

  await queueCampaignLeadStep(campaign, campaignLead, nextStep, senderAccountId)
}

// Real automation functions using Playwright
import {
  sendConnectionRequest as sendConnectionRequestViaLinkedIn,
  sendMessage as sendMessageViaLinkedIn,
  sendInMail as sendInMailViaLinkedIn,
} from './linkedin-campaign-automation';
import { sessionCookiesToPlaywright } from './linkedin-cookie-auth';
import { triggerWebhook } from './webhook';

async function sendConnectionRequest(account: any, lead: any, message: string) {
  console.log(`[Automation] Sending connection request to ${lead.full_name} (${lead.linkedin_url})`);
  
  // NOTE: Do NOT wrap in try/catch that returns {success:false}.
  // If Playwright throws (timeout, navigation error, auth failure), we MUST
  // let the error propagate so BullMQ marks the job as failed and retries it.
  // The automation function itself already handles known failure modes and
  // returns {success: false, error: '...'} for those — only unexpected crashes throw.
  const result = await sendConnectionRequestViaLinkedIn(
    {
      id: account.id,
      email: account.email,
      password: account.password_encrypted || account.password || '',
      cookies: account.session_cookies ? sessionCookiesToPlaywright(account.session_cookies) : [],
      proxy_config: account.proxy_config,
    },
    {
      linkedin_url: lead.linkedin_url,
      first_name: lead.first_name,
      last_name: lead.last_name,
      full_name: lead.full_name,
      company: lead.company,
      position: lead.position,
    },
    message
  );

  return result;
}

async function sendMessage(account: any, lead: any, message: string) {
  console.log(`[Automation] Sending message to ${lead.full_name} (${lead.linkedin_url})`);
  
  try {
    const result = await sendMessageViaLinkedIn(
      {
        id: account.id,
        email: account.email,
        password: account.password_encrypted || account.password || '',
        cookies: account.session_cookies ? sessionCookiesToPlaywright(account.session_cookies) : [],
        proxy_config: account.proxy_config,
      },
      {
        linkedin_url: lead.linkedin_url,
        first_name: lead.first_name,
        last_name: lead.last_name,
        full_name: lead.full_name,
        company: lead.company,
        position: lead.position,
      },
      message
    );

    return result;
  } catch (error: any) {
    console.error('[Automation] Message sending error:', error);
    // Re-throw so BullMQ marks the job as failed and retries.
    // Never silently return {success:false} — that makes BullMQ mark the job
    // as "completed" when it actually failed, losing all retry logic.
    throw error;
  }
}

async function sendInMail(account: any, lead: any, subject: string, message: string) {
  console.log(`[Automation] Sending InMail to ${lead.full_name} (${lead.linkedin_url})`);
  
  try {
    const result = await sendInMailViaLinkedIn(
      {
        id: account.id,
        email: account.email,
        password: account.password_encrypted || account.password || '',
        cookies: account.session_cookies ? sessionCookiesToPlaywright(account.session_cookies) : [],
        proxy_config: account.proxy_config,
      },
      {
        linkedin_url: lead.linkedin_url,
        first_name: lead.first_name,
        last_name: lead.last_name,
        full_name: lead.full_name,
        company: lead.company,
        position: lead.position,
      },
      subject,
      message
    );

    return result;
  } catch (error: any) {
    console.error('[Automation] InMail sending error:', error);
    // Re-throw so BullMQ marks the job as failed and retries.
    throw error;
  }
}

const campaignExecutor = {
  startCampaign,
  pauseCampaign,
  resumeCampaign,
  stopCampaign,
  processCampaignLeadStep
}

export default campaignExecutor
