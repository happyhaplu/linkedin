'use server'

import { createClient, createServiceRoleClient } from '@/lib/db/server'
import { revalidatePath } from 'next/cache'
import type {
  Campaign,
  CampaignSender,
  CampaignSequence,
  CampaignLead,
  CampaignActivityLog,
  CampaignFilters,
  CampaignLeadFilters,
  CampaignStats,
  CreateCampaignInput,
  UpdateCampaignInput,
  LinkedInAccount,
  Lead,
  CampaignAnalytics,
  CampaignTemplate
} from '@/types/linkedin'

// =============================================
// HELPERS
// =============================================

/**
 * Normalise a working-hours value to HH:MM for Postgres TIME columns.
 * Handles: '09:00', '9:00', '9', 9 → all become '09:00'.
 */
function normalizeTime(val: string | number | undefined | null, fallback: string): string {
  if (val === undefined || val === null || val === '') return fallback
  const s = String(val).trim()
  // Already HH:MM or HH:MM:SS
  if (/^\d{1,2}:\d{2}/.test(s)) {
    const [h, m] = s.split(':')
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`
  }
  // Bare number like '9' or '18'
  const n = parseInt(s, 10)
  if (!isNaN(n) && n >= 0 && n <= 23) return `${String(n).padStart(2, '0')}:00`
  return fallback
}

// =============================================
// CAMPAIGN CRUD OPERATIONS
// =============================================

/**
 * Get all campaigns for the current user
 */
export async function getCampaigns(filters?: CampaignFilters) {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  let query = supabase
    .from('campaigns')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Apply filters
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.search) {
    // Sanitize: remove characters that could break PostgREST filter syntax
    const sanitized = filters.search.replace(/[%_(),.]/g, '')
    if (sanitized.length > 0) {
      query = query.or(`name.ilike.%${sanitized}%,description.ilike.%${sanitized}%`)
    }
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching campaigns:', error)
    throw error
  }

  // Fetch senders separately if we have campaigns
  if (data && data.length > 0) {
    const campaignIds = data.map((c: any) => c.id)
    const { data: sendersData } = await supabase
      .from('campaign_senders')
      .select(`
        id,
        campaign_id,
        linkedin_account_id,
        is_active,
        linkedin_account:linkedin_accounts(id, email, profile_name)
      `)
      .in('campaign_id', campaignIds)

    // Attach senders to campaigns
    const campaignsWithSenders = data.map((campaign: any) => ({
      ...campaign,
      senders: sendersData?.filter((s: any) => s.campaign_id === campaign.id) || []
    }))

    return campaignsWithSenders as (Campaign & { lead_list?: any, senders?: any[] })[]
  }

  return data as (Campaign & { lead_list?: any, senders?: any[] })[]
}

/**
 * Get a single campaign by ID
 */
export async function getCampaignById(campaignId: string) {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .eq('user_id', user.id)
    .single()

  if (error) {
    console.error('Error fetching campaign:', error)
    throw error
  }

  // Fetch related data separately
  const [sendersResult, sequencesResult] = await Promise.all([
    supabase
      .from('campaign_senders')
      .select(`
        id,
        is_active,
        daily_limit,
        leads_assigned,
        connection_sent,
        connection_accepted,
        messages_sent,
        replies_received,
        linkedin_account:linkedin_accounts(id, email, profile_name, profile_picture_url)
      `)
      .eq('campaign_id', campaignId),
    supabase
      .from('campaign_sequences')
      .select('*')
      .eq('campaign_id', campaignId)
  ])

  return {
    ...data,
    senders: sendersResult.data || [],
    sequences: sequencesResult.data || []
  } as Campaign & { lead_list?: any, senders?: any[], sequences?: CampaignSequence[] }
}

/**
 * Create a new campaign
 */
export async function createCampaign(input: CreateCampaignInput) {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  // Start a transaction by creating campaign first
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .insert({
      user_id: user.id,
      name: input.name,
      description: input.description,
      lead_list_id: input.lead_list_id,
      daily_limit: input.daily_limit || 50,
      timezone: input.timezone || 'UTC',
      status: 'draft',
      // Safety settings — normalise to HH:MM for Postgres TIME column
      working_hours_start: normalizeTime(input.working_hours_start, '08:00'),
      working_hours_end: normalizeTime(input.working_hours_end, '18:00'),
      working_days: input.working_days || ['Mon','Tue','Wed','Thu','Fri'],
      delay_min_seconds: input.delay_min_seconds ?? 45,
      delay_max_seconds: input.delay_max_seconds ?? 120,
      warm_up_enabled: input.warm_up_enabled ?? false,
      warm_up_days: input.warm_up_days ?? 14,
      auto_pause_below_acceptance: input.auto_pause_below_acceptance != null
        ? input.auto_pause_below_acceptance / 100  // UI sends 10 (=10%), DB stores 0.10
        : 0.15,
      skip_already_contacted: input.skip_already_contacted ?? true,
      stop_on_reply: input.stop_on_reply ?? true
    })
    .select()
    .single()

  if (campaignError || !campaign) {
    console.error('Error creating campaign:', campaignError)
    throw campaignError
  }

  // Add campaign senders
  if (input.sender_ids && input.sender_ids.length > 0) {
    const sendersData = input.sender_ids.map((senderId: any) => ({
      campaign_id: campaign.id,
      linkedin_account_id: senderId,
      is_active: true,
      daily_limit: input.daily_limit || 50
    }))

    const { error: sendersError } = await supabase
      .from('campaign_senders')
      .insert(sendersData)

    if (sendersError) {
      console.error('Error adding campaign senders:', sendersError)
      // Rollback - delete campaign
      await supabase.from('campaigns').delete().eq('id', campaign.id)
      throw sendersError
    }
  }

  // Add campaign sequences
  if (input.sequences && input.sequences.length > 0) {
    const sequencesData = input.sequences.map((seq: any) => ({
      campaign_id: campaign.id,
      step_number: seq.step_number,
      step_type: seq.step_type,
      message_template: seq.message_template,
      message_template_b: seq.message_template_b,
      ab_test_enabled: seq.ab_test_enabled ?? false,
      subject_template: seq.subject_template,
      post_url: seq.post_url,
      delay_days: seq.delay_days || 0,
      delay_hours: seq.delay_hours || 0,
      condition_type: seq.condition_type,
      parent_step_id: seq.parent_step_id
    }))

    const { error: sequencesError } = await supabase
      .from('campaign_sequences')
      .insert(sequencesData)

    if (sequencesError) {
      console.error('Error adding campaign sequences:', sequencesError)
      // Rollback
      await supabase.from('campaign_senders').delete().eq('campaign_id', campaign.id)
      await supabase.from('campaigns').delete().eq('id', campaign.id)
      throw sequencesError
    }
  }

  // Auto-populate campaign_leads from the selected lead list
  if (input.lead_list_id) {
    const { data: listLeads } = await supabase
      .from('leads')
      .select('id')
      .eq('list_id', input.lead_list_id)
      .eq('user_id', user.id)

    if (listLeads && listLeads.length > 0) {
      const { data: campaignSenders } = await supabase
        .from('campaign_senders')
        .select('id')
        .eq('campaign_id', campaign.id)
        .eq('is_active', true)

      const leadsToInsert = listLeads.map((ll: any, idx: number) => ({
        campaign_id: campaign.id,
        lead_id: ll.id,
        sender_id: campaignSenders && campaignSenders.length > 0
          ? campaignSenders[idx % campaignSenders.length].id
          : null,
        status: 'pending' as const
      }))

      // Insert in batches of 500 to avoid payload limits
      for (let i = 0; i < leadsToInsert.length; i += 500) {
        await supabase.from('campaign_leads').insert(leadsToInsert.slice(i, i + 500))
      }
    }
  }

  return campaign as Campaign
}

/**
 * Update campaign
 */
export async function updateCampaign(campaignId: string, input: UpdateCampaignInput) {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  // Normalize time fields so Postgres TIME column always receives HH:MM
  const normalized: UpdateCampaignInput = { ...input }
  if (input.working_hours_start !== undefined) {
    normalized.working_hours_start = normalizeTime(input.working_hours_start, '08:00')
  }
  if (input.working_hours_end !== undefined) {
    normalized.working_hours_end = normalizeTime(input.working_hours_end, '18:00')
  }

  const { data, error } = await supabase
    .from('campaigns')
    .update(normalized)
    .eq('id', campaignId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    console.error('Error updating campaign:', error)
    throw error
  }

  return data as Campaign
}

/**
 * Delete campaign
 */
export async function deleteCampaign(campaignId: string) {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  const { error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', campaignId)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error deleting campaign:', error)
    throw error
  }

  return { success: true }
}

/**
 * Start/Resume campaign — sets status to active AND enqueues pending leads into the job queue
 */
export async function startCampaign(campaignId: string, launchImmediately = false) {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  // Remember original status so we can roll back correctly on failure
  const { data: original } = await supabase
    .from('campaigns')
    .select('status, daily_limit')
    .eq('id', campaignId)
    .eq('user_id', user.id)
    .single()
  const rollbackStatus = original?.status || 'draft'

  // ── Auto-assign senders if none exist ──────────────────────────────
  const adminDb = createServiceRoleClient()
  const { data: existingSenders } = await adminDb
    .from('campaign_senders')
    .select('id')
    .eq('campaign_id', campaignId)
    .limit(1)

  if (!existingSenders || existingSenders.length === 0) {
    console.log('[startCampaign] No senders found — auto-assigning active LinkedIn accounts')
    const { data: activeAccounts } = await adminDb
      .from('linkedin_accounts')
      .select('id, email')
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (!activeAccounts || activeAccounts.length === 0) {
      throw new Error('No active LinkedIn accounts. Please connect a LinkedIn account first.')
    }

    const sendersToInsert = activeAccounts.map((acct: any) => ({
      campaign_id: campaignId,
      linkedin_account_id: acct.id,
      is_active: true,
      daily_limit: original?.daily_limit || 50,
    }))

    const { error: senderInsertErr } = await adminDb
      .from('campaign_senders')
      .insert(sendersToInsert)

    if (senderInsertErr) {
      console.error('[startCampaign] Failed to auto-assign senders:', senderInsertErr)
      throw new Error('Failed to assign LinkedIn accounts to campaign')
    }
    console.log(`[startCampaign] Auto-assigned ${activeAccounts.length} sender(s): ${activeAccounts.map((a: any) => a.email).join(', ')}`)
  }

  // Enqueue jobs for all pending leads via the campaign executor.
  // The executor sets status → 'active' before queuing jobs (to avoid race
  // conditions with workers that check campaign status).  If it fails we
  // roll the status back so the campaign doesn't appear active while nothing
  // is actually running.
  try {
    const { startCampaign: executorStart } = await import('@/lib/campaign-executor')
    const execResult = await executorStart(campaignId, launchImmediately)
    if (!execResult.success) {
      // Executor returned failure (e.g. no pending leads, no active sender)
      await supabase
        .from('campaigns')
        .update({ status: rollbackStatus, started_at: null })
        .eq('id', campaignId)
      throw new Error(execResult.message || 'Campaign executor failed to start')
    }
  } catch (queueErr: any) {
    // Roll back status to whatever it was before
    await supabase
      .from('campaigns')
      .update({ status: rollbackStatus, started_at: null })
      .eq('id', campaignId)
    throw new Error(`Failed to start campaign: ${queueErr.message}`)
  }

  // Fetch and return the now-active campaign
  const { data: activeCampaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single()

  return activeCampaign as Campaign
}

/**
 * Pause campaign — sets status to paused AND drains all queued jobs
 * so they don't fire later when the campaign is no longer active.
 */
export async function pauseCampaign(campaignId: string) {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  const { data, error } = await supabase
    .from('campaigns')
    .update({
      status: 'paused',
      paused_at: new Date().toISOString()
    })
    .eq('id', campaignId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    console.error('Error pausing campaign:', error)
    throw error
  }

  // Drain all queued/delayed jobs for this campaign so they don't fire later
  try {
    const { campaignProcessorQueue } = await import('@/lib/queue/campaign-queue')
    const [waiting, delayed] = await Promise.all([
      campaignProcessorQueue.getWaiting(),
      campaignProcessorQueue.getDelayed(),
    ])
    const toRemove = [...waiting, ...delayed].filter(
      (j: any) => j.data?.campaign_id === campaignId
    )
    for (const j of toRemove) {
      await j.remove().catch(() => {})
    }
    if (toRemove.length > 0) {
      console.log(`[pauseCampaign] Removed ${toRemove.length} queued jobs for campaign ${campaignId}`)
    }
  } catch (err: any) {
    console.warn('[pauseCampaign] Could not drain queue:', err.message)
  }

  return data as Campaign
}

/**
 * Cancel campaign
 */
export async function cancelCampaign(campaignId: string) {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  const { data, error } = await supabase
    .from('campaigns')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString()
    })
    .eq('id', campaignId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    console.error('Error canceling campaign:', error)
    throw error
  }

  // Drain all queued/delayed jobs for this campaign so they don't fire later
  try {
    const { campaignProcessorQueue } = await import('@/lib/queue/campaign-queue')
    const [waiting, delayed] = await Promise.all([
      campaignProcessorQueue.getWaiting(),
      campaignProcessorQueue.getDelayed(),
    ])
    const toRemove = [...waiting, ...delayed].filter(
      (j: any) => j.data?.campaign_id === campaignId
    )
    for (const j of toRemove) {
      await j.remove().catch(() => {})
    }
    if (toRemove.length > 0) {
      console.log(`[cancelCampaign] Removed ${toRemove.length} queued jobs for campaign ${campaignId}`)
    }
  } catch (err: any) {
    console.warn('[cancelCampaign] Could not drain queue:', err.message)
  }

  return data as Campaign
}

// =============================================
// CAMPAIGN SEQUENCES
// =============================================

/**
 * Get campaign sequences
 */
export async function getCampaignSequences(campaignId: string) {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  const { data, error } = await supabase
    .from('campaign_sequences')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('step_number', { ascending: true })

  if (error) {
    console.error('Error fetching campaign sequences:', error)
    throw error
  }

  return data as CampaignSequence[]
}

/**
 * Update campaign sequence
 */
export async function updateCampaignSequence(sequenceId: string, updates: Partial<CampaignSequence>) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('campaign_sequences')
    .update(updates)
    .eq('id', sequenceId)
    .select()
    .single()

  if (error) {
    console.error('Error updating campaign sequence:', error)
    throw error
  }

  return data as CampaignSequence
}

// =============================================
// CAMPAIGN LEADS
// =============================================

/**
 * Get campaign leads
 */
export async function getCampaignLeads(campaignId: string, filters?: CampaignLeadFilters) {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  let query = supabase
    .from('campaign_leads')
    .select(`
      *,
      lead:leads(*),
      sender:campaign_senders(
        id,
        linkedin_account:linkedin_accounts(id, email, profile_name)
      )
    `)
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })

  // Apply filters
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  if (filters?.sender_id) {
    query = query.eq('sender_id', filters.sender_id)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching campaign leads:', error)
    throw error
  }

  return data as (CampaignLead & { lead?: Lead, sender?: any })[]
}

/**
 * Add leads to campaign
 */
export async function addLeadsToCampaign(campaignId: string, leadIds: string[]) {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  // Get campaign senders for distribution
  const { data: senders } = await supabase
    .from('campaign_senders')
    .select('id')
    .eq('campaign_id', campaignId)
    .eq('is_active', true)

  const campaignLeadsData = leadIds.map((leadId: any, index: number) => ({
    campaign_id: campaignId,
    lead_id: leadId,
    sender_id: senders && senders.length > 0 ? senders[index % senders.length].id : null,
    status: 'pending' as const
  }))

  const { data, error } = await supabase
    .from('campaign_leads')
    .insert(campaignLeadsData)
    .select()

  if (error) {
    console.error('Error adding leads to campaign:', error)
    throw error
  }

  return data as CampaignLead[]
}

/**
 * Remove leads from campaign
 */
export async function removeLeadsFromCampaign(campaignLeadIds: string[]) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('campaign_leads')
    .delete()
    .in('id', campaignLeadIds)

  if (error) {
    console.error('Error removing leads from campaign:', error)
    throw error
  }

  return { success: true }
}

/**
 * Add all leads from a list to a campaign (skips duplicates)
 */
export async function addLeadsFromList(campaignId: string, listId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('User not authenticated')

  // Fetch leads that belong to this list
  const { data: listLeads, error: leadsError } = await supabase
    .from('leads')
    .select('id')
    .eq('list_id', listId)
    .eq('user_id', user.id)

  if (leadsError) throw leadsError
  if (!listLeads || listLeads.length === 0) return { added: 0 }

  // Skip leads already enrolled in this campaign
  const { data: existing } = await supabase
    .from('campaign_leads')
    .select('lead_id')
    .eq('campaign_id', campaignId)

  const existingIds = new Set((existing || []).map((l: any) => l.lead_id))
  const newLeads = listLeads.filter((l: any) => !existingIds.has(l.id))

  if (newLeads.length === 0) return { added: 0 }

  // Get active senders for round-robin distribution
  const { data: senders } = await supabase
    .from('campaign_senders')
    .select('id')
    .eq('campaign_id', campaignId)
    .eq('is_active', true)

  const leadsData = newLeads.map((ll: any, idx: number) => ({
    campaign_id: campaignId,
    lead_id: ll.id,
    sender_id: senders && senders.length > 0 ? senders[idx % senders.length].id : null,
    status: 'pending' as const
  }))

  for (let i = 0; i < leadsData.length; i += 500) {
    await supabase.from('campaign_leads').insert(leadsData.slice(i, i + 500))
  }

  return { added: newLeads.length }
}

/**
 * Export campaign leads as CSV
 */
export async function exportCampaignLeads(campaignId: string) {
  const leads = await getCampaignLeads(campaignId)
  
  // Convert to CSV format
  const headers = ['Name', 'Company', 'Position', 'Status', 'Connection Sent', 'Connection Accepted', 'Messages Sent', 'Replies Received', 'First Reply']
  const rows = leads.map((cl: any) => [
    cl.lead?.full_name || `${cl.lead?.first_name || ''} ${cl.lead?.last_name || ''}`.trim(),
    cl.lead?.company || '',
    cl.lead?.position || '',
    cl.status,
    cl.connection_sent_at || '',
    cl.connection_accepted_at || '',
    cl.total_messages_sent || 0,
    cl.total_replies_received || 0,
    cl.replied_at || ''
  ])

  const csv = [headers, ...rows].map((row: any) => row.join(',')).join('\n')
  return csv
}

// =============================================
// CAMPAIGN STATISTICS
// =============================================

/**
 * Get campaign statistics
 */
export async function getCampaignStats() {
  const supabase = await createClient()
  
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    throw new Error('User not authenticated')
  }

  // Get total campaigns
  const { count: totalCampaigns } = await supabase
    .from('campaigns')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  // Get active campaigns
  const { count: activeCampaigns } = await supabase
    .from('campaigns')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'active')

  // Get campaign performance metrics
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('total_leads, replied_leads, connection_sent, connection_accepted')
    .eq('user_id', user.id)

  let totalLeads = 0
  let repliedLeads = 0
  let connectionSent = 0
  let connectionAccepted = 0

  if (campaigns) {
    campaigns.forEach((c: any) => {
      totalLeads += c.total_leads || 0
      repliedLeads += c.replied_leads || 0
      connectionSent += c.connection_sent || 0
      connectionAccepted += c.connection_accepted || 0
    })
  }

  const connectionAcceptRate = connectionSent > 0 ? (connectionAccepted / connectionSent) * 100 : 0
  const replyRate = totalLeads > 0 ? (repliedLeads / totalLeads) * 100 : 0

  return {
    totalCampaigns: totalCampaigns || 0,
    activeCampaigns: activeCampaigns || 0,
    totalLeads,
    repliedLeads,
    connectionAcceptRate,
    replyRate
  } as CampaignStats
}

/**
 * Get campaign performance data
 */
export async function getCampaignPerformance(campaignId: string) {
  const supabase = await createClient()
  
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single()

  if (!campaign) {
    throw new Error('Campaign not found')
  }

  // Get daily activity for the chart
  const { data: dailyActivity } = await supabase
    .from('campaign_activity_log')
    .select('executed_at, activity_type, activity_status')
    .eq('campaign_id', campaignId)
    .order('executed_at', { ascending: true })

  return {
    campaign,
    dailyActivity: dailyActivity || []
  }
}

/**
 * Get sequence performance
 */
export async function getSequencePerformance(campaignId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('campaign_sequences')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('step_number', { ascending: true })

  if (error) {
    console.error('Error fetching sequence performance:', error)
    throw error
  }

  return data as CampaignSequence[]
}

/**
 * Get sender performance
 */
export async function getSenderPerformance(campaignId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('campaign_senders')
    .select(`
      *,
      linkedin_account:linkedin_accounts(id, email, profile_name, profile_picture_url)
    `)
    .eq('campaign_id', campaignId)

  if (error) {
    console.error('Error fetching sender performance:', error)
    throw error
  }

  return data as (CampaignSender & { linkedin_account?: LinkedInAccount })[]
}

// =============================================
// CAMPAIGN ACTIVITY
// =============================================

/**
 * Log campaign activity
 */
export async function logCampaignActivity(
  campaignId: string,
  campaignLeadId: string,
  activityType: string,
  activityStatus: string,
  messageContent?: string,
  errorMessage?: string
) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('campaign_activity_log')
    .insert({
      campaign_id: campaignId,
      campaign_lead_id: campaignLeadId,
      activity_type: activityType,
      activity_status: activityStatus,
      message_content: messageContent,
      error_message: errorMessage
    })

  if (error) {
    console.error('Error logging campaign activity:', error)
    throw error
  }

  return { success: true }
}

/**
 * Get campaign activity log
 */
export async function getCampaignActivityLog(campaignId: string, limit = 100) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('campaign_activity_log')
    .select(`
      *,
      campaign_lead:campaign_leads(
        id,
        lead:leads(first_name, last_name, company)
      )
    `)
    .eq('campaign_id', campaignId)
    .order('executed_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching campaign activity log:', error)
    throw error
  }

  return data as (CampaignActivityLog & { campaign_lead?: any })[]
}

// =============================================
// ANALYTICS
// =============================================

/**
 * 4.3  Get comprehensive campaign analytics
 */
export async function getCampaignAnalytics(campaignId: string): Promise<CampaignAnalytics> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('User not authenticated')

  // Funnel data
  const { data: leads } = await supabase
    .from('campaign_leads')
    .select('status, connection_sent_at, connection_accepted_at, first_message_sent_at, first_reply_at, sender_id, created_at')
    .eq('campaign_id', campaignId)

  const allLeads = leads || []
  const total = allLeads.length
  const sent = allLeads.filter((l: any) => l.connection_sent_at).length
  const accepted = allLeads.filter((l: any) => l.connection_accepted_at).length
  const messaged = allLeads.filter((l: any) => l.first_message_sent_at).length
  const replied = allLeads.filter((l: any) => l.first_reply_at).length

  const funnel = {
    total_leads: total,
    sent,
    sent_pct: total > 0 ? Math.round(sent / total * 100) : 0,
    accepted,
    accepted_pct: sent > 0 ? Math.round(accepted / sent * 100) : 0,
    messaged,
    messaged_pct: accepted > 0 ? Math.round(messaged / accepted * 100) : 0,
    replied,
    replied_pct: messaged > 0 ? Math.round(replied / messaged * 100) : 0
  }

  // Today's stats from account_daily_counters.
  // campaign_leads.sender_id is a FK to campaign_senders.id, NOT linkedin_accounts.id.
  // We must resolve through the campaign_senders table to get the real linkedin_account_id.
  const today = new Date().toISOString().split('T')[0]
  const campaignSenderIds = Array.from(new Set(allLeads.map((l: any) => l.sender_id).filter(Boolean)))

  let connectionsToday = 0
  let messagesToday = 0
  let acceptedToday = 0

  if (campaignSenderIds.length > 0) {
    // Resolve campaign_senders.id → linkedin_account_id
    const { data: senderRows } = await supabase
      .from('campaign_senders')
      .select('id, linkedin_account_id')
      .in('id', campaignSenderIds)

    const linkedInAccountIds = (senderRows || [])
      .map((s: any) => s.linkedin_account_id)
      .filter(Boolean)

    if (linkedInAccountIds.length > 0) {
      const { data: counters } = await supabase
        .from('account_daily_counters')
        .select('connections_sent, messages_sent')
        .in('linkedin_account_id', linkedInAccountIds)
        .eq('date', today)

      connectionsToday = (counters || []).reduce((s: any, c: any) => s + (c.connections_sent || 0), 0)
      messagesToday = (counters || []).reduce((s: any, c: any) => s + (c.messages_sent || 0), 0)
    }
  }

  // Today's accepted connections — filter by date on connection_accepted_at
  acceptedToday = allLeads.filter((l: any) => (l.connection_accepted_at as string | null)?.startsWith(today)).length

  // Today's replies — filter by first_reply_at date (not all-time total)
  const repliesToday = allLeads.filter((l: any) => (l.first_reply_at as string | null)?.startsWith(today)).length

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('daily_limit')
    .eq('id', campaignId)
    .single()

  const todayStats = {
    connections_sent: connectionsToday,
    connections_accepted: acceptedToday,
    messages_sent: messagesToday,
    replies_received: repliesToday,
    daily_limit: campaign?.daily_limit || 50
  }

  // 7-day trend
  const trend = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const dayLeads = allLeads.filter((l: any) => l.connection_sent_at?.startsWith(dateStr))
    const dayReplies = allLeads.filter((l: any) => l.first_reply_at?.startsWith(dateStr))
    trend.push({
      date: dateStr,
      connections: dayLeads.length,
      replies: dayReplies.length
    })
  }

  // Per-step breakdown
  const { data: sequences } = await supabase
    .from('campaign_sequences')
    .select('id, step_number, step_type, ab_test_enabled, ab_test_winner')
    .eq('campaign_id', campaignId)
    .order('step_number')

  const per_step = (sequences || []).map((seq: any) => {
    const stepLeads = allLeads.filter((l: any) => {
      if (seq.step_type === 'connection_request') return l.connection_sent_at
      if (seq.step_type === 'message') return l.first_message_sent_at
      return false
    })
    const converted = allLeads.filter((l: any) => {
      if (seq.step_type === 'connection_request') return l.connection_accepted_at
      if (seq.step_type === 'message') return l.first_reply_at
      return false
    })
    return {
      step_number: seq.step_number,
      step_type: seq.step_type,
      sent: stepLeads.length,
      converted: converted.length,
      rate: stepLeads.length > 0 ? Math.round(converted.length / stepLeads.length * 100) : 0
    }
  })

  // A/B results
  const ab_results = (sequences || [])
    .filter((seq: any) => seq.ab_test_enabled)
    .map((seq: any) => {
      const aLeads = (allLeads as any[]).filter((l: any) => l.variant === 'A')
      const bLeads = (allLeads as any[]).filter((l: any) => l.variant === 'B')
      const aReplied = aLeads.filter((l: any) => l.first_reply_at).length
      const bReplied = bLeads.filter((l: any) => l.first_reply_at).length
      return {
        step_id: seq.id,
        variant_a_sent: aLeads.length,
        variant_a_replied: aReplied,
        variant_a_rate: aLeads.length > 0 ? Math.round(aReplied / aLeads.length * 100) : 0,
        variant_b_sent: bLeads.length,
        variant_b_replied: bReplied,
        variant_b_rate: bLeads.length > 0 ? Math.round(bReplied / bLeads.length * 100) : 0,
        winner: seq.ab_test_winner || null
      }
    })

  // Per-sender leaderboard
  const { data: senders } = await supabase
    .from('campaign_senders')
    .select(`
      linkedin_account_id,
      connection_sent,
      connection_accepted,
      messages_sent,
      replies_received,
      linkedin_account:linkedin_accounts(profile_name)
    `)
    .eq('campaign_id', campaignId)

  const per_sender = (senders || []).map((s: any) => ({
    account_id: s.linkedin_account_id,
    profile_name: s.linkedin_account?.profile_name || 'Unknown',
    connections_sent: s.connection_sent || 0,
    accepted: s.connection_accepted || 0,
    messages_sent: s.messages_sent || 0,
    replied: s.replies_received || 0
  }))

  return { funnel, today: todayStats, trend, per_step, ab_results, per_sender }
}

/**
 * 4.4  Declare A/B test winner for a sequence step
 */
export async function declareABTestWinner(sequenceId: string, winner: 'A' | 'B') {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('User not authenticated')

  // Update the sequence
  await supabase
    .from('campaign_sequences')
    .update({ ab_test_winner: winner })
    .eq('id', sequenceId)

  // Switch losing-variant pending leads to the winner
  const losingVariant = winner === 'A' ? 'B' : 'A'
  const { data: seq } = await supabase
    .from('campaign_sequences')
    .select('campaign_id')
    .eq('id', sequenceId)
    .single()

  if (seq) {
    await supabase
      .from('campaign_leads')
      .update({ variant: winner })
      .eq('campaign_id', seq.campaign_id)
      .eq('variant', losingVariant)
      .eq('status', 'pending')
  }

  return { success: true, winner }
}

/**
 * 4.5  Duplicate a campaign
 */
export async function duplicateCampaign(campaignId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('User not authenticated')

  // Fetch original
  const { data: original } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .eq('user_id', user.id)
    .single()

  if (!original) throw new Error('Campaign not found')

  // Insert copy
  const { id: _id, created_at: _ca, updated_at: _ua, started_at: _sa, ...rest } = original
  const { data: copy, error } = await supabase
    .from('campaigns')
    .insert({ ...rest, name: `${original.name} (Copy)`, status: 'draft', started_at: null, paused_at: null })
    .select()
    .single()

  if (error || !copy) throw error || new Error('Failed to duplicate campaign')

  // Copy senders
  const { data: senders } = await supabase
    .from('campaign_senders')
    .select('linkedin_account_id, is_active, daily_limit')
    .eq('campaign_id', campaignId)

  if (senders && senders.length > 0) {
    await supabase.from('campaign_senders').insert(
      senders.map((s: any) => ({ ...s, campaign_id: copy.id }))
    )
  }

  // Copy sequences
  const { data: sequences } = await supabase
    .from('campaign_sequences')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('step_number')

  if (sequences && sequences.length > 0) {
    const { id: _sid, created_at: _sca, updated_at: _sua, ...seqRest } = sequences[0]
    await supabase.from('campaign_sequences').insert(
      sequences.map(({  id: _sid2, created_at: _sca2, updated_at: _sua2, ...s  }: any) => ({
        ...s,
        campaign_id: copy.id,
        parent_step_id: null
      }))
    )
  }

  return copy as Campaign
}

/**
 * 4.6  Get pre-built campaign quick-start templates (no DB required)
 */
export async function getCampaignTemplates(): Promise<CampaignTemplate[]> {
  return [
    {
      id: 'cold-outreach',
      name: 'Cold Outreach',
      description: 'Connect, follow up with a warm message, then a final nudge.',
      step_count: 3,
      estimated_acceptance_rate: '25–40%',
      steps: [
        { step_number: 1, step_type: 'connection_request', delay_days: 0, delay_hours: 0, message_template: 'Hi {{firstName}}, {{aiIcebreaker}} I\'d love to connect.' },
        { step_number: 2, step_type: 'message', delay_days: 2, delay_hours: 0, condition_type: 'accepted', message_template: 'Hi {{firstName}}, thanks for connecting! {I work with|I help|I partner with} {{position}}s at companies like {{company}} to achieve great results. Would love to share how.' },
        { step_number: 3, step_type: 'message', delay_days: 5, delay_hours: 0, condition_type: 'not_replied', message_template: 'Hi {{firstName}}, just wanted to follow up on my previous message. Happy to chat at your convenience!' }
      ]
    },
    {
      id: 'warm-followup',
      name: 'Warm Follow-up',
      description: 'View profile first for a soft touch, then connect and nurture.',
      step_count: 3,
      estimated_acceptance_rate: '30–45%',
      steps: [
        { step_number: 1, step_type: 'view_profile', delay_days: 0, delay_hours: 0 },
        { step_number: 2, step_type: 'connection_request', delay_days: 1, delay_hours: 0, message_template: 'Hi {{firstName}}, I noticed your profile — impressive background at {{company}}. Would love to connect!' },
        { step_number: 3, step_type: 'message', delay_days: 3, delay_hours: 0, condition_type: 'accepted', message_template: 'Hi {{firstName}}, appreciate the connection! I\'d love to explore if there\'s any synergy between what we do.' }
      ]
    },
    {
      id: 'recruiter-sequence',
      name: 'Recruiter Sequence',
      description: 'Multi-touch recruiting flow with InMail fallback.',
      step_count: 4,
      estimated_acceptance_rate: '20–35%',
      steps: [
        { step_number: 1, step_type: 'connection_request', delay_days: 0, delay_hours: 0, message_template: 'Hi {{firstName}}, I came across your profile and was really impressed by your experience at {{company}}. I have an exciting opportunity that might interest you!' },
        { step_number: 2, step_type: 'inmail', delay_days: 1, delay_hours: 0, condition_type: 'not_accepted', subject_template: 'Exciting opportunity at [Company]', message_template: 'Hi {{firstName}}, I reached out via connection request but wanted to make sure this reached you. We have a role that aligns perfectly with your {{position}} expertise.' },
        { step_number: 3, step_type: 'message', delay_days: 4, delay_hours: 0, condition_type: 'accepted', message_template: 'Hi {{firstName}}, happy to be connected! I\'d love to share details about the opportunity — do you have 15 mins this week?' },
        { step_number: 4, step_type: 'message', delay_days: 7, delay_hours: 0, condition_type: 'not_replied', message_template: 'Hi {{firstName}}, just a gentle follow-up. The role is still open and I think you\'d be a great fit. Let me know if you\'d like to learn more!' }
      ]
    }
  ]
}

// =============================================
// WEBHOOKS
// =============================================

/**
 * Get all webhooks configured for a campaign
 */
export async function getCampaignWebhooks(campaignId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('User not authenticated')

  const { data, error } = await supabase
    .from('campaign_webhooks')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    // Table not created yet — run migrations/007_campaign_webhooks.sql to enable
    if (error.code === 'PGRST205') return []
    throw error
  }
  return data || []
}

/**
 * Create a new webhook for a campaign
 */
export async function createCampaignWebhook(
  campaignId: string,
  input: {
    url: string
    secret?: string
    description?: string
    events?: string[]
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('User not authenticated')

  const { data, error } = await supabase
    .from('campaign_webhooks')
    .insert({
      campaign_id: campaignId,
      user_id: user.id,
      url: input.url,
      secret: input.secret || null,
      description: input.description || null,
      events: input.events || [],
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST205') throw new Error('Webhooks table not set up yet. Run migrations/007_campaign_webhooks.sql in Supabase.')
    throw error
  }
  return data
}

/**
 * Update a webhook (toggle active, change URL/events)
 */
export async function updateCampaignWebhook(
  webhookId: string,
  updates: {
    url?: string
    secret?: string
    description?: string
    events?: string[]
    is_active?: boolean
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('User not authenticated')

  const { data, error } = await supabase
    .from('campaign_webhooks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', webhookId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Delete a webhook
 */
export async function deleteCampaignWebhook(webhookId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('User not authenticated')

  const { error } = await supabase
    .from('campaign_webhooks')
    .delete()
    .eq('id', webhookId)
    .eq('user_id', user.id)

  if (error) {
    if (error.code === 'PGRST205') return { success: true }
    throw error
  }
  return { success: true }
}

/**
 * Get recent webhook delivery logs for a campaign
 */
export async function getCampaignWebhookLogs(campaignId: string, limit = 50) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('User not authenticated')

  const { data, error } = await supabase
    .from('campaign_webhook_logs')
    .select(`
      *,
      webhook:campaign_webhooks(url, description)
    `)
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}

/**
 * Add a LinkedIn account as a sender for a campaign
 */
export async function addCampaignSender(campaignId: string, linkedinAccountId: string) {
  // Auth check — verify user is logged in
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('User not authenticated')

  // Use service-role client for DB operations (bypasses RLS, already verified ownership)
  const adminDb = createServiceRoleClient()

  // Verify campaign belongs to user
  const { data: campaign } = await adminDb
    .from('campaigns')
    .select('id, daily_limit, user_id')
    .eq('id', campaignId)
    .single()
  if (!campaign || campaign.user_id !== user.id) throw new Error('Campaign not found')

  // Verify the LinkedIn account belongs to this user
  const { data: acct } = await adminDb
    .from('linkedin_accounts')
    .select('id, user_id')
    .eq('id', linkedinAccountId)
    .single()
  if (!acct || acct.user_id !== user.id) throw new Error('LinkedIn account not found')

  // Use upsert to prevent duplicate rows from double-clicks (unique on campaign_id + linkedin_account_id)
  const { data, error } = await adminDb
    .from('campaign_senders')
    .upsert(
      {
        campaign_id: campaignId,
        linkedin_account_id: linkedinAccountId,
        is_active: true,
        daily_limit: campaign.daily_limit || 50,
      },
      { onConflict: 'campaign_id,linkedin_account_id' }
    )
    .select(`
      id,
      is_active,
      daily_limit,
      linkedin_account:linkedin_accounts(id, email, profile_name, profile_picture_url, status)
    `)
    .single()

  if (error) {
    console.error('[addCampaignSender] Error:', error)
    throw new Error(`Failed to add sender: ${error.message}`)
  }
  try { revalidatePath(`/campaigns/${campaignId}`) } catch {}
  return data
}

/**
 * Remove a sender from a campaign
 */
export async function removeCampaignSender(campaignId: string, senderId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('User not authenticated')

  const adminDb = createServiceRoleClient()

  // Verify campaign belongs to user
  const { data: campaign } = await adminDb
    .from('campaigns')
    .select('id, user_id')
    .eq('id', campaignId)
    .single()
  if (!campaign || campaign.user_id !== user.id) throw new Error('Campaign not found')

  const { error } = await adminDb
    .from('campaign_senders')
    .delete()
    .eq('id', senderId)
    .eq('campaign_id', campaignId)

  if (error) throw error
  try { revalidatePath(`/campaigns/${campaignId}`) } catch {}
  return { success: true }
}
