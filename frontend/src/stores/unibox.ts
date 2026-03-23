import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  Conversation,
  Message,
  ConversationFilter,
  CampaignContextResponse,
} from '@/types/unibox'
import * as uniboxApi from '@/api/unibox'

export const useUniboxStore = defineStore('unibox', () => {
  // ─── State ───────────────────────────────────────────────────────────────

  const conversations = ref<Conversation[]>([])
  const messages = ref<Message[]>([])
  const selectedConversation = ref<Conversation | null>(null)
  const campaignContext = ref<CampaignContextResponse | null>(null)
  const accounts = ref<{ id: string; email: string; status: string }[]>([])

  const filter = ref<ConversationFilter>('all')
  const searchQuery = ref('')
  const selectedAccountId = ref('all')

  const loading = ref(false)
  const loadingMessages = ref(false)
  const sending = ref(false)
  const syncing = ref(false)
  const error = ref<string | null>(null)

  // ─── Computed ────────────────────────────────────────────────────────────

  const filteredConversations = computed(() => {
    return conversations.value.filter(conv => {
      if (filter.value === 'unread' && conv.unread_count === 0) return false
      if (filter.value === 'archived' && !conv.is_archived) return false
      if (filter.value === 'all' && conv.is_archived) return false
      if (filter.value === 'needs_reply') {
        if (conv.is_archived) return false
        if (conv.unread_count === 0) return false
      }
      if (selectedAccountId.value !== 'all' && conv.linkedin_account_id !== selectedAccountId.value) return false
      if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase()
        return (
          conv.participant_name.toLowerCase().includes(q) ||
          (conv.last_message_preview?.toLowerCase().includes(q) ?? false)
        )
      }
      return true
    })
  })

  const totalUnread = computed(() =>
    conversations.value.filter(c => c.unread_count > 0 && !c.is_archived).length,
  )

  // ─── Helper ──────────────────────────────────────────────────────────────

  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    error.value = null
    try {
      return await fn()
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e)
      return undefined
    }
  }

  // ─── Actions ─────────────────────────────────────────────────────────────

  async function fetchConversations() {
    loading.value = true
    const result = await run(() => uniboxApi.getConversations())
    if (result) conversations.value = result
    loading.value = false
  }

  async function fetchAccounts() {
    const result = await run(() => uniboxApi.getLinkedInAccounts())
    if (result) accounts.value = result
  }

  async function selectConversation(conv: Conversation) {
    selectedConversation.value = conv
    campaignContext.value = null
    loadingMessages.value = true

    const msgs = await run(() => uniboxApi.getConversationMessages(conv.id))
    if (msgs) messages.value = msgs

    if (conv.unread_count > 0) {
      await run(() => uniboxApi.markConversationAsRead(conv.id))
      conversations.value = conversations.value.map(c =>
        c.id === conv.id ? { ...c, unread_count: 0 } : c,
      )
    }

    loadingMessages.value = false

    // Load campaign context in background
    run(() => uniboxApi.getCampaignContext(conv.participant_name, conv.linkedin_account_id)).then(ctx => {
      if (ctx) campaignContext.value = ctx
    })
  }

  async function sendReply(content: string) {
    if (!selectedConversation.value || !content.trim()) return
    sending.value = true

    const newMsg = await run(() =>
      uniboxApi.sendMessage({
        conversation_id: selectedConversation.value!.id,
        linkedin_account_id: selectedConversation.value!.linkedin_account_id,
        content,
      }),
    )

    if (newMsg) {
      messages.value = [...messages.value, newMsg]
      conversations.value = conversations.value.map(c =>
        c.id === selectedConversation.value!.id
          ? { ...c, last_message_at: newMsg.sent_at, last_message_preview: newMsg.content }
          : c,
      )
    }

    sending.value = false
    return newMsg
  }

  async function archiveConversation(conversationId: string) {
    await run(() => uniboxApi.archiveConversation(conversationId, true))
    conversations.value = conversations.value.map(c =>
      c.id === conversationId ? { ...c, is_archived: true } : c,
    )
    if (selectedConversation.value?.id === conversationId) {
      selectedConversation.value = null
      messages.value = []
    }
  }

  async function setLabel(conversationId: string, label: string | null) {
    await run(() => uniboxApi.setConversationLabel(conversationId, label))
    conversations.value = conversations.value.map(c =>
      c.id === conversationId ? { ...c, label } : c,
    )
  }

  async function syncMessages() {
    syncing.value = true
    await run(() => uniboxApi.triggerSync())
    // Wait a bit for sync to process, then refresh
    setTimeout(async () => {
      await fetchConversations()
      syncing.value = false
    }, 3000)
  }

  function clearSelection() {
    selectedConversation.value = null
    messages.value = []
    campaignContext.value = null
  }

  // ─── Return ──────────────────────────────────────────────────────────────

  return {
    // State
    conversations,
    messages,
    selectedConversation,
    campaignContext,
    accounts,
    filter,
    searchQuery,
    selectedAccountId,
    loading,
    loadingMessages,
    sending,
    syncing,
    error,
    // Computed
    filteredConversations,
    totalUnread,
    // Actions
    fetchConversations,
    fetchAccounts,
    selectConversation,
    sendReply,
    archiveConversation,
    setLabel,
    syncMessages,
    clearSelection,
  }
})
