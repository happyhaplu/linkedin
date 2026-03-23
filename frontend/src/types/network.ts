// ══════════════════════════════════════════════════════════════════════════════
// My Network — TypeScript types matching Go backend models & DTOs
// ══════════════════════════════════════════════════════════════════════════════

// ── Enums ────────────────────────────────────────────────────────────────────

export type ConnectionStatus = 'connected' | 'pending' | 'withdrawn' | 'ignored'

export type RequestType = 'sent' | 'received'

export type RequestStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn' | 'expired'

export type SyncType = 'full' | 'incremental' | 'connection_requests'

export type SyncStatus = 'in_progress' | 'completed' | 'failed' | 'partial'

// ── Models ───────────────────────────────────────────────────────────────────

export interface NetworkConnection {
  id: string
  user_id: string
  linkedin_account_id: string

  // Connection details
  connection_linkedin_url?: string
  connection_profile_id?: string
  first_name?: string
  last_name?: string
  full_name?: string
  headline?: string
  profile_picture_url?: string
  location?: string
  company?: string
  position?: string

  // Metadata
  connection_status: ConnectionStatus
  connected_at?: string
  mutual_connections_count: number

  // Tags / Notes
  tags?: string[]
  notes?: string
  is_favorite: boolean

  // Sync
  last_synced_at?: string
  is_synced: boolean

  // Timestamps
  created_at: string
  updated_at: string

  // Relations
  linkedin_account?: {
    id: string
    email?: string
    full_name?: string
    profile_picture_url?: string
  }
}

export interface ConnectionRequest {
  id: string
  user_id: string
  linkedin_account_id: string

  // Request details
  target_linkedin_url?: string
  target_profile_id?: string
  first_name?: string
  last_name?: string
  full_name?: string
  headline?: string
  profile_picture_url?: string
  location?: string
  company?: string
  position?: string

  // Metadata
  request_type: RequestType
  request_status: RequestStatus
  message?: string

  // Dates
  sent_at?: string
  responded_at?: string
  expires_at?: string

  // Campaign
  campaign_id?: string
  is_automated: boolean

  // Timestamps
  created_at: string
  updated_at: string

  // Relations
  linkedin_account?: {
    id: string
    email?: string
    full_name?: string
    profile_picture_url?: string
  }
}

export interface NetworkSyncLog {
  id: string
  user_id: string
  linkedin_account_id: string

  // Sync details
  sync_type: SyncType
  sync_status: SyncStatus

  // Results
  total_connections_synced: number
  new_connections_added: number
  connections_updated: number
  connections_removed: number

  // Requests results
  total_requests_synced: number
  pending_requests: number
  accepted_requests: number

  // Error
  error_message?: string
  error_details?: Record<string, unknown>

  // Timing
  started_at: string
  completed_at?: string
  duration_seconds?: number

  // Timestamps
  created_at: string
  updated_at: string

  // Relations
  linkedin_account?: {
    id: string
    email?: string
    full_name?: string
    profile_picture_url?: string
  }
}

// ── DTOs — Connections ───────────────────────────────────────────────────────

export interface GetConnectionsFilter {
  linkedin_account_id?: string
  connection_status?: string
  search?: string
  is_favorite?: boolean
  tags?: string
}

export interface CreateConnectionRequest {
  linkedin_account_id: string
  connection_linkedin_url?: string
  connection_profile_id?: string
  first_name?: string
  last_name?: string
  full_name?: string
  headline?: string
  profile_picture_url?: string
  location?: string
  company?: string
  position?: string
  connected_at?: string
  tags?: string[]
  notes?: string
}

export interface UpdateConnectionDTO {
  first_name?: string
  last_name?: string
  full_name?: string
  headline?: string
  profile_picture_url?: string
  location?: string
  company?: string
  position?: string
  connection_status?: ConnectionStatus
  tags?: string[]
  notes?: string
  is_favorite?: boolean
  connection_linkedin_url?: string
  connection_profile_id?: string
}

export interface ToggleFavoriteRequest {
  is_favorite: boolean
}

export interface BulkConnectionIDsRequest {
  connection_ids: string[]
}

export interface BulkUpdateTagsRequest {
  connection_ids: string[]
  tags: string[]
}

// ── DTOs — Connection Requests ───────────────────────────────────────────────

export interface GetConnectionRequestsFilter {
  linkedin_account_id?: string
  request_type?: string
  request_status?: string
  search?: string
}

export interface CreateConnReqDTO {
  linkedin_account_id: string
  target_linkedin_url: string
  target_profile_id?: string
  first_name?: string
  last_name?: string
  full_name?: string
  headline?: string
  profile_picture_url?: string
  location?: string
  company?: string
  position?: string
  request_type: string
  message?: string
  campaign_id?: string
  is_automated?: boolean
}

export interface UpdateConnReqDTO {
  request_status?: RequestStatus
  responded_at?: string
  message?: string
}

export interface BulkRequestIDsRequest {
  request_ids: string[]
}

// ── DTOs — Sync ──────────────────────────────────────────────────────────────

export interface StartSyncRequest {
  linkedin_account_id: string
  sync_type?: string
}

export interface NetworkSyncResult {
  total_connections_synced: number
  new_connections_added: number
  connections_updated: number
  total_requests_synced?: number
  pending_requests?: number
  accepted_requests?: number
}

// ── DTOs — Stats / Analytics ─────────────────────────────────────────────────

export interface ConnectionStatsResponse {
  totalConnections: number
  pendingSent: number
  pendingReceived: number
  favorites: number
}

export interface NetworkAnalyticsResponse {
  totalConnections: number
  pendingSent: number
  acceptedRequests: number
  declinedRequests: number
  acceptanceRate: string
}
