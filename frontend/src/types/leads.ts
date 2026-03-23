// ─── Leads module type definitions ────────────────────────────────────────
// Maps 1:1 with Go backend models in backend/internal/models/lead.go

// ── Enum types ────────────────────────────────────────────────────────────

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'replied'
  | 'qualified'
  | 'unqualified'
  | 'do_not_contact'

export type CustomFieldType =
  | 'text'
  | 'number'
  | 'email'
  | 'phone'
  | 'url'
  | 'date'
  | 'textarea'

// ── Lead ──────────────────────────────────────────────────────────────────

export interface Lead {
  id: string
  user_id: string
  list_id?: string
  linkedin_url?: string
  first_name?: string
  last_name?: string
  full_name?: string
  headline?: string
  company?: string
  company_url?: string
  position?: string
  job_title?: string
  location?: string
  email?: string
  enriched_email?: string
  custom_address?: string
  phone?: string
  profile_picture?: string
  notes?: string
  tags?: string
  custom_field_values?: Record<string, unknown>
  status: LeadStatus
  imported_at?: string
  last_contacted_at?: string
  ai_icebreaker?: string
  ai_icebreaker_generated_at?: string
  created_at: string
  updated_at: string

  // Relations (populated by preload)
  list?: LeadList
}

// ── LeadList ──────────────────────────────────────────────────────────────

export interface LeadList {
  id: string
  user_id: string
  name: string
  description?: string
  lead_count: number
  created_at: string
  updated_at: string
}

// ── CustomField ───────────────────────────────────────────────────────────

export interface CustomField {
  id: string
  user_id: string
  name: string
  field_type: CustomFieldType
  is_required: boolean
  options?: unknown
  created_at: string
  updated_at: string
}

// ── Request DTOs ──────────────────────────────────────────────────────────

export interface GetLeadsFilter {
  list_id?: string
  status?: string
  search?: string
}

export interface ImportLeadRow {
  linkedin_url?: string
  first_name?: string
  last_name?: string
  full_name?: string
  headline?: string
  company?: string
  company_url?: string
  position?: string
  location?: string
  email?: string
  enriched_email?: string
  custom_address?: string
  phone?: string
  notes?: string
  tags?: string
}

export interface ImportLeadsRequest {
  list_id: string
  leads: ImportLeadRow[]
}

export interface UpdateLeadRequest {
  first_name?: string
  last_name?: string
  full_name?: string
  headline?: string
  company?: string
  company_url?: string
  position?: string
  location?: string
  email?: string
  enriched_email?: string
  custom_address?: string
  phone?: string
  notes?: string
  tags?: string
  status?: LeadStatus
  linkedin_url?: string
  profile_picture?: string
  custom_field_values?: Record<string, unknown>
}

export interface BulkStatusRequest {
  lead_ids: string[]
  status: LeadStatus
}

export interface BulkDeleteRequest {
  lead_ids: string[]
}

export interface AddFromConnectionRequest {
  connection_id?: string
  full_name: string
  linkedin_url?: string
  position?: string
  company?: string
  profile_picture?: string
  list_id?: string
}

export interface CreateListRequest {
  name: string
  description?: string
}

export interface UpdateListRequest {
  name?: string
  description?: string
}

export interface CreateCustomFieldRequest {
  name: string
  field_type: CustomFieldType
  is_required?: boolean
  options?: unknown
}

export interface UpdateCustomFieldRequest {
  name?: string
  field_type?: CustomFieldType
  is_required?: boolean
  options?: unknown
}
