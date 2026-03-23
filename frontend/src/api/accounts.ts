import api from './client'
import type {
  LinkedInAccount,
  CreateAccountWithCookieRequest,
  ReconnectAccountRequest,
  UpdateLimitsRequest,
  UpdateProxyRequest,
  AssignCampaignsRequest,
  VerifyOTPRequest,
} from '@/types'

export const accountApi = {
  // GET /api/linkedin-accounts
  list(): Promise<LinkedInAccount[]> {
    return api.get('/linkedin-accounts').then((r) => r.data)
  },

  // GET /api/linkedin-accounts/:id
  get(id: string): Promise<LinkedInAccount> {
    return api.get(`/linkedin-accounts/${id}`).then((r) => r.data)
  },

  // POST /api/linkedin-accounts/cookie
  createWithCookie(data: CreateAccountWithCookieRequest): Promise<LinkedInAccount> {
    return api.post('/linkedin-accounts/cookie', data).then((r) => r.data)
  },

  // POST /api/linkedin-accounts/:id/reconnect
  reconnect(id: string, data: ReconnectAccountRequest): Promise<LinkedInAccount> {
    return api.post(`/linkedin-accounts/${id}/reconnect`, data).then((r) => r.data)
  },

  // POST /api/linkedin-accounts/:id/toggle-status
  toggleStatus(id: string): Promise<LinkedInAccount> {
    return api.post(`/linkedin-accounts/${id}/toggle-status`).then((r) => r.data)
  },

  // DELETE /api/linkedin-accounts/:id
  delete(id: string): Promise<void> {
    return api.delete(`/linkedin-accounts/${id}`).then(() => undefined)
  },

  // PUT /api/linkedin-accounts/:id/limits
  updateLimits(id: string, data: UpdateLimitsRequest): Promise<LinkedInAccount> {
    return api.put(`/linkedin-accounts/${id}/limits`, data).then((r) => r.data)
  },

  // PUT /api/linkedin-accounts/:id/proxy
  updateProxy(id: string, data: UpdateProxyRequest): Promise<LinkedInAccount> {
    return api.put(`/linkedin-accounts/${id}/proxy`, data).then((r) => r.data)
  },

  // PUT /api/linkedin-accounts/:id/campaigns
  assignCampaigns(id: string, data: AssignCampaignsRequest): Promise<LinkedInAccount> {
    return api.put(`/linkedin-accounts/${id}/campaigns`, data).then((r) => r.data)
  },

  // POST /api/linkedin-accounts/:id/verify-otp
  verifyOTP(id: string, data: VerifyOTPRequest): Promise<LinkedInAccount> {
    return api.post(`/linkedin-accounts/${id}/verify-otp`, data).then((r) => r.data)
  },

  // POST /api/linkedin-accounts/:id/check-connection
  checkConnection(id: string): Promise<{ connected: boolean }> {
    return api.post(`/linkedin-accounts/${id}/check-connection`).then((r) => r.data)
  },

  // POST /api/linkedin-accounts/monitor-health
  monitorHealth(accountId?: string): Promise<any> {
    return api
      .post('/linkedin-accounts/monitor-health', accountId ? { account_id: accountId } : {})
      .then((r) => r.data)
  },

  // GET /api/linkedin-accounts/:id/health-history
  getHealthHistory(id: string): Promise<any[]> {
    return api.get(`/linkedin-accounts/${id}/health-history`).then((r) => r.data)
  },

  // PUT /api/linkedin-accounts/:id/profile
  updateProfile(id: string, data: Record<string, any>): Promise<LinkedInAccount> {
    return api.put(`/linkedin-accounts/${id}/profile`, data).then((r) => r.data?.data || r.data)
  },
}
