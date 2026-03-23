import api from './client'
import type {
  Campaign,
  CampaignAnalytics,
  CampaignStats,
  CampaignTemplate,
  CampaignLead,
  CampaignLeadStats,
  CampaignSequence,
  CampaignActivityLog,
  CampaignWebhook,
  CampaignWebhookLog,
  CampaignSender,
  CreateCampaignInput,
  UpdateCampaignInput,
  CreateWebhookInput,
} from '@/types/campaign'

export const campaignApi = {
  // ═══════════════════════════════════════════════════════════════════════
  // CAMPAIGN CRUD
  // ═══════════════════════════════════════════════════════════════════════

  /** GET /api/campaigns — list all campaigns with optional filters */
  list(params?: { status?: string; search?: string }): Promise<Campaign[]> {
    return api.get('/campaigns', { params }).then((r) => r.data)
  },

  /** GET /api/campaigns/:id — get single campaign with relations */
  getById(id: string): Promise<Campaign> {
    return api.get(`/campaigns/${id}`).then((r) => r.data)
  },

  /** POST /api/campaigns — create a new campaign */
  create(input: CreateCampaignInput): Promise<Campaign> {
    return api.post('/campaigns', input).then((r) => r.data)
  },

  /** PUT /api/campaigns/:id — update campaign fields */
  update(id: string, input: UpdateCampaignInput): Promise<Campaign> {
    return api.put(`/campaigns/${id}`, input).then((r) => r.data)
  },

  /** DELETE /api/campaigns/:id — delete a campaign */
  delete(id: string): Promise<void> {
    return api.delete(`/campaigns/${id}`).then(() => undefined)
  },

  // ═══════════════════════════════════════════════════════════════════════
  // CAMPAIGN LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════

  /** POST /api/campaigns/:id/start — launch campaign */
  start(id: string, launchImmediately = true): Promise<{ success: boolean; message?: string }> {
    return api
      .post(`/campaigns/${id}/start`, { launch_immediately: launchImmediately })
      .then((r) => r.data)
  },

  /** POST /api/campaigns/:id/pause — pause campaign */
  pause(id: string): Promise<{ success: boolean; message?: string }> {
    return api.post(`/campaigns/${id}/pause`).then((r) => r.data)
  },

  /** POST /api/campaigns/:id/resume — resume campaign */
  resume(id: string): Promise<{ success: boolean; message?: string }> {
    return api.post(`/campaigns/${id}/resume`).then((r) => r.data)
  },

  /** POST /api/campaigns/:id/stop — stop campaign */
  stop(id: string): Promise<{ success: boolean; message?: string }> {
    return api.post(`/campaigns/${id}/stop`).then((r) => r.data)
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SEQUENCES
  // ═══════════════════════════════════════════════════════════════════════

  /** GET /api/campaigns/:id/sequences — get all sequence steps */
  getSequences(campaignId: string): Promise<CampaignSequence[]> {
    return api.get(`/campaigns/${campaignId}/sequences`).then((r) => r.data)
  },

  /** PUT /api/campaigns/:id/sequences/:seqId — update a sequence step */
  updateSequence(
    campaignId: string,
    seqId: string,
    fields: Record<string, unknown>,
  ): Promise<CampaignSequence> {
    return api.put(`/campaigns/${campaignId}/sequences/${seqId}`, fields).then((r) => r.data)
  },

  /** POST /api/campaigns/:id/sequences/:seqId/ab-winner — declare A/B winner */
  declareABWinner(
    campaignId: string,
    seqId: string,
    winner: 'A' | 'B',
  ): Promise<{ success: boolean; winner: string }> {
    return api
      .post(`/campaigns/${campaignId}/sequences/${seqId}/ab-winner`, { winner })
      .then((r) => r.data)
  },

  // ═══════════════════════════════════════════════════════════════════════
  // LEADS
  // ═══════════════════════════════════════════════════════════════════════

  /** GET /api/campaigns/:id/leads — list campaign leads */
  getLeads(
    campaignId: string,
    params?: { status?: string; sender_id?: string },
  ): Promise<CampaignLead[]> {
    return api.get(`/campaigns/${campaignId}/leads`, { params }).then((r) => r.data)
  },

  /** GET /api/campaigns/:id/leads/stats — lead status breakdown */
  getLeadStats(campaignId: string): Promise<CampaignLeadStats> {
    return api.get(`/campaigns/${campaignId}/leads/stats`).then((r) => r.data)
  },

  /** POST /api/campaigns/:id/leads — add leads by IDs */
  addLeads(
    campaignId: string,
    leadIds: string[],
  ): Promise<{ added: number; leads: CampaignLead[] }> {
    return api.post(`/campaigns/${campaignId}/leads`, { lead_ids: leadIds }).then((r) => r.data)
  },

  /** POST /api/campaigns/:id/leads/from-list — add all leads from a list */
  addLeadsFromList(campaignId: string, listId: string): Promise<{ added: number }> {
    return api
      .post(`/campaigns/${campaignId}/leads/from-list`, { list_id: listId })
      .then((r) => r.data)
  },

  /** DELETE /api/campaigns/:id/leads — remove leads */
  removeLeads(campaignId: string, campaignLeadIds: string[]): Promise<void> {
    return api
      .delete(`/campaigns/${campaignId}/leads`, { data: { campaign_lead_ids: campaignLeadIds } })
      .then(() => undefined)
  },

  /** GET /api/campaigns/:id/export — export leads as CSV (returns URL) */
  getExportUrl(campaignId: string): string {
    return `/api/campaigns/${campaignId}/export`
  },

  // ═══════════════════════════════════════════════════════════════════════
  // STATISTICS & ANALYTICS
  // ═══════════════════════════════════════════════════════════════════════

  /** GET /api/campaigns/stats — global campaign stats */
  getStats(): Promise<CampaignStats> {
    return api.get('/campaigns/stats').then((r) => r.data)
  },

  /** GET /api/campaigns/templates — campaign starter templates */
  getTemplates(): Promise<CampaignTemplate[]> {
    return api.get('/campaigns/templates').then((r) => r.data)
  },

  /** GET /api/campaigns/:id/stats — detailed campaign performance */
  getCampaignDetailStats(campaignId: string): Promise<Record<string, unknown>> {
    return api.get(`/campaigns/${campaignId}/stats`).then((r) => r.data)
  },

  /** GET /api/campaigns/:id/analytics — full analytics payload */
  getAnalytics(campaignId: string): Promise<CampaignAnalytics> {
    return api.get(`/campaigns/${campaignId}/analytics`).then((r) => r.data)
  },

  /** GET /api/campaigns/:id/performance/sequences — per-step metrics */
  getSequencePerformance(campaignId: string): Promise<unknown[]> {
    return api.get(`/campaigns/${campaignId}/performance/sequences`).then((r) => r.data)
  },

  /** GET /api/campaigns/:id/performance/senders — per-sender metrics */
  getSenderPerformance(campaignId: string): Promise<unknown[]> {
    return api.get(`/campaigns/${campaignId}/performance/senders`).then((r) => r.data)
  },

  // ═══════════════════════════════════════════════════════════════════════
  // ACTIVITY LOG
  // ═══════════════════════════════════════════════════════════════════════

  /** GET /api/campaigns/:id/activity — chronological activity log */
  getActivityLog(campaignId: string, limit = 100): Promise<CampaignActivityLog[]> {
    return api.get(`/campaigns/${campaignId}/activity`, { params: { limit } }).then((r) => r.data)
  },

  /** POST /api/campaigns/:id/activity — manually log an activity entry */
  logActivity(
    campaignId: string,
    body: {
      campaign_lead_id?: string
      activity_type: string
      activity_status: string
      message_content?: string
      error_message?: string
    },
  ): Promise<void> {
    return api.post(`/campaigns/${campaignId}/activity`, body).then(() => undefined)
  },

  // ═══════════════════════════════════════════════════════════════════════
  // DUPLICATE
  // ═══════════════════════════════════════════════════════════════════════

  /** POST /api/campaigns/:id/duplicate — clone a campaign */
  duplicate(campaignId: string): Promise<Campaign> {
    return api.post(`/campaigns/${campaignId}/duplicate`).then((r) => r.data)
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SENDERS
  // ═══════════════════════════════════════════════════════════════════════

  /** POST /api/campaigns/:id/senders — add a LinkedIn account as sender */
  addSender(campaignId: string, linkedinAccountId: string): Promise<CampaignSender> {
    return api
      .post(`/campaigns/${campaignId}/senders`, { linkedin_account_id: linkedinAccountId })
      .then((r) => r.data)
  },

  /** DELETE /api/campaigns/:id/senders/:senderId — remove a sender */
  removeSender(campaignId: string, senderId: string): Promise<void> {
    return api.delete(`/campaigns/${campaignId}/senders/${senderId}`).then(() => undefined)
  },

  // ═══════════════════════════════════════════════════════════════════════
  // WEBHOOKS
  // ═══════════════════════════════════════════════════════════════════════

  /** GET /api/campaigns/:id/webhooks — list webhooks */
  getWebhooks(campaignId: string): Promise<CampaignWebhook[]> {
    return api.get(`/campaigns/${campaignId}/webhooks`).then((r) => r.data)
  },

  /** POST /api/campaigns/:id/webhooks — create webhook */
  createWebhook(campaignId: string, input: CreateWebhookInput): Promise<CampaignWebhook> {
    return api.post(`/campaigns/${campaignId}/webhooks`, input).then((r) => r.data)
  },

  /** PUT /api/campaigns/:id/webhooks/:webhookId — update webhook */
  updateWebhook(
    campaignId: string,
    webhookId: string,
    fields: Record<string, unknown>,
  ): Promise<void> {
    return api
      .put(`/campaigns/${campaignId}/webhooks/${webhookId}`, fields)
      .then(() => undefined)
  },

  /** DELETE /api/campaigns/:id/webhooks/:webhookId — delete webhook */
  deleteWebhook(campaignId: string, webhookId: string): Promise<void> {
    return api.delete(`/campaigns/${campaignId}/webhooks/${webhookId}`).then(() => undefined)
  },

  /** GET /api/campaigns/:id/webhook-logs — webhook delivery logs */
  getWebhookLogs(campaignId: string, limit = 50): Promise<CampaignWebhookLog[]> {
    return api
      .get(`/campaigns/${campaignId}/webhook-logs`, { params: { limit } })
      .then((r) => r.data)
  },
}
