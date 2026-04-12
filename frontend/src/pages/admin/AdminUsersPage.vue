<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { admin, type AdminUser, type AdminPlan } from '@/api/admin'

const users = ref<AdminUser[]>([])
const plans = ref<AdminPlan[]>([])
const loading = ref(true)
const error = ref('')

// Edit modal
const editModal = ref(false)
const editingUser = ref<AdminUser | null>(null)
const editForm = ref({
  is_active: true,
  max_linkedin_senders: 0,
  notes: '',
  plan_id: '',
})
const editLoading = ref(false)
const editError = ref('')

// Search/filter
const search = ref('')

const filtered = computed(() =>
  users.value.filter(
    (u) =>
      u.user_email.toLowerCase().includes(search.value.toLowerCase()) ||
      u.workspace_id.toLowerCase().includes(search.value.toLowerCase()),
  ),
)

onMounted(async () => {
  await Promise.all([loadUsers(), loadPlans()])
})

async function loadUsers() {
  loading.value = true
  try {
    const res = await admin.listUsers()
    users.value = res.data.users || []
  } catch (e: any) {
    error.value = e?.response?.data?.error || 'Failed to load users'
  } finally {
    loading.value = false
  }
}

async function loadPlans() {
  try {
    const res = await admin.listPlans()
    plans.value = res.data.plans || []
  } catch {}
}

function openEdit(user: AdminUser) {
  editingUser.value = user
  editForm.value = {
    is_active: user.is_active,
    max_linkedin_senders: user.max_linkedin_senders,
    notes: user.notes || '',
    plan_id: user.plan_id || '',
  }
  editError.value = ''
  editModal.value = true
}

async function saveEdit() {
  if (!editingUser.value) return
  editLoading.value = true
  editError.value = ''
  try {
    const payload: any = {
      is_active: editForm.value.is_active,
      max_linkedin_senders: editForm.value.max_linkedin_senders,
      notes: editForm.value.notes,
    }
    if (editForm.value.plan_id) {
      payload.plan_id = editForm.value.plan_id
    }
    const res = await admin.updateUser(editingUser.value.workspace_id, payload)
    const idx = users.value.findIndex((u) => u.workspace_id === editingUser.value!.workspace_id)
    if (idx !== -1) users.value[idx] = res.data.user
    editModal.value = false
  } catch (e: any) {
    editError.value = e?.response?.data?.error || 'Failed to save'
  } finally {
    editLoading.value = false
  }
}

async function toggleActive(user: AdminUser) {
  try {
    const res = await admin.updateUser(user.workspace_id, { is_active: !user.is_active } as any)
    const idx = users.value.findIndex((u) => u.workspace_id === user.workspace_id)
    if (idx !== -1) users.value[idx] = res.data.user
  } catch {}
}

function statusClass(status: string) {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-700'
    case 'trialing': return 'bg-blue-100 text-blue-700'
    case 'past_due': return 'bg-orange-100 text-orange-700'
    case 'canceled': return 'bg-red-100 text-red-700'
    default: return 'bg-gray-100 text-gray-600'
  }
}

function planName(user: AdminUser) {
  return user.plan?.name || '—'
}

function effectiveLimit(user: AdminUser) {
  if (user.max_linkedin_senders > 0) return user.max_linkedin_senders
  return user.plan?.max_linkedin_senders ?? 0
}
</script>

<template>
  <div class="p-8">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Users</h1>
        <p class="text-sm text-gray-400 mt-0.5">Manage user plans, limits and access</p>
      </div>
      <button
        @click="loadUsers"
        class="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Refresh
      </button>
    </div>

    <!-- Search -->
    <div class="mb-4">
      <input
        v-model="search"
        type="text"
        placeholder="Search by email or workspace ID…"
        class="w-full max-w-sm bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
      />
    </div>

    <!-- Error -->
    <div v-if="error" class="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-3 text-sm mb-4">
      {{ error }}
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-16">
      <div class="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>

    <!-- Table -->
    <div v-else class="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr>
            <th class="text-left px-4 py-3 font-medium text-gray-500">Email</th>
            <th class="text-left px-4 py-3 font-medium text-gray-500">Plan</th>
            <th class="text-left px-4 py-3 font-medium text-gray-500">Status</th>
            <th class="text-left px-4 py-3 font-medium text-gray-500">Senders</th>
            <th class="text-left px-4 py-3 font-medium text-gray-500">Active</th>
            <th class="text-left px-4 py-3 font-medium text-gray-500">Assigned by</th>
            <th class="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-if="filtered.length === 0">
            <td colspan="7" class="text-center text-gray-400 py-12">No users found</td>
          </tr>
          <tr v-for="user in filtered" :key="user.id" class="hover:bg-gray-50 transition-colors">
            <td class="px-4 py-3">
              <div class="font-medium text-gray-900">{{ user.user_email }}</div>
              <div class="text-xs text-gray-400 mt-0.5 truncate max-w-[180px]">{{ user.workspace_id }}</div>
            </td>
            <td class="px-4 py-3 text-gray-700">{{ planName(user) }}</td>
            <td class="px-4 py-3">
              <span class="px-2 py-0.5 rounded-full text-xs font-medium" :class="statusClass(user.status)">
                {{ user.status }}
              </span>
            </td>
            <td class="px-4 py-3 text-gray-700">
              {{ effectiveLimit(user) }}
              <span v-if="user.max_linkedin_senders > 0" class="text-xs text-blue-500 ml-1">(override)</span>
            </td>
            <td class="px-4 py-3">
              <button
                @click="toggleActive(user)"
                class="relative inline-flex items-center h-5 w-9 rounded-full transition-colors"
                :class="user.is_active ? 'bg-green-500' : 'bg-gray-300'"
              >
                <span
                  class="inline-block w-3.5 h-3.5 bg-white rounded-full shadow transition-transform"
                  :class="user.is_active ? 'translate-x-4' : 'translate-x-1'"
                />
              </button>
            </td>
            <td class="px-4 py-3 text-gray-500 text-xs">
              {{ user.assigned_by_admin ? 'Admin' : 'Stripe' }}
            </td>
            <td class="px-4 py-3 text-right">
              <button
                @click="openEdit(user)"
                class="text-blue-600 hover:text-blue-800 text-xs font-medium"
              >
                Edit
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Edit Modal -->
    <Teleport to="body">
      <div
        v-if="editModal"
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4"
        @click.self="editModal = false"
      >
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-1">Edit User</h2>
          <p class="text-sm text-gray-400 mb-5">{{ editingUser?.user_email }}</p>

          <div v-if="editError" class="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-3 text-sm mb-4">
            {{ editError }}
          </div>

          <div class="space-y-4">
            <!-- Plan -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Plan</label>
              <select
                v-model="editForm.plan_id"
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">— No change —</option>
                <option v-for="p in plans" :key="p.id" :value="p.id">
                  {{ p.name }} ({{ p.type }})
                </option>
              </select>
            </div>

            <!-- Sender limit -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                LinkedIn Sender Limit Override
                <span class="text-gray-400 font-normal">(0 = use plan default)</span>
              </label>
              <input
                v-model.number="editForm.max_linkedin_senders"
                type="number"
                min="0"
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <!-- Notes -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                v-model="editForm.notes"
                rows="2"
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
                placeholder="Internal notes…"
              />
            </div>

            <!-- Is Active -->
            <div class="flex items-center gap-3">
              <button
                @click="editForm.is_active = !editForm.is_active"
                class="relative inline-flex items-center h-5 w-9 rounded-full transition-colors"
                :class="editForm.is_active ? 'bg-green-500' : 'bg-gray-300'"
              >
                <span
                  class="inline-block w-3.5 h-3.5 bg-white rounded-full shadow transition-transform"
                  :class="editForm.is_active ? 'translate-x-4' : 'translate-x-1'"
                />
              </button>
              <span class="text-sm text-gray-700">Account Active</span>
            </div>
          </div>

          <div class="flex gap-3 mt-6">
            <button
              @click="editModal = false"
              class="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              @click="saveEdit"
              :disabled="editLoading"
              class="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium"
            >
              {{ editLoading ? 'Saving…' : 'Save Changes' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
