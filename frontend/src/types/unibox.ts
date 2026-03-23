// ─── Unibox Types ────────────────────────────────────────────────────────────

// ─── Models ──────────────────────────────────────────────────────────────────

export interface Conversation {
  id: string
  linkedin_account_id: string
  participant_name: string
  participant_profile_url: string | null
  participant_headline: string | null
  participant_avatar_url: string | null
  last_message_at: string | null
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

// ─── DTOs ────────────────────────────────────────────────────────────────────

export interface GetConversationsFilter {
  account_id?: string
  show_archived?: boolean
  only_unread?: boolean
  search_query?: string
  label?: string
}

export interface SendMessageRequest {
  conversation_id: string
  linkedin_account_id: string
  content: string
}

export interface ArchiveConversationRequest {
  archive: boolean
}

export interface SetLabelRequest {
  label: string | null
}

export interface TriggerSyncResponse {
  success: boolean
  error?: string
}

export interface CampaignContextResponse {
  campaignName: string | null
  leadStatus: string | null
  company: string | null
  position: string | null
}

// ─── Label Config ────────────────────────────────────────────────────────────

export interface LabelConfig {
  emoji: string
  color: string
  bg: string
}

export const LABELS: Record<string, LabelConfig> = {
  interested:     { emoji: '🟢', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  maybe:          { emoji: '🟡', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200' },
  not_interested: { emoji: '🔴', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  meeting_booked: { emoji: '📅', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
}

// ─── Filter Tab Type ─────────────────────────────────────────────────────────

export type ConversationFilter = 'all' | 'unread' | 'needs_reply' | 'archived'
