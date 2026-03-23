// ══════════════════════════════════════════════════════════════════════════════
// My Network — API service covering all 20 Go backend endpoints
// ══════════════════════════════════════════════════════════════════════════════

import api from './client'
import type {
  NetworkConnection,
  ConnectionRequest,
  NetworkSyncLog,
  GetConnectionsFilter,
  CreateConnectionRequest,
  UpdateConnectionDTO,
  ToggleFavoriteRequest,
  BulkConnectionIDsRequest,
  BulkUpdateTagsRequest,
  GetConnectionRequestsFilter,
  CreateConnReqDTO,
  UpdateConnReqDTO,
  BulkRequestIDsRequest,
  StartSyncRequest,
  ConnectionStatsResponse,
  NetworkAnalyticsResponse,
} from '@/types/network'

// ── Connections (9 endpoints) ────────────────────────────────────────────────

export const networkApi = {
  // GET /api/network/connections
  getConnections(filter?: GetConnectionsFilter) {
    return api.get<NetworkConnection[]>('/network/connections', { params: filter })
      .then(r => r.data)
  },

  // GET /api/network/connections/stats
  getConnectionStats() {
    return api.get<ConnectionStatsResponse>('/network/connections/stats')
      .then(r => r.data)
  },

  // GET /api/network/connections/:id
  getConnectionById(id: string) {
    return api.get<NetworkConnection>(`/network/connections/${id}`)
      .then(r => r.data)
  },

  // POST /api/network/connections
  createConnection(data: CreateConnectionRequest) {
    return api.post<NetworkConnection>('/network/connections', data)
      .then(r => r.data)
  },

  // PUT /api/network/connections/:id
  updateConnection(id: string, data: UpdateConnectionDTO) {
    return api.put<NetworkConnection>(`/network/connections/${id}`, data)
      .then(r => r.data)
  },

  // DELETE /api/network/connections/:id
  deleteConnection(id: string) {
    return api.delete(`/network/connections/${id}`)
  },

  // POST /api/network/connections/:id/favorite
  toggleFavorite(id: string, data: ToggleFavoriteRequest) {
    return api.post<NetworkConnection>(`/network/connections/${id}/favorite`, data)
      .then(r => r.data)
  },

  // POST /api/network/connections/bulk-delete
  bulkDeleteConnections(data: BulkConnectionIDsRequest) {
    return api.post('/network/connections/bulk-delete', data)
  },

  // POST /api/network/connections/bulk-tags
  bulkUpdateTags(data: BulkUpdateTagsRequest) {
    return api.post('/network/connections/bulk-tags', data)
  },

  // ── Connection Requests (7 endpoints) ──────────────────────────────────────

  // GET /api/network/requests
  getRequests(filter?: GetConnectionRequestsFilter) {
    return api.get<ConnectionRequest[]>('/network/requests', { params: filter })
      .then(r => r.data)
  },

  // POST /api/network/requests
  createRequest(data: CreateConnReqDTO) {
    return api.post<ConnectionRequest>('/network/requests', data)
      .then(r => r.data)
  },

  // PUT /api/network/requests/:id
  updateRequest(id: string, data: UpdateConnReqDTO) {
    return api.put<ConnectionRequest>(`/network/requests/${id}`, data)
      .then(r => r.data)
  },

  // POST /api/network/requests/:id/accept
  acceptRequest(id: string) {
    return api.post<ConnectionRequest>(`/network/requests/${id}/accept`)
      .then(r => r.data)
  },

  // POST /api/network/requests/:id/withdraw
  withdrawRequest(id: string) {
    return api.post<ConnectionRequest>(`/network/requests/${id}/withdraw`)
      .then(r => r.data)
  },

  // DELETE /api/network/requests/:id
  deleteRequest(id: string) {
    return api.delete(`/network/requests/${id}`)
  },

  // POST /api/network/requests/bulk-withdraw
  bulkWithdrawRequests(data: BulkRequestIDsRequest) {
    return api.post('/network/requests/bulk-withdraw', data)
  },

  // ── Sync (3 endpoints) ─────────────────────────────────────────────────────

  // POST /api/network/sync
  startSync(data: StartSyncRequest) {
    return api.post('/network/sync', data).then(r => r.data)
  },

  // GET /api/network/sync/logs
  getSyncLogs(linkedinAccountId?: string) {
    return api.get<NetworkSyncLog[]>('/network/sync/logs', {
      params: linkedinAccountId ? { linkedin_account_id: linkedinAccountId } : undefined,
    }).then(r => r.data)
  },

  // GET /api/network/sync/latest
  getLatestSyncLog(linkedinAccountId: string) {
    return api.get<NetworkSyncLog | null>('/network/sync/latest', {
      params: { linkedin_account_id: linkedinAccountId },
    }).then(r => r.data)
  },

  // ── Analytics (1 endpoint) ─────────────────────────────────────────────────

  // GET /api/network/analytics
  getAnalytics(linkedinAccountId?: string) {
    return api.get<NetworkAnalyticsResponse>('/network/analytics', {
      params: linkedinAccountId ? { linkedin_account_id: linkedinAccountId } : undefined,
    }).then(r => r.data)
  },
}
