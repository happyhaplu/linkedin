<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useNetworkStore } from '@/stores/network'
import { useAccountStore } from '@/stores/accounts'
import { useLeadsStore } from '@/stores/leads'
import type { NetworkConnection, SyncType } from '@/types/network'

const networkStore = useNetworkStore()
const accountStore = useAccountStore()
const leadsStore = useLeadsStore()

// ── Tabs ─────────────────────────────────────────────
type Tab = 'connections' | 'sent' | 'received' | 'sync_logs'
const activeTab = ref<Tab>('connections')

// ── Filters ──────────────────────────────────────────
const filterAccount = ref('')
const filterSearch = ref('')
const filterFavorites = ref(false)

// ── Pagination ───────────────────────────────────────
const currentPage = ref(1)
const pageSize = ref(20)

// ── Selection ────────────────────────────────────────
const selectedIds = ref<Set<string>>(new Set())

// ── Modals ───────────────────────────────────────────
const showDetailModal = ref(false)
const selectedConnection = ref<NetworkConnection | null>(null)
const detailTags = ref('')
const detailNotes = ref('')

const showSyncModal = ref(false)
const syncAccountId = ref('')
const syncType = ref<SyncType>('incremental')
const syncing = ref(false)

const showAddToLeadsModal = ref(false)
const addToLeadsIds = ref<string[]>([])
const addToLeadsListId = ref('')

// ══════════════════════════════════════════════════════════════════════════════
// Computed
// ══════════════════════════════════════════════════════════════════════════════

const filteredConnections = computed(() => {
  let items = networkStore.connections
  if (filterFavorites.value) items = items.filter(c => c.is_favorite)
  return items
})

const pagedConnections = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredConnections.value.slice(start, start + pageSize.value)
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredConnections.value.length / pageSize.value)))

const pagedSentRequests = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return networkStore.sentRequests.slice(start, start + pageSize.value)
})

const pagedReceivedRequests = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return networkStore.receivedRequests.slice(start, start + pageSize.value)
})

const currentListLength = computed(() => {
  if (activeTab.value === 'connections') return filteredConnections.value.length
  if (activeTab.value === 'sent') return networkStore.sentRequests.length
  if (activeTab.value === 'received') return networkStore.receivedRequests.length
  return networkStore.syncLogs.length
})

const allPageSelected = computed(() => {
  const items = activeTab.value === 'connections' ? pagedConnections.value : (activeTab.value === 'sent' ? pagedSentRequests.value : pagedReceivedRequests.value)
  return items.length > 0 && items.every(i => selectedIds.value.has(i.id))
})

// ══════════════════════════════════════════════════════════════════════════════
// Data Loading
// ══════════════════════════════════════════════════════════════════════════════

onMounted(async () => {
  await accountStore.fetchAll()
  await loadTabData()
  await networkStore.fetchStats()
})

async function loadTabData() {
  currentPage.value = 1
  selectedIds.value = new Set()
  const f = {
    linkedin_account_id: filterAccount.value || undefined,
    search: filterSearch.value || undefined,
  }
  if (activeTab.value === 'connections') {
    await networkStore.fetchConnections({
      ...f,
      is_favorite: filterFavorites.value || undefined,
    })
  } else if (activeTab.value === 'sent') {
    await networkStore.fetchSentRequests(f)
  } else if (activeTab.value === 'received') {
    await networkStore.fetchReceivedRequests(f)
  } else {
    await networkStore.fetchSyncLogs(filterAccount.value || undefined)
  }
}

watch([activeTab, filterAccount, filterSearch, filterFavorites], () => {
  loadTabData()
})

// ══════════════════════════════════════════════════════════════════════════════
// Selection
// ══════════════════════════════════════════════════════════════════════════════

function toggleSelect(id: string) {
  const s = new Set(selectedIds.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  selectedIds.value = s
}

function toggleSelectPage(checked: boolean) {
  const items = activeTab.value === 'connections' ? pagedConnections.value : (activeTab.value === 'sent' ? pagedSentRequests.value : pagedReceivedRequests.value)
  const s = new Set(selectedIds.value)
  for (const item of items) {
    if (checked) s.add(item.id)
    else s.delete(item.id)
  }
  selectedIds.value = s
}

// ══════════════════════════════════════════════════════════════════════════════
// Connection Actions
// ══════════════════════════════════════════════════════════════════════════════

function openDetail(conn: NetworkConnection) {
  selectedConnection.value = conn
  detailTags.value = (conn.tags || []).join(', ')
  detailNotes.value = conn.notes || ''
  showDetailModal.value = true
}

async function saveDetail() {
  if (!selectedConnection.value) return
  await networkStore.updateConnection(selectedConnection.value.id, {
    tags: detailTags.value.split(',').map(t => t.trim()).filter(Boolean),
    notes: detailNotes.value || undefined,
  })
  showDetailModal.value = false
}

async function handleToggleFavorite(conn: NetworkConnection) {
  await networkStore.toggleFavorite(conn.id, !conn.is_favorite)
  await networkStore.fetchStats()
}

async function handleDeleteConnection(id: string) {
  if (!confirm('Delete this connection?')) return
  await networkStore.deleteConnection(id)
  await networkStore.fetchStats()
}

async function handleBulkDelete() {
  if (!confirm(`Delete ${selectedIds.value.size} selected connections?`)) return
  await networkStore.bulkDeleteConnections(Array.from(selectedIds.value))
  selectedIds.value = new Set()
  await networkStore.fetchStats()
}

// ── Add to Leads ─────────────────────────────────────
function openAddToLeads(ids: string[]) {
  addToLeadsIds.value = ids
  addToLeadsListId.value = ''
  leadsStore.fetchLists()
  showAddToLeadsModal.value = true
}

async function handleAddToLeads() {
  if (!addToLeadsListId.value) return
  let added = 0
  for (const connId of addToLeadsIds.value) {
    const conn = networkStore.connections.find(c => c.id === connId)
    if (!conn) continue
    try {
      await leadsStore.addFromConnection({
        list_id: addToLeadsListId.value,
        linkedin_url: conn.connection_linkedin_url || '',
        full_name: conn.full_name || `${conn.first_name || ''} ${conn.last_name || ''}`.trim(),
        position: conn.position || '',
        company: conn.company || '',
        profile_picture: conn.profile_picture_url || '',
      })
      added++
    } catch {
      // skip duplicates (409)
    }
  }
  showAddToLeadsModal.value = false
  selectedIds.value = new Set()
  alert(`✅ Added ${added} of ${addToLeadsIds.value.length} connections as leads`)
}

// ── Request Actions ──────────────────────────────────
async function handleAcceptRequest(id: string) {
  await networkStore.acceptRequest(id)
  await networkStore.fetchStats()
}

async function handleWithdrawRequest(id: string) {
  await networkStore.withdrawRequest(id)
}

async function handleBulkWithdraw() {
  if (!confirm(`Withdraw ${selectedIds.value.size} selected requests?`)) return
  await networkStore.bulkWithdrawRequests(Array.from(selectedIds.value))
  selectedIds.value = new Set()
}

// ── Sync ─────────────────────────────────────────────
function openSyncModal() {
  syncAccountId.value = filterAccount.value || (accountStore.accounts[0]?.id || '')
  syncType.value = 'incremental'
  showSyncModal.value = true
}

async function handleStartSync() {
  if (!syncAccountId.value) return
  syncing.value = true
  try {
    await networkStore.startSync({
      linkedin_account_id: syncAccountId.value,
      sync_type: syncType.value,
    })
    showSyncModal.value = false
    alert('✅ Sync completed successfully!')
    await loadTabData()
    await networkStore.fetchStats()
  } catch (e: unknown) {
    alert('Sync failed: ' + ((e as Error).message || 'Unknown error'))
  } finally {
    syncing.value = false
  }
}

// ── Helpers ──────────────────────────────────────────
function displayName(item: { first_name?: string; last_name?: string; full_name?: string }): string {
  return item.full_name || `${item.first_name || ''} ${item.last_name || ''}`.trim() || '—'
}

function initial(item: { first_name?: string; full_name?: string }): string {
  return (item.first_name?.charAt(0) || item.full_name?.charAt(0) || '?').toUpperCase()
}

function formatDate(d?: string): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDuration(sec?: number): string {
  if (!sec) return '—'
  if (sec < 60) return `${sec}s`
  return `${Math.floor(sec / 60)}m ${sec % 60}s`
}

function statusBadge(status: string): string {
  const m: Record<string, string> = {
    connected: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    withdrawn: 'bg-gray-100 text-gray-800',
    ignored: 'bg-red-100 text-red-800',
    accepted: 'bg-green-100 text-green-800',
    declined: 'bg-red-100 text-red-800',
    expired: 'bg-gray-100 text-gray-500',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    partial: 'bg-yellow-100 text-yellow-800',
  }
  return m[status] || 'bg-gray-100 text-gray-800'
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <header class="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">My Network</h1>
        <p class="text-sm text-gray-500 mt-1">Manage your LinkedIn connections and requests</p>
      </div>
      <button
        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-medium"
        @click="openSyncModal"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Sync LinkedIn
      </button>
    </header>

    <main class="flex-1 overflow-auto p-6">
      <div class="max-w-7xl mx-auto">

        <!-- ── Empty state: no accounts ──────────────────── -->
        <div v-if="accountStore.accounts.length === 0 && !networkStore.loading" class="bg-white rounded-lg shadow-sm p-12 text-center">
          <div class="text-5xl mb-4">🔗</div>
          <h3 class="text-lg font-semibold text-gray-900 mb-2">No LinkedIn Accounts Connected</h3>
          <p class="text-gray-500 mb-6">Connect a LinkedIn account first to manage your network</p>
          <router-link to="/linkedin-account" class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-2 font-medium">
            Go to LinkedIn Accounts
          </router-link>
        </div>

        <template v-else>
          <!-- ── Stats Cards ─────────────────────────────── -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div class="bg-white rounded-xl border border-gray-200 p-4">
              <p class="text-sm text-gray-500 mb-1">Total Connections</p>
              <p class="text-2xl font-bold text-gray-900">{{ networkStore.stats.totalConnections }}</p>
            </div>
            <div class="bg-white rounded-xl border border-gray-200 p-4">
              <p class="text-sm text-gray-500 mb-1">Pending Sent</p>
              <p class="text-2xl font-bold text-yellow-600">{{ networkStore.stats.pendingSent }}</p>
            </div>
            <div class="bg-white rounded-xl border border-gray-200 p-4">
              <p class="text-sm text-gray-500 mb-1">Pending Received</p>
              <p class="text-2xl font-bold text-blue-600">{{ networkStore.stats.pendingReceived }}</p>
            </div>
            <div class="bg-white rounded-xl border border-gray-200 p-4">
              <p class="text-sm text-gray-500 mb-1">Favorites</p>
              <p class="text-2xl font-bold text-pink-600">{{ networkStore.stats.favorites }}</p>
            </div>
          </div>

          <!-- ── Tabs ────────────────────────────────────── -->
          <div class="flex border-b border-gray-200 mb-4">
            <button
              v-for="tab in ([
                { key: 'connections', label: 'Connections', count: filteredConnections.length },
                { key: 'sent', label: 'Sent Requests', count: networkStore.sentRequests.length },
                { key: 'received', label: 'Received Requests', count: networkStore.receivedRequests.length },
                { key: 'sync_logs', label: 'Sync Logs', count: networkStore.syncLogs.length },
              ] as { key: Tab; label: string; count: number }[])"
              :key="tab.key"
              class="px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px"
              :class="activeTab === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'"
              @click="activeTab = tab.key"
            >
              {{ tab.label }}
              <span class="ml-1.5 text-xs px-1.5 py-0.5 rounded-full" :class="activeTab === tab.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'">{{ tab.count }}</span>
            </button>
          </div>

          <!-- ── Filters ─────────────────────────────────── -->
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
            <div class="flex flex-wrap gap-4 items-end">
              <div class="min-w-[180px]">
                <label class="block text-xs font-medium text-gray-600 mb-1">LinkedIn Account</label>
                <select v-model="filterAccount" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                  <option value="">All Accounts</option>
                  <option v-for="acc in accountStore.accounts" :key="acc.id" :value="acc.id">{{ acc.name || acc.email }}</option>
                </select>
              </div>
              <div class="flex-1 min-w-[200px]">
                <label class="block text-xs font-medium text-gray-600 mb-1">Search</label>
                <input v-model="filterSearch" type="text" placeholder="Name, company, position..." class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <label v-if="activeTab === 'connections'" class="flex items-center gap-2 pb-0.5 cursor-pointer">
                <input v-model="filterFavorites" type="checkbox" class="w-4 h-4 text-pink-600 rounded" />
                <span class="text-sm text-gray-600">Favorites only</span>
              </label>
            </div>
          </div>

          <!-- ── Bulk Actions ────────────────────────────── -->
          <div v-if="selectedIds.size > 0" class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center justify-between">
            <span class="text-sm text-blue-900 font-medium">{{ selectedIds.size }} selected</span>
            <div class="flex gap-2">
              <template v-if="activeTab === 'connections'">
                <button class="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700" @click="openAddToLeads(Array.from(selectedIds))">Add to Leads</button>
                <button class="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700" @click="handleBulkDelete">Delete Selected</button>
              </template>
              <template v-if="activeTab === 'sent'">
                <button class="px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700" @click="handleBulkWithdraw">Withdraw Selected</button>
              </template>
            </div>
          </div>

          <!-- ── Loading ─────────────────────────────────── -->
          <div v-if="networkStore.loading" class="text-center py-12">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent" />
            <p class="text-gray-500 mt-4">Loading...</p>
          </div>

          <!-- ══════════════════════════════════════════════ -->
          <!-- CONNECTIONS TAB                                -->
          <!-- ══════════════════════════════════════════════ -->
          <template v-else-if="activeTab === 'connections'">
            <div v-if="filteredConnections.length === 0" class="bg-white rounded-lg shadow-sm p-12 text-center">
              <div class="text-5xl mb-4">👥</div>
              <h3 class="text-lg font-semibold text-gray-900 mb-2">No Connections Found</h3>
              <p class="text-gray-500">Sync your LinkedIn network to see connections here</p>
            </div>
            <div v-else class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-4 py-3 text-left">
                        <input type="checkbox" :checked="allPageSelected" class="w-4 h-4 rounded text-blue-600" @change="toggleSelectPage(($event.target as HTMLInputElement).checked)" />
                      </th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Headline</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Connected</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200">
                    <tr v-for="conn in pagedConnections" :key="conn.id" class="hover:bg-gray-50">
                      <td class="px-4 py-3">
                        <input type="checkbox" :checked="selectedIds.has(conn.id)" class="w-4 h-4 rounded text-blue-600" @change="toggleSelect(conn.id)" />
                      </td>
                      <td class="px-4 py-3">
                        <div class="flex items-center gap-3">
                          <div v-if="conn.profile_picture_url" class="w-9 h-9 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                            <img :src="conn.profile_picture_url" class="w-full h-full object-cover" />
                          </div>
                          <div v-else class="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0">
                            <span class="text-white font-semibold text-xs">{{ initial(conn) }}</span>
                          </div>
                          <div class="min-w-0">
                            <div class="flex items-center gap-1.5">
                              <span class="text-sm font-medium text-gray-900 truncate">{{ displayName(conn) }}</span>
                              <button v-if="conn.is_favorite" class="text-pink-500 text-xs" title="Favorite">★</button>
                              <a v-if="conn.connection_linkedin_url" :href="conn.connection_linkedin_url" target="_blank" rel="noopener noreferrer" class="flex-shrink-0">
                                <svg class="w-3.5 h-3.5 text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                              </a>
                            </div>
                            <p v-if="conn.location" class="text-xs text-gray-400 truncate">{{ conn.location }}</p>
                          </div>
                        </div>
                      </td>
                      <td class="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{{ conn.headline || conn.position || '—' }}</td>
                      <td class="px-4 py-3 text-sm text-gray-500">{{ conn.company || '—' }}</td>
                      <td class="px-4 py-3 text-xs text-gray-500">{{ formatDate(conn.connected_at) }}</td>
                      <td class="px-4 py-3">
                        <div class="flex items-center gap-1">
                          <button class="p-1 text-gray-400 hover:text-green-600" title="Add to Leads" @click="openAddToLeads([conn.id])">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
                          </button>
                          <button class="p-1" :class="conn.is_favorite ? 'text-pink-500' : 'text-gray-400 hover:text-pink-500'" :title="conn.is_favorite ? 'Unfavorite' : 'Favorite'" @click="handleToggleFavorite(conn)">
                            <svg class="w-4 h-4" :fill="conn.is_favorite ? 'currentColor' : 'none'" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
                          </button>
                          <button class="p-1 text-gray-400 hover:text-blue-600" title="View Details" @click="openDetail(conn)">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                          </button>
                          <button class="p-1 text-gray-400 hover:text-red-600" title="Delete" @click="handleDeleteConnection(conn.id)">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </template>

          <!-- ══════════════════════════════════════════════ -->
          <!-- SENT REQUESTS TAB                              -->
          <!-- ══════════════════════════════════════════════ -->
          <template v-else-if="activeTab === 'sent'">
            <div v-if="networkStore.sentRequests.length === 0" class="bg-white rounded-lg shadow-sm p-12 text-center">
              <div class="text-5xl mb-4">📤</div>
              <h3 class="text-lg font-semibold text-gray-900 mb-2">No Sent Requests</h3>
              <p class="text-gray-500">Connection requests you've sent will appear here</p>
            </div>
            <div v-else class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-4 py-3 text-left">
                        <input type="checkbox" :checked="allPageSelected" class="w-4 h-4 rounded text-blue-600" @change="toggleSelectPage(($event.target as HTMLInputElement).checked)" />
                      </th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Headline</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sent</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200">
                    <tr v-for="req in pagedSentRequests" :key="req.id" class="hover:bg-gray-50">
                      <td class="px-4 py-3"><input type="checkbox" :checked="selectedIds.has(req.id)" class="w-4 h-4 rounded text-blue-600" @change="toggleSelect(req.id)" /></td>
                      <td class="px-4 py-3">
                        <div class="flex items-center gap-3">
                          <div v-if="req.profile_picture_url" class="w-9 h-9 rounded-full bg-gray-200 overflow-hidden flex-shrink-0"><img :src="req.profile_picture_url" class="w-full h-full object-cover" /></div>
                          <div v-else class="w-9 h-9 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center flex-shrink-0"><span class="text-white font-semibold text-xs">{{ initial(req) }}</span></div>
                          <span class="text-sm font-medium text-gray-900">{{ displayName(req) }}</span>
                        </div>
                      </td>
                      <td class="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{{ req.headline || '—' }}</td>
                      <td class="px-4 py-3"><span class="text-xs px-2 py-0.5 rounded capitalize" :class="statusBadge(req.request_status)">{{ req.request_status }}</span></td>
                      <td class="px-4 py-3 text-xs text-gray-500">{{ formatDate(req.sent_at) }}</td>
                      <td class="px-4 py-3">
                        <button v-if="req.request_status === 'pending'" class="text-xs text-yellow-700 hover:text-yellow-800 font-medium" @click="handleWithdrawRequest(req.id)">Withdraw</button>
                        <span v-else class="text-xs text-gray-400">—</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </template>

          <!-- ══════════════════════════════════════════════ -->
          <!-- RECEIVED REQUESTS TAB                          -->
          <!-- ══════════════════════════════════════════════ -->
          <template v-else-if="activeTab === 'received'">
            <div v-if="networkStore.receivedRequests.length === 0" class="bg-white rounded-lg shadow-sm p-12 text-center">
              <div class="text-5xl mb-4">📥</div>
              <h3 class="text-lg font-semibold text-gray-900 mb-2">No Received Requests</h3>
              <p class="text-gray-500">Incoming connection requests will appear here</p>
            </div>
            <div v-else class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Headline</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Message</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200">
                    <tr v-for="req in pagedReceivedRequests" :key="req.id" class="hover:bg-gray-50">
                      <td class="px-4 py-3">
                        <div class="flex items-center gap-3">
                          <div v-if="req.profile_picture_url" class="w-9 h-9 rounded-full bg-gray-200 overflow-hidden flex-shrink-0"><img :src="req.profile_picture_url" class="w-full h-full object-cover" /></div>
                          <div v-else class="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center flex-shrink-0"><span class="text-white font-semibold text-xs">{{ initial(req) }}</span></div>
                          <span class="text-sm font-medium text-gray-900">{{ displayName(req) }}</span>
                        </div>
                      </td>
                      <td class="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{{ req.headline || '—' }}</td>
                      <td class="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{{ req.message || '—' }}</td>
                      <td class="px-4 py-3"><span class="text-xs px-2 py-0.5 rounded capitalize" :class="statusBadge(req.request_status)">{{ req.request_status }}</span></td>
                      <td class="px-4 py-3">
                        <div class="flex gap-2">
                          <button v-if="req.request_status === 'pending'" class="text-xs text-green-700 hover:text-green-800 font-medium" @click="handleAcceptRequest(req.id)">Accept</button>
                          <button v-if="req.request_status === 'pending'" class="text-xs text-gray-500 hover:text-gray-700" @click="handleWithdrawRequest(req.id)">Decline</button>
                          <span v-if="req.request_status !== 'pending'" class="text-xs text-gray-400">{{ req.request_status }}</span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </template>

          <!-- ══════════════════════════════════════════════ -->
          <!-- SYNC LOGS TAB                                  -->
          <!-- ══════════════════════════════════════════════ -->
          <template v-else>
            <div v-if="networkStore.syncLogs.length === 0" class="bg-white rounded-lg shadow-sm p-12 text-center">
              <div class="text-5xl mb-4">📊</div>
              <h3 class="text-lg font-semibold text-gray-900 mb-2">No Sync History</h3>
              <p class="text-gray-500">Run your first sync to see logs here</p>
            </div>
            <div v-else class="space-y-3">
              <div v-for="log in networkStore.syncLogs" :key="log.id" class="bg-white rounded-lg border border-gray-200 p-4">
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-3">
                    <span class="text-xs px-2 py-0.5 rounded capitalize" :class="statusBadge(log.sync_status)">{{ log.sync_status.replace(/_/g, ' ') }}</span>
                    <span class="text-xs text-gray-500 uppercase">{{ log.sync_type }}</span>
                  </div>
                  <div class="text-xs text-gray-500">
                    {{ formatDate(log.started_at) }} · {{ formatDuration(log.duration_seconds) }}
                  </div>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div><span class="text-gray-500">Synced:</span> <span class="font-medium">{{ log.total_connections_synced }}</span></div>
                  <div><span class="text-gray-500">New:</span> <span class="font-medium text-green-600">+{{ log.new_connections_added }}</span></div>
                  <div><span class="text-gray-500">Updated:</span> <span class="font-medium text-blue-600">{{ log.connections_updated }}</span></div>
                  <div><span class="text-gray-500">Requests:</span> <span class="font-medium">{{ log.total_requests_synced }}</span></div>
                </div>
                <p v-if="log.error_message" class="mt-2 text-xs text-red-600 bg-red-50 rounded p-2">{{ log.error_message }}</p>
              </div>
            </div>
          </template>

          <!-- ── Pagination ──────────────────────────────── -->
          <div v-if="currentListLength > 0 && activeTab !== 'sync_logs'" class="flex items-center justify-between mt-4 bg-white rounded-lg border border-gray-200 px-4 py-3">
            <div class="flex items-center gap-3 text-sm text-gray-500">
              <span>Showing {{ Math.min((currentPage - 1) * pageSize + 1, currentListLength) }}–{{ Math.min(currentPage * pageSize, currentListLength) }} of {{ currentListLength }}</span>
              <select v-model="pageSize" class="px-2 py-1 border border-gray-300 rounded text-xs" @change="currentPage = 1">
                <option :value="20">20 / page</option>
                <option :value="50">50 / page</option>
                <option :value="100">100 / page</option>
              </select>
            </div>
            <div class="flex gap-1">
              <button :disabled="currentPage <= 1" class="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40" @click="currentPage--">← Prev</button>
              <button :disabled="currentPage >= totalPages" class="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40" @click="currentPage++">Next →</button>
            </div>
          </div>
        </template>
      </div>
    </main>

    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <!-- CONNECTION DETAIL MODAL                                                -->
    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <div v-if="showDetailModal && selectedConnection" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" @click.self="showDetailModal = false">
      <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-bold text-gray-900">Connection Details</h2>
          <button class="p-2 hover:bg-gray-100 rounded-lg" @click="showDetailModal = false">
            <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="flex-1 overflow-auto px-6 py-4 space-y-5">
          <!-- Profile Header -->
          <div class="flex items-center gap-4">
            <div v-if="selectedConnection.profile_picture_url" class="w-16 h-16 rounded-full bg-gray-200 overflow-hidden border-2 border-gray-100 flex-shrink-0">
              <img :src="selectedConnection.profile_picture_url" class="w-full h-full object-cover" />
            </div>
            <div v-else class="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0">
              <span class="text-white font-bold text-xl">{{ initial(selectedConnection) }}</span>
            </div>
            <div>
              <h3 class="text-lg font-bold text-gray-900">{{ displayName(selectedConnection) }}</h3>
              <p v-if="selectedConnection.headline" class="text-sm text-gray-500">{{ selectedConnection.headline }}</p>
              <div class="flex items-center gap-2 mt-1">
                <span class="text-xs px-2 py-0.5 rounded capitalize" :class="statusBadge(selectedConnection.connection_status)">{{ selectedConnection.connection_status }}</span>
                <span v-if="selectedConnection.is_favorite" class="text-xs text-pink-500 font-medium">★ Favorite</span>
                <a v-if="selectedConnection.connection_linkedin_url" :href="selectedConnection.connection_linkedin_url" target="_blank" rel="noopener noreferrer" class="text-blue-600 text-xs font-medium hover:text-blue-700">View LinkedIn →</a>
              </div>
            </div>
          </div>

          <!-- Info Grid -->
          <div class="grid grid-cols-2 gap-3 text-sm">
            <template v-for="field in [
              { label: 'Position', value: selectedConnection.position },
              { label: 'Company', value: selectedConnection.company },
              { label: 'Location', value: selectedConnection.location },
              { label: 'Connected', value: formatDate(selectedConnection.connected_at) },
              { label: 'Mutual', value: selectedConnection.mutual_connections_count ? `${selectedConnection.mutual_connections_count} connections` : null },
            ].filter(f => f.value)" :key="field.label">
              <dt class="text-gray-500 font-medium">{{ field.label }}</dt>
              <dd class="text-gray-900">{{ field.value }}</dd>
            </template>
          </div>

          <!-- Tags -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Tags</label>
            <input v-model="detailTags" type="text" placeholder="tag1, tag2, tag3..." class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
          </div>

          <!-- Notes -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea v-model="detailNotes" rows="3" placeholder="Add notes..." class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
        </div>
        <div class="flex gap-3 px-6 py-4 border-t border-gray-200">
          <button class="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50" @click="showDetailModal = false">Cancel</button>
          <button class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700" @click="saveDetail">Save Changes</button>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <!-- SYNC MODAL                                                             -->
    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <div v-if="showSyncModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" @click.self="showSyncModal = false">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-bold text-gray-900">Sync LinkedIn Network</h2>
          <button class="p-2 hover:bg-gray-100 rounded-lg" @click="showSyncModal = false">
            <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="px-6 py-5 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">LinkedIn Account</label>
            <select v-model="syncAccountId" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
              <option value="">Select account...</option>
              <option v-for="acc in accountStore.accounts" :key="acc.id" :value="acc.id">{{ acc.name || acc.email }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Sync Type</label>
            <div class="space-y-2">
              <label class="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
                <input v-model="syncType" type="radio" value="incremental" class="w-4 h-4 text-blue-600" />
                <div>
                  <p class="text-sm font-medium text-gray-900">Incremental</p>
                  <p class="text-xs text-gray-500">Only sync new connections since last sync</p>
                </div>
              </label>
              <label class="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
                <input v-model="syncType" type="radio" value="full" class="w-4 h-4 text-blue-600" />
                <div>
                  <p class="text-sm font-medium text-gray-900">Full Sync</p>
                  <p class="text-xs text-gray-500">Re-sync all connections (slower)</p>
                </div>
              </label>
            </div>
          </div>
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
            <strong>Note:</strong> Syncing uses your LinkedIn session to fetch connections. This may take a few minutes depending on network size.
          </div>
        </div>
        <div class="flex gap-3 px-6 py-4 border-t border-gray-200">
          <button class="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50" @click="showSyncModal = false">Cancel</button>
          <button :disabled="!syncAccountId || syncing" class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50" @click="handleStartSync">
            {{ syncing ? 'Syncing...' : '🔄 Start Sync' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <!-- ADD TO LEADS MODAL                                                     -->
    <!-- ═══════════════════════════════════════════════════════════════════════ -->
    <div v-if="showAddToLeadsModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" @click.self="showAddToLeadsModal = false">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-bold text-gray-900">Add to Leads</h2>
          <button class="p-2 hover:bg-gray-100 rounded-lg" @click="showAddToLeadsModal = false">
            <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="px-6 py-5 space-y-4">
          <p class="text-sm text-gray-600">Add {{ addToLeadsIds.length }} connection(s) to a lead list</p>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Select List</label>
            <select v-model="addToLeadsListId" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
              <option value="">Choose a list...</option>
              <option v-for="list in leadsStore.lists" :key="list.id" :value="list.id">{{ list.name }} ({{ list.lead_count }} leads)</option>
            </select>
          </div>
        </div>
        <div class="flex gap-3 px-6 py-4 border-t border-gray-200">
          <button class="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50" @click="showAddToLeadsModal = false">Cancel</button>
          <button :disabled="!addToLeadsListId" class="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50" @click="handleAddToLeads">
            Add to Leads
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
