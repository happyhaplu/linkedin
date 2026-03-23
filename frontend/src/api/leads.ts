// ─── Leads API service ────────────────────────────────────────────────────
// Covers all Go backend endpoints: /api/leads, /api/lists, /api/custom-fields

import api from './client'
import type {
  Lead,
  LeadList,
  CustomField,
  GetLeadsFilter,
  ImportLeadsRequest,
  UpdateLeadRequest,
  BulkStatusRequest,
  BulkDeleteRequest,
  AddFromConnectionRequest,
  CreateListRequest,
  UpdateListRequest,
  CreateCustomFieldRequest,
  UpdateCustomFieldRequest,
} from '@/types/leads'

export const leadsApi = {
  // ── Lists ─────────────────────────────────────────────────────────────────

  /** GET /api/lists */
  async getLists(): Promise<LeadList[]> {
    const { data } = await api.get<LeadList[]>('/lists')
    return data
  },

  /** GET /api/lists/:id */
  async getListById(id: string): Promise<LeadList> {
    const { data } = await api.get<LeadList>(`/lists/${id}`)
    return data
  },

  /** POST /api/lists */
  async createList(req: CreateListRequest): Promise<LeadList> {
    const { data } = await api.post<LeadList>('/lists', req)
    return data
  },

  /** PUT /api/lists/:id */
  async updateList(id: string, req: UpdateListRequest): Promise<LeadList> {
    const { data } = await api.put<LeadList>(`/lists/${id}`, req)
    return data
  },

  /** DELETE /api/lists/:id */
  async deleteList(id: string): Promise<void> {
    await api.delete(`/lists/${id}`)
  },

  // ── Leads ─────────────────────────────────────────────────────────────────

  /** GET /api/leads */
  async getLeads(filter?: GetLeadsFilter): Promise<Lead[]> {
    const { data } = await api.get<Lead[]>('/leads', { params: filter })
    return data
  },

  /** GET /api/leads/:id */
  async getLeadById(id: string): Promise<Lead> {
    const { data } = await api.get<Lead>(`/leads/${id}`)
    return data
  },

  /** POST /api/leads/import */
  async importLeads(req: ImportLeadsRequest): Promise<Lead[]> {
    const { data } = await api.post<Lead[]>('/leads/import', req)
    return data
  },

  /** PUT /api/leads/:id */
  async updateLead(id: string, req: UpdateLeadRequest): Promise<Lead> {
    const { data } = await api.put<Lead>(`/leads/${id}`, req)
    return data
  },

  /** DELETE /api/leads/:id */
  async deleteLead(id: string): Promise<void> {
    await api.delete(`/leads/${id}`)
  },

  /** POST /api/leads/bulk-status */
  async bulkUpdateStatus(req: BulkStatusRequest): Promise<void> {
    await api.post('/leads/bulk-status', req)
  },

  /** POST /api/leads/bulk-delete */
  async bulkDeleteLeads(req: BulkDeleteRequest): Promise<void> {
    await api.post('/leads/bulk-delete', req)
  },

  /** POST /api/leads/add-from-connection */
  async addFromConnection(req: AddFromConnectionRequest): Promise<{ success: boolean; lead: Lead; message: string }> {
    const { data } = await api.post('/leads/add-from-connection', req)
    return data
  },

  // ── Custom Fields ─────────────────────────────────────────────────────────

  /** GET /api/custom-fields */
  async getCustomFields(): Promise<CustomField[]> {
    const { data } = await api.get<CustomField[]>('/custom-fields')
    return data
  },

  /** POST /api/custom-fields */
  async createCustomField(req: CreateCustomFieldRequest): Promise<CustomField> {
    const { data } = await api.post<CustomField>('/custom-fields', req)
    return data
  },

  /** PUT /api/custom-fields/:id */
  async updateCustomField(id: string, req: UpdateCustomFieldRequest): Promise<CustomField> {
    const { data } = await api.put<CustomField>(`/custom-fields/${id}`, req)
    return data
  },

  /** DELETE /api/custom-fields/:id */
  async deleteCustomField(id: string): Promise<void> {
    await api.delete(`/custom-fields/${id}`)
  },
}
