// ══════════════════════════════════════════════════════════════════════════════
// My Network — Pinia store
// ══════════════════════════════════════════════════════════════════════════════

import { ref } from 'vue'
import { defineStore } from 'pinia'
import { networkApi } from '@/api/network'
import type {
  NetworkConnection,
  ConnectionRequest,
  NetworkSyncLog,
  GetConnectionsFilter,
  UpdateConnectionDTO,
  GetConnectionRequestsFilter,
  ConnectionStatsResponse,
  NetworkAnalyticsResponse,
  StartSyncRequest,
} from '@/types/network'

export const useNetworkStore = defineStore('network', () => {
  // ── State ──────────────────────────────────────────────────────────────────
  const connections = ref<NetworkConnection[]>([])
  const sentRequests = ref<ConnectionRequest[]>([])
  const receivedRequests = ref<ConnectionRequest[]>([])
  const syncLogs = ref<NetworkSyncLog[]>([])
  const stats = ref<ConnectionStatsResponse>({ totalConnections: 0, pendingSent: 0, pendingReceived: 0, favorites: 0 })
  const analytics = ref<NetworkAnalyticsResponse | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ── Helpers ────────────────────────────────────────────────────────────────
  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    loading.value = true
    error.value = null
    try {
      return await fn()
    } catch (e: unknown) {
      error.value = (e as Error).message || 'Unknown error'
      return undefined
    } finally {
      loading.value = false
    }
  }

  // ── Connections ────────────────────────────────────────────────────────────
  async function fetchConnections(filter?: GetConnectionsFilter) {
    const data = await run(() => networkApi.getConnections(filter))
    if (data) connections.value = data
  }

  async function fetchStats() {
    const data = await run(() => networkApi.getConnectionStats())
    if (data) stats.value = data
  }

  async function updateConnection(id: string, dto: UpdateConnectionDTO) {
    const updated = await run(() => networkApi.updateConnection(id, dto))
    if (updated) {
      const idx = connections.value.findIndex(c => c.id === id)
      if (idx !== -1) connections.value[idx] = updated
    }
    return updated
  }

  async function deleteConnection(id: string) {
    await run(() => networkApi.deleteConnection(id))
    connections.value = connections.value.filter(c => c.id !== id)
  }

  async function toggleFavorite(id: string, isFavorite: boolean) {
    const updated = await run(() => networkApi.toggleFavorite(id, { is_favorite: isFavorite }))
    if (updated) {
      const idx = connections.value.findIndex(c => c.id === id)
      if (idx !== -1) connections.value[idx] = updated
    }
  }

  async function bulkDeleteConnections(ids: string[]) {
    await run(() => networkApi.bulkDeleteConnections({ connection_ids: ids }))
    connections.value = connections.value.filter(c => !ids.includes(c.id))
  }

  async function bulkUpdateTags(ids: string[], tags: string[]) {
    await run(() => networkApi.bulkUpdateTags({ connection_ids: ids, tags }))
    for (const conn of connections.value) {
      if (ids.includes(conn.id)) conn.tags = tags
    }
  }

  // ── Connection Requests ────────────────────────────────────────────────────
  async function fetchSentRequests(filter?: GetConnectionRequestsFilter) {
    const data = await run(() => networkApi.getRequests({ ...filter, request_type: 'sent' }))
    if (data) sentRequests.value = data
  }

  async function fetchReceivedRequests(filter?: GetConnectionRequestsFilter) {
    const data = await run(() => networkApi.getRequests({ ...filter, request_type: 'received' }))
    if (data) receivedRequests.value = data
  }

  async function acceptRequest(id: string) {
    const updated = await run(() => networkApi.acceptRequest(id))
    if (updated) {
      receivedRequests.value = receivedRequests.value.filter(r => r.id !== id)
    }
    return updated
  }

  async function withdrawRequest(id: string) {
    const updated = await run(() => networkApi.withdrawRequest(id))
    if (updated) {
      const idx = sentRequests.value.findIndex(r => r.id === id)
      if (idx !== -1) sentRequests.value[idx] = updated
    }
    return updated
  }

  async function deleteRequest(id: string) {
    await run(() => networkApi.deleteRequest(id))
    sentRequests.value = sentRequests.value.filter(r => r.id !== id)
    receivedRequests.value = receivedRequests.value.filter(r => r.id !== id)
  }

  async function bulkWithdrawRequests(ids: string[]) {
    await run(() => networkApi.bulkWithdrawRequests({ request_ids: ids }))
    for (const req of sentRequests.value) {
      if (ids.includes(req.id)) req.request_status = 'withdrawn'
    }
  }

  // ── Sync ───────────────────────────────────────────────────────────────────
  async function startSync(req: StartSyncRequest) {
    return await run(() => networkApi.startSync(req))
  }

  async function fetchSyncLogs(linkedinAccountId?: string) {
    const data = await run(() => networkApi.getSyncLogs(linkedinAccountId))
    if (data) syncLogs.value = data
  }

  // ── Analytics ──────────────────────────────────────────────────────────────
  async function fetchAnalytics(linkedinAccountId?: string) {
    const data = await run(() => networkApi.getAnalytics(linkedinAccountId))
    if (data) analytics.value = data
  }

  return {
    // State
    connections,
    sentRequests,
    receivedRequests,
    syncLogs,
    stats,
    analytics,
    loading,
    error,
    // Connections
    fetchConnections,
    fetchStats,
    updateConnection,
    deleteConnection,
    toggleFavorite,
    bulkDeleteConnections,
    bulkUpdateTags,
    // Requests
    fetchSentRequests,
    fetchReceivedRequests,
    acceptRequest,
    withdrawRequest,
    deleteRequest,
    bulkWithdrawRequests,
    // Sync
    startSync,
    fetchSyncLogs,
    // Analytics
    fetchAnalytics,
  }
})
