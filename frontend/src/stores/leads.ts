// ─── Leads Pinia Store ────────────────────────────────────────────────────
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { leadsApi } from '@/api/leads'
import type {
  Lead,
  LeadList,
  CustomField,
  GetLeadsFilter,
  ImportLeadsRequest,
  UpdateLeadRequest,
  LeadStatus,
  CreateListRequest,
  UpdateListRequest,
  CreateCustomFieldRequest,
  UpdateCustomFieldRequest,
  AddFromConnectionRequest,
} from '@/types/leads'

export const useLeadsStore = defineStore('leads', () => {
  // ── State ──────────────────────────────────────────
  const leads = ref<Lead[]>([])
  const lists = ref<LeadList[]>([])
  const customFields = ref<CustomField[]>([])
  const currentLead = ref<Lead | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const filters = ref<GetLeadsFilter>({})

  // ── Getters ────────────────────────────────────────
  const totalLeads = computed(() => leads.value.length)
  const leadsByStatus = computed(() => {
    const groups: Record<string, Lead[]> = {}
    for (const lead of leads.value) {
      const s = lead.status || 'new'
      if (!groups[s]) groups[s] = []
      groups[s].push(lead)
    }
    return groups
  })

  // ── Actions — Lists ────────────────────────────────
  async function fetchLists() {
    try {
      lists.value = await leadsApi.getLists()
    } catch (e: unknown) {
      error.value = (e as Error).message
    }
  }

  async function createList(req: CreateListRequest): Promise<LeadList | null> {
    try {
      const list = await leadsApi.createList(req)
      lists.value.push(list)
      return list
    } catch (e: unknown) {
      error.value = (e as Error).message
      return null
    }
  }

  async function updateList(id: string, req: UpdateListRequest) {
    try {
      const updated = await leadsApi.updateList(id, req)
      const idx = lists.value.findIndex((l) => l.id === id)
      if (idx >= 0) lists.value[idx] = updated
    } catch (e: unknown) {
      error.value = (e as Error).message
    }
  }

  async function deleteList(id: string) {
    await leadsApi.deleteList(id)
    lists.value = lists.value.filter((l) => l.id !== id)
  }

  // ── Actions — Leads ────────────────────────────────
  async function fetchLeads(filter?: GetLeadsFilter) {
    loading.value = true
    error.value = null
    try {
      if (filter) filters.value = filter
      leads.value = await leadsApi.getLeads(filters.value)
    } catch (e: unknown) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  async function fetchLeadById(id: string) {
    loading.value = true
    error.value = null
    try {
      currentLead.value = await leadsApi.getLeadById(id)
    } catch (e: unknown) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  async function importLeads(req: ImportLeadsRequest): Promise<Lead[]> {
    const imported = await leadsApi.importLeads(req)
    await fetchLeads()
    return imported
  }

  async function updateLead(id: string, req: UpdateLeadRequest) {
    const updated = await leadsApi.updateLead(id, req)
    const idx = leads.value.findIndex((l) => l.id === id)
    if (idx >= 0) leads.value[idx] = updated
    if (currentLead.value?.id === id) currentLead.value = updated
    return updated
  }

  async function deleteLead(id: string) {
    await leadsApi.deleteLead(id)
    leads.value = leads.value.filter((l) => l.id !== id)
    if (currentLead.value?.id === id) currentLead.value = null
  }

  async function bulkUpdateStatus(leadIds: string[], status: LeadStatus) {
    await leadsApi.bulkUpdateStatus({ lead_ids: leadIds, status })
    await fetchLeads()
  }

  async function bulkDeleteLeads(leadIds: string[]) {
    await leadsApi.bulkDeleteLeads({ lead_ids: leadIds })
    await fetchLeads()
  }

  async function addFromConnection(req: AddFromConnectionRequest) {
    return await leadsApi.addFromConnection(req)
  }

  // ── Actions — Custom Fields ────────────────────────
  async function fetchCustomFields() {
    try {
      customFields.value = await leadsApi.getCustomFields()
    } catch (e: unknown) {
      error.value = (e as Error).message
    }
  }

  async function createCustomField(req: CreateCustomFieldRequest) {
    const field = await leadsApi.createCustomField(req)
    customFields.value.push(field)
    return field
  }

  async function updateCustomField(id: string, req: UpdateCustomFieldRequest) {
    const updated = await leadsApi.updateCustomField(id, req)
    const idx = customFields.value.findIndex((f) => f.id === id)
    if (idx >= 0) customFields.value[idx] = updated
    return updated
  }

  async function deleteCustomField(id: string) {
    await leadsApi.deleteCustomField(id)
    customFields.value = customFields.value.filter((f) => f.id !== id)
  }

  return {
    // State
    leads,
    lists,
    customFields,
    currentLead,
    loading,
    error,
    filters,
    // Getters
    totalLeads,
    leadsByStatus,
    // Actions — Lists
    fetchLists,
    createList,
    updateList,
    deleteList,
    // Actions — Leads
    fetchLeads,
    fetchLeadById,
    importLeads,
    updateLead,
    deleteLead,
    bulkUpdateStatus,
    bulkDeleteLeads,
    addFromConnection,
    // Actions — Custom Fields
    fetchCustomFields,
    createCustomField,
    updateCustomField,
    deleteCustomField,
  }
})
