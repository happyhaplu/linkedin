// ─── Type definitions for the Reach frontend ─────────────────────────────

export type ConnectionMethod = 'credentials' | 'extension' | 'proxy' | 'cookie' | 'automated'
export type AccountStatus = 'active' | 'paused' | 'error' | 'pending' | 'connecting' | 'pending_verification' | 'disconnected'
export type ProxyType = 'http' | 'https' | 'socks4' | 'socks5'
export type TestStatus = 'success' | 'failed' | 'not_tested'

export interface SendingLimits {
  connection_requests_per_day: number
  messages_per_day: number
  inmails_per_day: number
}

export interface Proxy {
  id: string
  user_id: string
  name: string
  type: ProxyType
  host: string
  port: number
  username?: string
  password?: string
  password_encrypted?: string
  is_active: boolean
  last_tested_at?: string
  test_status: TestStatus
  created_at: string
  updated_at: string
}

export interface LinkedInAccount {
  id: string
  user_id: string
  email: string
  name?: string
  connection_method: ConnectionMethod
  status: AccountStatus
  proxy_id?: string
  assigned_campaigns?: string[]
  campaigns?: string[]
  two_fa_enabled: boolean
  requires_otp?: boolean
  requires_pin?: boolean
  session_cookies?: any
  session_id?: string
  profile_name?: string
  profile_picture_url?: string
  headline?: string
  job_title?: string
  company?: string
  location?: string
  profile_url?: string
  connections_count?: number
  about?: string
  daily_limits?: SendingLimits
  sending_limits?: SendingLimits
  error_message?: string
  last_active?: string
  last_activity_at?: string
  created_at: string
  updated_at: string
  proxy?: Proxy
}

export interface Campaign {
  id: string
  name: string
  status: string
}

// ─── API request/response types ───────────────────────────────────────────

export interface CreateAccountWithCookieRequest {
  email: string
  secret_key: string
  proxy_id?: string
}

export interface ReconnectAccountRequest {
  secret_key: string
  proxy_id?: string
}

export interface UpdateLimitsRequest {
  connection_requests_per_day: number
  messages_per_day: number
  inmails_per_day: number
}

export interface UpdateProxyRequest {
  proxy_id: string | null
}

export interface AssignCampaignsRequest {
  campaign_ids: string[]
}

export interface VerifyOTPRequest {
  otp: string
}

export interface CreateProxyRequest {
  name: string
  type: ProxyType
  host: string
  port: number
  username?: string
  password?: string
}

export interface UpdateProxyFormRequest {
  name?: string
  type?: ProxyType
  host?: string
  port?: number
  username?: string
  password?: string
  is_active?: boolean
}
