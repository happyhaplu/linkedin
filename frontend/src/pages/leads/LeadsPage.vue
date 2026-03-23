<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useLeadsStore } from '@/stores/leads'
import type { Lead, LeadStatus, CustomFieldType, ImportLeadRow } from '@/types/leads'

const route = useRoute()
const store = useLeadsStore()

// ── Filters ──────────────────────────────────────────
const filters = ref({
  list_id: (route.query.list_id as string) || '',
  status: '',
  search: '',
})

// ── Selection ────────────────────────────────────────
const selectedLeads = ref<Set<string>>(new Set())

// ── Modals ───────────────────────────────────────────
const showImportModal = ref(false)
const showDetailModal = ref(false)
const showCustomFieldsModal = ref(false)
const selectedLead = ref<Lead | null>(null)

// ── Import Modal State ───────────────────────────────
const importStep = ref<'upload' | 'mapping' | 'confirm'>('upload')
const importListId = ref('')
const importNewListName = ref('')
const importCreatingList = ref(false)
const importCsvText = ref('')
const importParsedRows = ref<Record<string, string>[]>([])
const importCsvHeaders = ref<string[]>([])
const importColumnMapping = ref<Record<string, string>>({})
const importLoading = ref(false)

// ── Custom Fields Modal State ────────────────────────
const newFieldName = ref('')
const newFieldType = ref<CustomFieldType>('text')
const newFieldRequired = ref(false)

// ── Status badge colors ──────────────────────────────
function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    new: 'bg-blue-100 text-blue-800',
    contacted: 'bg-yellow-100 text-yellow-800',
    replied: 'bg-green-100 text-green-800',
    qualified: 'bg-purple-100 text-purple-800',
    unqualified: 'bg-gray-100 text-gray-800',
    do_not_contact: 'bg-red-100 text-red-800',
  }
  return map[status] || 'bg-gray-100 text-gray-800'
}

function leadDisplayName(lead: Lead): string {
  return lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || '—'
}

function leadInitial(lead: Lead): string {
  return (lead.first_name?.charAt(0) || lead.full_name?.charAt(0) || '?').toUpperCase()
}

// ── Data Loading ─────────────────────────────────────
onMounted(async () => {
  await Promise.all([
    store.fetchLeads(filters.value),
    store.fetchLists(),
    store.fetchCustomFields(),
  ])
})

watch(filters, (f) => {
  store.fetchLeads({ ...f })
}, { deep: true })

// ── Selection Handlers ───────────────────────────────
function toggleSelectLead(id: string) {
  const s = new Set(selectedLeads.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  selectedLeads.value = s
}

function toggleSelectAll(checked: boolean) {
  selectedLeads.value = checked ? new Set(store.leads.map((l) => l.id)) : new Set()
}

// ── Bulk Actions ─────────────────────────────────────
async function handleBulkStatusUpdate(status: string) {
  if (!status) return
  await store.bulkUpdateStatus(Array.from(selectedLeads.value), status as LeadStatus)
  selectedLeads.value = new Set()
}

async function handleBulkDelete() {
  if (!confirm(`Delete ${selectedLeads.value.size} selected leads?`)) return
  await store.bulkDeleteLeads(Array.from(selectedLeads.value))
  selectedLeads.value = new Set()
}

// ── Delete Single Lead ───────────────────────────────
async function handleDeleteLead(id: string) {
  if (!confirm('Delete this lead?')) return
  await store.deleteLead(id)
  if (selectedLead.value?.id === id) {
    selectedLead.value = null
    showDetailModal.value = false
  }
}

// ── Lead Detail ──────────────────────────────────────
function openLeadDetail(lead: Lead) {
  selectedLead.value = lead
  showDetailModal.value = true
}

// ── Import CSV ───────────────────────────────────────
const leadFields = [
  'linkedin_url', 'first_name', 'last_name', 'full_name', 'headline',
  'company', 'company_url', 'position', 'location', 'email',
  'enriched_email', 'custom_address', 'phone', 'notes', 'tags',
]

function openImportModal() {
  importStep.value = 'upload'
  importListId.value = ''
  importNewListName.value = ''
  importCsvText.value = ''
  importParsedRows.value = []
  importCsvHeaders.value = []
  importColumnMapping.value = {}
  showImportModal.value = true
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split('\n').filter((l) => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
  const rows = lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''))
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = values[i] || '' })
    return row
  })
  return { headers, rows }
}

function handleFileUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const text = reader.result as string
    importCsvText.value = text
    const { headers, rows } = parseCSV(text)
    importCsvHeaders.value = headers
    importParsedRows.value = rows
    // Auto-map columns by name match
    const mapping: Record<string, string> = {}
    for (const h of headers) {
      const normalized = h.toLowerCase().replace(/[\s-]/g, '_')
      if (leadFields.includes(normalized)) {
        mapping[h] = normalized
      }
    }
    importColumnMapping.value = mapping
    importStep.value = 'mapping'
  }
  reader.readAsText(file)
}

async function handleCreateImportList() {
  if (!importNewListName.value.trim()) return
  importCreatingList.value = true
  try {
    const list = await store.createList({ name: importNewListName.value.trim() })
    if (list) {
      importListId.value = list.id
      importNewListName.value = ''
    }
  } finally {
    importCreatingList.value = false
  }
}

async function handleImportSubmit() {
  if (!importListId.value || importParsedRows.value.length === 0) return
  importLoading.value = true
  try {
    const mappedLeads: ImportLeadRow[] = importParsedRows.value.map((row) => {
      const lead: Record<string, string> = {}
      for (const [csvCol, fieldName] of Object.entries(importColumnMapping.value)) {
        if (fieldName && row[csvCol]) {
          lead[fieldName] = row[csvCol]
        }
      }
      return lead as unknown as ImportLeadRow
    })
    await store.importLeads({ list_id: importListId.value, leads: mappedLeads })
    showImportModal.value = false
    alert(`✅ Imported ${mappedLeads.length} leads successfully!`)
  } catch (e: unknown) {
    alert('Import failed: ' + ((e as Error).message || 'Unknown error'))
  } finally {
    importLoading.value = false
  }
}

// ── Custom Fields ────────────────────────────────────
async function handleCreateField() {
  if (!newFieldName.value.trim()) return
  try {
    await store.createCustomField({
      name: newFieldName.value.trim(),
      field_type: newFieldType.value,
      is_required: newFieldRequired.value,
    })
    newFieldName.value = ''
    newFieldType.value = 'text'
    newFieldRequired.value = false
  } catch (e: unknown) {
    alert('Failed to create field: ' + ((e as Error).message || 'Unknown error'))
  }
}

async function handleDeleteField(id: string) {
  if (!confirm('Delete this custom field?')) return
  await store.deleteCustomField(id)
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <header class="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Leads</h1>
        <p class="text-sm text-gray-500 mt-1">Manage your lead database</p>
      </div>
    </header>

    <main class="flex-1 overflow-auto p-6">
      <div class="max-w-7xl mx-auto">
        <!-- Header Actions -->
        <div class="flex justify-between items-center mb-6">
          <div class="flex gap-3">
            <router-link
              to="/leads/lists"
              class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Manage Lists
            </router-link>
            <button
              class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm font-medium"
              @click="showCustomFieldsModal = true"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              Custom Fields
            </button>
          </div>
          <button
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-medium"
            @click="openImportModal"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Import CSV
          </button>
        </div>

        <!-- Filters -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">List</label>
              <select
                v-model="filters.list_id"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="">All Lists</option>
                <option v-for="list in store.lists" :key="list.id" :value="list.id">{{ list.name }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                v-model="filters.status"
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="">All Status</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="replied">Replied</option>
                <option value="qualified">Qualified</option>
                <option value="unqualified">Unqualified</option>
                <option value="do_not_contact">Do Not Contact</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <input
                v-model="filters.search"
                type="text"
                placeholder="Name, email, company..."
                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
          </div>
        </div>

        <!-- Bulk Actions -->
        <div
          v-if="selectedLeads.size > 0"
          class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex items-center justify-between"
        >
          <span class="text-sm text-blue-900 font-medium">{{ selectedLeads.size }} leads selected</span>
          <div class="flex gap-2">
            <select
              class="px-3 py-1 text-sm border border-blue-300 rounded bg-white"
              @change="handleBulkStatusUpdate(($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = ''"
            >
              <option value="">Change Status...</option>
              <option value="contacted">Mark as Contacted</option>
              <option value="replied">Mark as Replied</option>
              <option value="qualified">Mark as Qualified</option>
              <option value="unqualified">Mark as Unqualified</option>
              <option value="do_not_contact">Mark as Do Not Contact</option>
            </select>
            <button
              class="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
              @click="handleBulkDelete"
            >
              Delete Selected
            </button>
          </div>
        </div>

        <!-- Loading -->
        <div v-if="store.loading" class="text-center py-12">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent" />
          <p class="text-gray-500 mt-4">Loading leads...</p>
        </div>

        <!-- Empty State -->
        <div v-else-if="store.leads.length === 0" class="bg-white rounded-lg shadow-sm p-12 text-center">
          <div class="text-5xl mb-4">👥</div>
          <h3 class="text-lg font-semibold text-gray-900 mb-2">No Leads Yet</h3>
          <p class="text-gray-500 mb-6">Import your first CSV to get started</p>
          <button
            class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2 font-medium"
            @click="openImportModal"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Import CSV
          </button>
        </div>

        <!-- Leads Table -->
        <div v-else class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      :checked="selectedLeads.size === store.leads.length && store.leads.length > 0"
                      class="rounded border-gray-300 w-4 h-4 text-blue-600"
                      @change="toggleSelectAll(($event.target as HTMLInputElement).checked)"
                    />
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Headline</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">List</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="lead in store.leads" :key="lead.id" class="hover:bg-gray-50">
                  <td class="px-4 py-3">
                    <input
                      type="checkbox"
                      :checked="selectedLeads.has(lead.id)"
                      class="rounded border-gray-300 w-4 h-4 text-blue-600"
                      @change="toggleSelectLead(lead.id)"
                    />
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-3">
                      <!-- Avatar -->
                      <div
                        v-if="lead.profile_picture"
                        class="w-10 h-10 rounded-full bg-gray-200 border-2 border-gray-100 flex-shrink-0 overflow-hidden"
                      >
                        <img
                          :src="lead.profile_picture"
                          :alt="leadDisplayName(lead)"
                          class="w-full h-full object-cover"
                          @error="($event.target as HTMLImageElement).style.display = 'none'"
                        />
                      </div>
                      <div
                        v-else
                        class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0"
                      >
                        <span class="text-white font-semibold text-sm">{{ leadInitial(lead) }}</span>
                      </div>
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2">
                          <a
                            v-if="lead.linkedin_url"
                            :href="lead.linkedin_url"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="flex-shrink-0"
                            title="View LinkedIn Profile"
                          >
                            <svg class="w-4 h-4 text-blue-600 hover:text-blue-700" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                            </svg>
                          </a>
                          <div class="text-sm font-medium text-gray-900 truncate">{{ leadDisplayName(lead) }}</div>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="px-4 py-3">
                    <div class="text-sm text-gray-500 max-w-xs truncate" :title="lead.headline || ''">
                      {{ lead.headline || lead.position || '—' }}
                    </div>
                  </td>
                  <td class="px-4 py-3">
                    <div class="text-sm text-gray-500">
                      {{ lead.company || '—' }}
                      <a
                        v-if="lead.company_url"
                        :href="lead.company_url"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="ml-1 text-blue-600 hover:text-blue-700"
                        title="Visit company website"
                      >
                        <svg class="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-500">{{ lead.location || '—' }}</td>
                  <td class="px-4 py-3 text-sm text-gray-500">{{ lead.enriched_email || lead.email || '—' }}</td>
                  <td class="px-4 py-3">
                    <span class="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">{{ lead.list?.name || '—' }}</span>
                  </td>
                  <td class="px-4 py-3">
                    <span class="text-xs px-2 py-1 rounded capitalize" :class="statusBadgeClass(lead.status)">
                      {{ lead.status.replace(/_/g, ' ') }}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-2">
                      <button class="text-blue-600 hover:text-blue-700 text-sm font-medium" @click="openLeadDetail(lead)">View</button>
                      <button class="text-red-600 hover:text-red-700 text-sm" @click="handleDeleteLead(lead.id)">Delete</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="px-6 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-500">
            Showing {{ store.leads.length }} leads
          </div>
        </div>
      </div>
    </main>

    <!-- ═══ Import CSV Modal ═══ -->
    <div v-if="showImportModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" @click.self="showImportModal = false">
      <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-bold text-gray-900">Import Leads from CSV</h2>
          <button class="p-2 hover:bg-gray-100 rounded-lg" @click="showImportModal = false">
            <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="flex-1 overflow-auto px-6 py-4 space-y-5">
          <!-- Step 1: Upload -->
          <template v-if="importStep === 'upload'">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Target List *</label>
              <select v-model="importListId" class="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                <option value="">Select a list...</option>
                <option v-for="list in store.lists" :key="list.id" :value="list.id">{{ list.name }} ({{ list.lead_count }} leads)</option>
              </select>
            </div>
            <div class="flex items-center gap-2">
              <input
                v-model="importNewListName"
                type="text"
                placeholder="Or create a new list..."
                class="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <button
                :disabled="importCreatingList || !importNewListName.trim()"
                class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                @click="handleCreateImportList"
              >
                {{ importCreatingList ? 'Creating...' : '+ Create' }}
              </button>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">CSV File</label>
              <label class="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                <svg class="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span class="text-sm text-gray-500">Click to upload CSV file</span>
                <input type="file" accept=".csv" class="hidden" @change="handleFileUpload" />
              </label>
            </div>
          </template>

          <!-- Step 2: Column Mapping -->
          <template v-if="importStep === 'mapping'">
            <p class="text-sm text-gray-500">Map your CSV columns to lead fields. Found {{ importParsedRows.length }} rows.</p>
            <div class="space-y-3 max-h-80 overflow-y-auto">
              <div v-for="header in importCsvHeaders" :key="header" class="flex items-center gap-3">
                <span class="text-sm text-gray-700 w-40 truncate font-medium" :title="header">{{ header }}</span>
                <span class="text-gray-400">→</span>
                <select
                  v-model="importColumnMapping[header]"
                  class="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">— Skip —</option>
                  <option v-for="f in leadFields" :key="f" :value="f">{{ f.replace(/_/g, ' ') }}</option>
                </select>
              </div>
            </div>
            <div class="flex gap-3 pt-2">
              <button class="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50" @click="importStep = 'upload'">← Back</button>
              <button
                class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                @click="importStep = 'confirm'"
              >
                Next →
              </button>
            </div>
          </template>

          <!-- Step 3: Confirm -->
          <template v-if="importStep === 'confirm'">
            <div class="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h3 class="text-sm font-semibold text-blue-900">Ready to Import</h3>
              <ul class="text-sm text-blue-700 mt-2 space-y-1">
                <li>📋 {{ importParsedRows.length }} leads from CSV</li>
                <li>📂 Into: {{ store.lists.find(l => l.id === importListId)?.name || 'Unknown list' }}</li>
                <li>🔗 {{ Object.values(importColumnMapping).filter(v => v).length }} columns mapped</li>
              </ul>
            </div>
            <div class="flex gap-3 pt-2">
              <button class="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50" @click="importStep = 'mapping'">← Back</button>
              <button
                :disabled="importLoading || !importListId"
                class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                @click="handleImportSubmit"
              >
                {{ importLoading ? 'Importing...' : '🚀 Import Leads' }}
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- ═══ Lead Detail Modal ═══ -->
    <div v-if="showDetailModal && selectedLead" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" @click.self="showDetailModal = false">
      <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-bold text-gray-900">Lead Details</h2>
          <button class="p-2 hover:bg-gray-100 rounded-lg" @click="showDetailModal = false">
            <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="flex-1 overflow-auto px-6 py-4 space-y-5">
          <!-- Profile Header -->
          <div class="flex items-center gap-4">
            <div
              v-if="selectedLead.profile_picture"
              class="w-16 h-16 rounded-full bg-gray-200 overflow-hidden border-2 border-gray-100 flex-shrink-0"
            >
              <img :src="selectedLead.profile_picture" class="w-full h-full object-cover" />
            </div>
            <div v-else class="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0">
              <span class="text-white font-bold text-xl">{{ leadInitial(selectedLead) }}</span>
            </div>
            <div>
              <h3 class="text-lg font-bold text-gray-900">{{ leadDisplayName(selectedLead) }}</h3>
              <p v-if="selectedLead.headline" class="text-sm text-gray-500">{{ selectedLead.headline }}</p>
              <div class="flex items-center gap-2 mt-1">
                <span class="text-xs px-2 py-0.5 rounded capitalize" :class="statusBadgeClass(selectedLead.status)">
                  {{ selectedLead.status.replace(/_/g, ' ') }}
                </span>
                <a
                  v-if="selectedLead.linkedin_url"
                  :href="selectedLead.linkedin_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-blue-600 hover:text-blue-700 text-xs font-medium"
                >
                  View LinkedIn →
                </a>
              </div>
            </div>
          </div>

          <!-- Details Grid -->
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div v-for="field in [
              { label: 'Company', value: selectedLead.company },
              { label: 'Position', value: selectedLead.position || selectedLead.job_title },
              { label: 'Location', value: selectedLead.location },
              { label: 'Email', value: selectedLead.enriched_email || selectedLead.email },
              { label: 'Phone', value: selectedLead.phone },
              { label: 'List', value: selectedLead.list?.name },
              { label: 'Imported', value: selectedLead.imported_at ? new Date(selectedLead.imported_at).toLocaleDateString() : null },
              { label: 'Last Contacted', value: selectedLead.last_contacted_at ? new Date(selectedLead.last_contacted_at).toLocaleDateString() : null },
            ].filter(f => f.value)" :key="field.label">
              <dt class="text-gray-500 font-medium">{{ field.label }}</dt>
              <dd class="text-gray-900">{{ field.value }}</dd>
            </div>
          </div>

          <!-- Notes -->
          <div v-if="selectedLead.notes" class="bg-gray-50 rounded-lg p-3">
            <p class="text-xs font-medium text-gray-500 mb-1">Notes</p>
            <p class="text-sm text-gray-700 whitespace-pre-line">{{ selectedLead.notes }}</p>
          </div>

          <!-- Tags -->
          <div v-if="selectedLead.tags" class="flex flex-wrap gap-1.5">
            <span
              v-for="tag in selectedLead.tags.split(',')"
              :key="tag"
              class="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full"
            >
              {{ tag.trim() }}
            </span>
          </div>

          <!-- AI Icebreaker -->
          <div v-if="selectedLead.ai_icebreaker" class="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <p class="text-xs font-medium text-purple-700 mb-1">🤖 AI Icebreaker</p>
            <p class="text-sm text-purple-900">{{ selectedLead.ai_icebreaker }}</p>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between px-6 py-4 border-t border-gray-200">
          <button
            class="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium"
            @click="handleDeleteLead(selectedLead!.id)"
          >
            Delete Lead
          </button>
          <button
            class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
            @click="showDetailModal = false"
          >
            Close
          </button>
        </div>
      </div>
    </div>

    <!-- ═══ Custom Fields Modal ═══ -->
    <div v-if="showCustomFieldsModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" @click.self="showCustomFieldsModal = false">
      <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 class="text-lg font-bold text-gray-900">Custom Fields</h2>
          <button class="p-2 hover:bg-gray-100 rounded-lg" @click="showCustomFieldsModal = false">
            <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="flex-1 overflow-auto px-6 py-4 space-y-5">
          <!-- Create new field -->
          <div class="bg-gray-50 rounded-lg p-4 space-y-3">
            <h3 class="text-sm font-semibold text-gray-700">Add New Field</h3>
            <div class="flex gap-2">
              <input
                v-model="newFieldName"
                type="text"
                placeholder="Field name..."
                class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <select v-model="newFieldType" class="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="url">URL</option>
                <option value="date">Date</option>
                <option value="textarea">Textarea</option>
              </select>
            </div>
            <div class="flex items-center justify-between">
              <label class="flex items-center gap-2 cursor-pointer">
                <input v-model="newFieldRequired" type="checkbox" class="w-4 h-4 text-blue-600" />
                <span class="text-sm text-gray-600">Required</span>
              </label>
              <button
                :disabled="!newFieldName.trim()"
                class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                @click="handleCreateField"
              >
                Add Field
              </button>
            </div>
          </div>

          <!-- Existing fields -->
          <div v-if="store.customFields.length === 0" class="text-center py-8 text-gray-400">
            <p class="text-sm">No custom fields yet</p>
          </div>
          <div v-else class="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
            <div v-for="field in store.customFields" :key="field.id" class="flex items-center justify-between px-4 py-3">
              <div>
                <p class="text-sm font-medium text-gray-900">{{ field.name }}</p>
                <p class="text-xs text-gray-500">{{ field.field_type }}{{ field.is_required ? ' · Required' : '' }}</p>
              </div>
              <button class="text-gray-400 hover:text-red-500 text-lg leading-none" @click="handleDeleteField(field.id)">×</button>
            </div>
          </div>
        </div>
        <div class="px-6 py-4 border-t border-gray-200">
          <button
            class="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
            @click="showCustomFieldsModal = false"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
