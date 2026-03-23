import api from './client'
import type {
  Conversation,
  Message,
  GetConversationsFilter,
  SendMessageRequest,
  ArchiveConversationRequest,
  SetLabelRequest,
  TriggerSyncResponse,
  CampaignContextResponse,
} from '@/types/unibox'

const BASE = '/unibox'

// ─── Conversations ───────────────────────────────────────────────────────────

export async function getConversations(filter?: GetConversationsFilter): Promise<Conversation[]> {
  const { data } = await api.get<Conversation[]>(`${BASE}/conversations`, { params: filter })
  return data
}

export async function getConversationMessages(conversationId: string): Promise<Message[]> {
  const { data } = await api.get<Message[]>(`${BASE}/conversations/${conversationId}/messages`)
  return data
}

export async function markConversationAsRead(conversationId: string): Promise<void> {
  await api.post(`${BASE}/conversations/${conversationId}/read`)
}

export async function archiveConversation(conversationId: string, archive: boolean): Promise<void> {
  const body: ArchiveConversationRequest = { archive }
  await api.post(`${BASE}/conversations/${conversationId}/archive`, body)
}

export async function setConversationLabel(conversationId: string, label: string | null): Promise<void> {
  const body: SetLabelRequest = { label }
  await api.put(`${BASE}/conversations/${conversationId}/label`, body)
}

// ─── Messages ────────────────────────────────────────────────────────────────

export async function sendMessage(req: SendMessageRequest): Promise<Message> {
  const { data } = await api.post<Message>(`${BASE}/messages`, req)
  return data
}

// ─── Sync ────────────────────────────────────────────────────────────────────

export async function triggerSync(): Promise<TriggerSyncResponse> {
  const { data } = await api.post<TriggerSyncResponse>(`${BASE}/sync`)
  return data
}

// ─── Accounts ────────────────────────────────────────────────────────────────

export async function getLinkedInAccounts(): Promise<{ id: string; email: string; status: string }[]> {
  const { data } = await api.get<{ id: string; email: string; status: string }[]>(`${BASE}/accounts`)
  return data
}

// ─── Campaign Context ────────────────────────────────────────────────────────

export async function getCampaignContext(
  participantName: string,
  linkedinAccountId: string,
): Promise<CampaignContextResponse | null> {
  const { data } = await api.get<CampaignContextResponse | null>(`${BASE}/campaign-context`, {
    params: { participant_name: participantName, linkedin_account_id: linkedinAccountId },
  })
  return data
}
