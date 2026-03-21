'use server'

import { createClient, createServiceRoleClient } from '@/lib/db/server'
import { revalidatePath } from 'next/cache'
import { queueReply } from '@/lib/queue/message-sync-queue'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Conversation {
  id: string
  linkedin_account_id: string
  participant_name: string
  participant_profile_url: string | null
  participant_headline: string | null
  participant_avatar_url: string | null
  last_message_at: string
  last_message_preview: string | null
  unread_count: number
  is_archived: boolean
  thread_id: string
  label: string | null
  created_at: string
  updated_at: string
  linkedin_account?: {
    id: string
    email: string
  }
}

export interface Message {
  id: string
  conversation_id: string
  linkedin_account_id: string
  message_id: string
  sender_name: string
  sender_profile_url: string | null
  is_from_me: boolean
  content: string
  sent_at: string
  is_read: boolean
  has_attachment: boolean
  attachment_url: string | null
  created_at: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Get user's LinkedIn account IDs for proper row-scoping */
async function getUserAccountIds(userId: string): Promise<string[]> {
  const svc = createServiceRoleClient()
  const { data } = await svc
    .from('linkedin_accounts')
    .select('id')
    .eq('user_id', userId)
  return (data || []).map((a: any) => a.id)
}

// ─── Server Actions ──────────────────────────────────────────────────────────

export async function getConversations(filters?: {
  accountId?: string
  showArchived?: boolean
  onlyUnread?: boolean
  searchQuery?: string
  label?: string
}) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')

  // Fix: scope by account IDs instead of broken PostgREST join filter
  const accountIds = await getUserAccountIds(user.id)
  if (accountIds.length === 0) return []

  const svc = createServiceRoleClient()
  let query = svc
    .from('conversations')
    .select(`*, linkedin_account:linkedin_accounts(id, email)`)
    .in('linkedin_account_id', accountIds)
    .order('last_message_at', { ascending: false })

  if (filters?.accountId) query = query.eq('linkedin_account_id', filters.accountId)
  if (filters?.showArchived === false) query = query.eq('is_archived', false)
  if (filters?.onlyUnread) query = query.gt('unread_count', 0)
  if (filters?.label) query = query.eq('label', filters.label)
  if (filters?.searchQuery) {
    query = query.or(
      `participant_name.ilike.%${filters.searchQuery}%,last_message_preview.ilike.%${filters.searchQuery}%`,
    )
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching conversations:', error)
    if (error.code === 'PGRST205') return []
    throw new Error('Failed to fetch conversations')
  }

  return data as Conversation[]
}

export async function getConversationMessages(conversationId: string) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')

  const svc = createServiceRoleClient()
  const { data, error } = await svc
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('sent_at', { ascending: true })

  if (error) {
    console.error('Error fetching messages:', error)
    throw new Error('Failed to fetch messages')
  }

  return data as Message[]
}

/**
 * Send a reply — saves to DB immediately, queues real LinkedIn delivery.
 */
export async function sendMessage(
  conversationId: string,
  linkedinAccountId: string,
  content: string,
) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')

  const svc = createServiceRoleClient()

  // Get the thread_id for Playwright
  const { data: conv } = await svc
    .from('conversations')
    .select('thread_id')
    .eq('id', conversationId)
    .single()
  if (!conv) throw new Error('Conversation not found')

  // Save to DB immediately (optimistic — user sees it right away)
  const messageId = `sent_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  const { data: savedMsg, error: insertError } = await svc
    .from('messages')
    .insert({
      conversation_id: conversationId,
      linkedin_account_id: linkedinAccountId,
      message_id: messageId,
      sender_name: 'Me',
      is_from_me: true,
      content,
      sent_at: new Date().toISOString(),
      is_read: true,
    })
    .select()
    .single()

  if (insertError) {
    console.error('Error saving message:', insertError)
    throw new Error('Failed to save message')
  }

  // Queue real delivery via Playwright (async, non-blocking)
  try {
    await queueReply({
      linkedinAccountId,
      threadId: conv.thread_id,
      messageText: content,
      conversationId,
    })
    console.log(`[Unibox] Reply queued for LinkedIn delivery → thread ${conv.thread_id}`)
  } catch (queueErr: any) {
    console.error('[Unibox] Queue failed (message saved locally):', queueErr.message)
  }

  revalidatePath('/unibox')
  return savedMsg as Message
}

export async function markConversationAsRead(conversationId: string) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')

  const svc = createServiceRoleClient()
  await svc.from('messages').update({ is_read: true }).eq('conversation_id', conversationId).eq('is_from_me', false)
  await svc.from('conversations').update({ unread_count: 0 }).eq('id', conversationId)

  revalidatePath('/unibox')
}

export async function archiveConversation(conversationId: string, archive: boolean = true) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')

  const svc = createServiceRoleClient()
  const { error } = await svc
    .from('conversations')
    .update({ is_archived: archive })
    .eq('id', conversationId)

  if (error) throw new Error('Failed to archive conversation')
  revalidatePath('/unibox')
}

export async function setConversationLabel(conversationId: string, label: string | null) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')

  const svc = createServiceRoleClient()
  await svc.from('conversations').update({ label }).eq('id', conversationId)

  revalidatePath('/unibox')
}

export async function getLinkedInAccounts() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('linkedin_accounts')
    .select('id, email, status')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (error) return []
  return data
}

/**
 * Trigger an immediate sync for the user's accounts
 */
export async function triggerSync() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Unauthorized')

  try {
    const { messageSyncQueue } = await import('@/lib/queue/message-sync-queue')
    await messageSyncQueue.add('manual-sync', {
      type: 'sync-all' as const,
      userId: user.id,
    }, { removeOnComplete: 5, removeOnFail: 5 })
    return { success: true }
  } catch (err: any) {
    console.error('[Unibox] Sync trigger failed:', err.message)
    return { success: false, error: err.message }
  }
}

/**
 * Get campaign context for a conversation's participant (shown inline in thread)
 */
export async function getCampaignContext(participantName: string, linkedinAccountId: string) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return null

  const svc = createServiceRoleClient()
  const firstName = participantName.split(' ')[0]

  const { data } = await svc
    .from('campaign_leads')
    .select(`status, lead:leads(first_name, last_name, full_name, company, position), campaign:campaigns(name, status)`)
    .or(`lead.full_name.ilike.%${participantName}%,lead.first_name.ilike.%${firstName}%`)
    .limit(1)

  if (data && data.length > 0) {
    const cl = data[0] as any
    return {
      campaignName: cl.campaign?.name || null,
      leadStatus: cl.status || null,
      company: cl.lead?.company || null,
      position: cl.lead?.position || null,
    }
  }
  return null
}
