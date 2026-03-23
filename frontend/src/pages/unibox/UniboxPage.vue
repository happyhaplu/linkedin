<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useUniboxStore } from '@/stores/unibox'
import { LABELS } from '@/types/unibox'
import type { ConversationFilter, Conversation } from '@/types/unibox'

const store = useUniboxStore()
const replyText = ref('')
const messagesEndRef = ref<HTMLDivElement | null>(null)
let refreshInterval: ReturnType<typeof setInterval> | null = null

// ─── Lifecycle ─────────────────────────────────────────────────────────────

onMounted(async () => {
  await Promise.all([store.fetchConversations(), store.fetchAccounts()])
  // Auto-refresh every 30s
  refreshInterval = setInterval(() => {
    store.fetchConversations()
  }, 30000)
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})

// Auto-scroll when messages change
watch(
  () => store.messages.length,
  () => {
    nextTick(() => {
      messagesEndRef.value?.scrollIntoView({ behavior: 'smooth' })
    })
  },
)

// ─── Handlers ──────────────────────────────────────────────────────────────

async function handleSelectConversation(conv: Conversation) {
  await store.selectConversation(conv)
}

async function handleSendReply() {
  if (!replyText.value.trim() || store.sending) return
  const msg = await store.sendReply(replyText.value)
  if (msg) replyText.value = ''
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSendReply()
  }
}

async function handleArchive(conversationId: string) {
  await store.archiveConversation(conversationId)
}

async function handleLabel(conversationId: string, label: string | null) {
  await store.setLabel(conversationId, label)
}

async function handleSync() {
  await store.syncMessages()
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const tabs: { key: ConversationFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'needs_reply', label: 'Needs Reply' },
  { key: 'archived', label: 'Archived' },
]

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatMessageTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function getInitial(name: string): string {
  return name?.[0]?.toUpperCase() || '?'
}
</script>

<template>
  <div class="flex h-full">
    <!-- ═══ Left Panel: Conversation List ═══ -->
    <div class="w-[380px] bg-white border-r border-gray-200 flex flex-col">

      <!-- Header + Sync -->
      <div class="px-4 pt-4 pb-2 flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <span v-if="store.totalUnread > 0" class="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {{ store.totalUnread }}
          </span>
        </div>
        <button
          :disabled="store.syncing"
          class="flex items-center space-x-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors disabled:opacity-50"
          title="Sync messages from LinkedIn"
          @click="handleSync"
        >
          <svg :class="['h-4 w-4', store.syncing ? 'animate-spin' : '']" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
          </svg>
          <span>{{ store.syncing ? 'Syncing...' : 'Sync' }}</span>
        </button>
      </div>

      <!-- Search -->
      <div class="px-4 pb-2">
        <div class="relative">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            v-model="store.searchQuery"
            type="text"
            placeholder="Search..."
            class="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
          />
        </div>
      </div>

      <!-- Account Filter -->
      <div v-if="store.accounts.length > 1" class="px-4 pb-2">
        <select
          v-model="store.selectedAccountId"
          class="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50"
        >
          <option value="all">All Accounts</option>
          <option v-for="acc in store.accounts" :key="acc.id" :value="acc.id">{{ acc.email }}</option>
        </select>
      </div>

      <!-- Tabs -->
      <div class="px-4 pb-3">
        <div class="flex space-x-1 bg-gray-100 p-0.5 rounded-lg">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            :class="[
              'flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors',
              store.filter === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700',
            ]"
            @click="store.filter = tab.key"
          >
            {{ tab.label }}{{ tab.key === 'unread' && store.totalUnread > 0 ? ` (${store.totalUnread})` : '' }}
          </button>
        </div>
      </div>

      <!-- Conversation List -->
      <div class="flex-1 overflow-y-auto">
        <!-- Empty State -->
        <div v-if="store.filteredConversations.length === 0" class="flex flex-col items-center justify-center h-full text-gray-400 p-6">
          <svg class="h-10 w-10 mb-2" fill="currentColor" viewBox="0 0 24 24">
            <path d="M21.731 2.269a2.625 2.625 0 0 0-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 0 0 0-3.712Zm-2.218 5.93-3.712-3.712-8.4 8.4a5.25 5.25 0 0 0-1.32 2.214l-.8 2.685a.75.75 0 0 0 .933.933l2.685-.8a5.25 5.25 0 0 0 2.214-1.32l8.4-8.4Z" />
            <path d="M5.25 5.25a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3V13.5a.75.75 0 0 0-1.5 0v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V8.25a1.5 1.5 0 0 1 1.5-1.5h5.25a.75.75 0 0 0 0-1.5H5.25Z" />
          </svg>
          <p class="text-sm">
            {{ store.conversations.length === 0
              ? 'No conversations yet — click Sync to pull from LinkedIn'
              : 'No conversations match this filter'
            }}
          </p>
        </div>

        <!-- Conversation Items -->
        <div
          v-for="conv in store.filteredConversations"
          :key="conv.id"
          :class="[
            'px-4 py-3 cursor-pointer transition-colors border-b border-gray-50',
            store.selectedConversation?.id === conv.id
              ? 'bg-blue-50 border-l-3 border-l-blue-500'
              : 'hover:bg-gray-50',
          ]"
          @click="handleSelectConversation(conv)"
        >
          <div class="flex items-start space-x-3">
            <!-- Avatar -->
            <div class="flex-shrink-0 relative">
              <img
                v-if="conv.participant_avatar_url"
                :src="conv.participant_avatar_url"
                :alt="conv.participant_name"
                class="h-10 w-10 rounded-full object-cover"
              />
              <div
                v-else
                class="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm"
              >
                {{ getInitial(conv.participant_name) }}
              </div>
              <div v-if="conv.unread_count > 0" class="absolute -top-1 -right-1 h-3 w-3 bg-blue-500 rounded-full border-2 border-white" />
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <h3 :class="['text-sm truncate', conv.unread_count > 0 ? 'font-bold text-gray-900' : 'font-medium text-gray-700']">
                  {{ conv.participant_name }}
                </h3>
                <span class="text-[11px] text-gray-400 ml-2 flex-shrink-0">
                  {{ formatRelativeTime(conv.last_message_at) }}
                </span>
              </div>
              <p :class="['text-xs truncate mt-0.5', conv.unread_count > 0 ? 'font-medium text-gray-800' : 'text-gray-500']">
                {{ conv.last_message_preview || 'No messages' }}
              </p>
              <span
                v-if="conv.label && LABELS[conv.label]"
                :class="['inline-flex items-center mt-1 px-1.5 py-0.5 text-[10px] font-medium rounded border', LABELS[conv.label].bg, LABELS[conv.label].color]"
              >
                {{ LABELS[conv.label].emoji }} {{ conv.label.replace('_', ' ') }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ Right Panel: Thread ═══ -->
    <div class="flex-1 flex flex-col bg-gray-50">

      <!-- Selected Conversation -->
      <template v-if="store.selectedConversation">

        <!-- Thread Header -->
        <div class="bg-white border-b border-gray-200 px-6 py-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <img
                v-if="store.selectedConversation.participant_avatar_url"
                :src="store.selectedConversation.participant_avatar_url"
                :alt="store.selectedConversation.participant_name"
                class="h-9 w-9 rounded-full object-cover"
              />
              <div
                v-else
                class="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm"
              >
                {{ getInitial(store.selectedConversation.participant_name) }}
              </div>
              <div>
                <h2 class="text-sm font-semibold text-gray-900">
                  {{ store.selectedConversation.participant_name }}
                </h2>
                <p v-if="store.selectedConversation.participant_headline" class="text-xs text-gray-500 truncate max-w-md">
                  {{ store.selectedConversation.participant_headline }}
                </p>
              </div>
            </div>

            <div class="flex items-center space-x-1">
              <!-- Label Picker -->
              <select
                :value="store.selectedConversation.label || ''"
                class="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white"
                @change="handleLabel(store.selectedConversation!.id, ($event.target as HTMLSelectElement).value || null)"
              >
                <option value="">No label</option>
                <option v-for="(cfg, key) in LABELS" :key="key" :value="key">
                  {{ cfg.emoji }} {{ String(key).replace('_', ' ') }}
                </option>
              </select>

              <!-- Profile Link -->
              <a
                v-if="store.selectedConversation.participant_profile_url"
                :href="store.selectedConversation.participant_profile_url"
                target="_blank"
                rel="noopener noreferrer"
                class="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors"
              >
                Profile ↗
              </a>

              <!-- Archive -->
              <button
                class="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                title="Archive"
                @click="handleArchive(store.selectedConversation!.id)"
              >
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0-3-3m3 3 3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Campaign Context -->
          <div v-if="store.campaignContext" class="mt-2 flex items-center space-x-3 text-xs text-gray-500 bg-gray-50 rounded-md px-3 py-1.5">
            <span>📋 Campaign: <span class="font-medium text-gray-700">{{ store.campaignContext.campaignName }}</span></span>
            <span v-if="store.campaignContext.company">🏢 {{ store.campaignContext.company }}</span>
            <span v-if="store.campaignContext.leadStatus" class="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-medium">
              {{ store.campaignContext.leadStatus }}
            </span>
          </div>
        </div>

        <!-- Messages -->
        <div class="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          <!-- Loading -->
          <div v-if="store.loadingMessages" class="flex justify-center items-center h-full">
            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          </div>

          <!-- Empty -->
          <div v-else-if="store.messages.length === 0" class="flex justify-center items-center h-full text-gray-400 text-sm">
            No messages yet
          </div>

          <!-- Message Bubbles -->
          <template v-else>
            <div v-for="msg in store.messages" :key="msg.id" :class="['flex', msg.is_from_me ? 'justify-end' : 'justify-start']">
              <div
                :class="[
                  'max-w-md px-4 py-2.5',
                  msg.is_from_me
                    ? 'bg-blue-600 text-white rounded-2xl rounded-br-sm'
                    : 'bg-white text-gray-900 rounded-2xl rounded-bl-sm shadow-sm border border-gray-100',
                ]"
              >
                <p class="text-sm whitespace-pre-wrap">{{ msg.content }}</p>
                <p :class="['text-[10px] mt-1', msg.is_from_me ? 'text-blue-200' : 'text-gray-400']">
                  {{ formatMessageTime(msg.sent_at) }}
                </p>
              </div>
            </div>
          </template>
          <div ref="messagesEndRef" />
        </div>

        <!-- Reply Composer -->
        <div class="bg-white border-t border-gray-200 p-3">
          <div class="flex items-end space-x-2">
            <textarea
              v-model="replyText"
              placeholder="Type a message..."
              rows="2"
              class="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-gray-50"
              @keydown="handleKeyDown"
            />
            <button
              :disabled="!replyText.trim() || store.sending"
              class="p-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Send (Enter)"
              @click="handleSendReply"
            >
              <div v-if="store.sending" class="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              <svg v-else class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
              </svg>
            </button>
          </div>
          <p class="text-[10px] text-gray-400 mt-1 ml-1">
            Enter to send · Shift+Enter for new line · Messages are sent via LinkedIn
          </p>
        </div>
      </template>

      <!-- No Conversation Selected -->
      <div v-else class="flex-1 flex flex-col items-center justify-center text-gray-400">
        <svg class="h-14 w-14 mb-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19.5 22.5a3 3 0 0 0 3-3v-8.174l-6.879 4.022 3.485 1.876a.75.75 0 1 1-.712 1.321l-5.683-3.06a1.5 1.5 0 0 0-1.422 0l-5.683 3.06a.75.75 0 0 1-.712-1.32l3.485-1.877L1.5 11.326V19.5a3 3 0 0 0 3 3h15Z" />
          <path d="M1.5 9.589v-.745a3 3 0 0 1 1.578-2.642l7.5-4.038a3 3 0 0 1 2.844 0l7.5 4.038A3 3 0 0 1 22.5 8.844v.745l-8.426 4.926-.652-.351a3 3 0 0 0-2.844 0l-.652.351L1.5 9.589Z" />
        </svg>
        <p class="text-base font-medium text-gray-500">Select a conversation</p>
        <p class="text-sm mt-1">
          {{ store.conversations.length === 0
            ? 'Click "Sync" to pull conversations from LinkedIn'
            : 'Choose a conversation from the left'
          }}
        </p>
      </div>
    </div>
  </div>
</template>
