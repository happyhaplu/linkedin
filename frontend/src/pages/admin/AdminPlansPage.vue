<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { admin, type AdminPlan } from '@/api/admin'

const plans = ref<AdminPlan[]>([])
const loading = ref(true)
const error = ref('')

// Create modal
const createModal = ref(false)
const createForm = ref({
  name: '',
  type: 'custom' as 'stripe' | 'custom',
  description: '',
  price_monthly: 0,
  stripe_price_id: '',
  stripe_product_id: '',
  max_linkedin_senders: 2,
  max_campaigns: -1,
  max_leads: -1,
  features: '',
})
const createLoading = ref(false)
const createError = ref('')

// Edit modal
const editModal = ref(false)
const editingPlan = ref<AdminPlan | null>(null)
const editForm = ref({
  name: '',
  description: '',
  max_linkedin_senders: 2,
  max_campaigns: -1,
  max_leads: -1,
  is_active: true,
  features: '',
})
const editLoading = ref(false)
const editError = ref('')

onMounted(loadPlans)

async function loadPlans() {
  loading.value = true
  try {
    const res = await admin.listPlans()
    plans.value = res.data.plans || []
  } catch (e: any) {
    error.value = e?.response?.data?.error || 'Failed to load plans'
  } finally {
    loading.value = false
  }
}

function resetCreate() {
  createForm.value = {
    name: '',
    type: 'custom',
    description: '',
    price_monthly: 0,
    stripe_price_id: '',
    stripe_product_id: '',
    max_linkedin_senders: 2,
    max_campaigns: -1,
    max_leads: -1,
    features: '',
  }
  createError.value = ''
}

async function handleCreate() {
  createLoading.value = true
  createError.value = ''
  try {
    const features = createForm.value.features
      ? createForm.value.features.split('\n').map((s) => s.trim()).filter(Boolean)
      : []
    await admin.createPlan({ ...createForm.value, features } as any)
    createModal.value = false
    resetCreate()
    await loadPlans()
  } catch (e: any) {
    createError.value = e?.response?.data?.error || 'Failed to create plan'
  } finally {
    createLoading.value = false
  }
}

function openEdit(plan: AdminPlan) {
  editingPlan.value = plan
  const features = plan.features
    ? (() => { try { return (JSON.parse(plan.features) as string[]).join('\n') } catch { return '' } })()
    : ''
  editForm.value = {
    name: plan.name,
    description: plan.description,
    max_linkedin_senders: plan.max_linkedin_senders,
    max_campaigns: plan.max_campaigns,
    max_leads: plan.max_leads,
    is_active: plan.is_active,
    features,
  }
  editError.value = ''
  editModal.value = true
}

async function handleEdit() {
  if (!editingPlan.value) return
  editLoading.value = true
  editError.value = ''
  try {
    const features = editForm.value.features
      ? editForm.value.features.split('\n').map((s) => s.trim()).filter(Boolean)
      : []
    await admin.updatePlan(editingPlan.value.id, { ...editForm.value, features } as any)
    editModal.value = false
    await loadPlans()
  } catch (e: any) {
    editError.value = e?.response?.data?.error || 'Failed to update plan'
  } finally {
    editLoading.value = false
  }
}

function formatPrice(cents: number) {
  if (!cents) return 'Free'
  return `$${(cents / 100).toFixed(0)}/mo`
}

function planTypeClass(type: string) {
  return type === 'stripe' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'
}
</script>

<template>
  <div class="p-8">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Plans</h1>
        <p class="text-sm text-gray-400 mt-0.5">Manage Stripe and custom billing plans</p>
      </div>
      <button
        @click="createModal = true; resetCreate()"
        class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        New Plan
      </button>
    </div>

    <!-- Error -->
    <div v-if="error" class="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-3 text-sm mb-4">
      {{ error }}
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-16">
      <div class="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
    </div>

    <!-- Plans grid -->
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="plan in plans"
        :key="plan.id"
        class="bg-white border border-gray-200 rounded-xl p-5 flex flex-col"
        :class="!plan.is_active && 'opacity-50'"
      >
        <div class="flex items-start justify-between mb-3">
          <div>
            <h3 class="font-semibold text-gray-900">{{ plan.name }}</h3>
            <span class="inline-block mt-1 px-2 py-0.5 text-xs rounded-full font-medium" :class="planTypeClass(plan.type)">
              {{ plan.type }}
            </span>
          </div>
          <div class="text-right">
            <div class="font-bold text-gray-900">{{ formatPrice(plan.price_monthly) }}</div>
            <div v-if="!plan.is_active" class="text-xs text-red-500 mt-0.5">Inactive</div>
          </div>
        </div>

        <p v-if="plan.description" class="text-sm text-gray-500 mb-3">{{ plan.description }}</p>

        <ul class="space-y-1.5 text-sm text-gray-600 flex-1 mb-4">
          <li class="flex items-center gap-2">
            <span class="text-gray-400">LinkedIn senders:</span>
            <span class="font-medium">{{ plan.max_linkedin_senders }}</span>
          </li>
          <li class="flex items-center gap-2">
            <span class="text-gray-400">Campaigns:</span>
            <span class="font-medium">{{ plan.max_campaigns === -1 ? 'Unlimited' : plan.max_campaigns }}</span>
          </li>
          <li class="flex items-center gap-2">
            <span class="text-gray-400">Leads:</span>
            <span class="font-medium">{{ plan.max_leads === -1 ? 'Unlimited' : plan.max_leads }}</span>
          </li>
        </ul>

        <button
          @click="openEdit(plan)"
          class="w-full border border-gray-200 text-gray-600 hover:bg-gray-50 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Edit
        </button>
      </div>

      <div v-if="plans.length === 0" class="col-span-3 text-center text-gray-400 py-16">
        No plans yet. Create your first plan.
      </div>
    </div>

    <!-- Create Modal -->
    <Teleport to="body">
      <div
        v-if="createModal"
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 py-8 overflow-y-auto"
        @click.self="createModal = false"
      >
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 my-auto">
          <h2 class="text-lg font-semibold text-gray-900 mb-5">Create Plan</h2>

          <div v-if="createError" class="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-3 text-sm mb-4">
            {{ createError }}
          </div>

          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input v-model="createForm.name" type="text" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="Pro Plan" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select v-model="createForm.type" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                  <option value="custom">Custom (admin-assigned)</option>
                  <option value="stripe">Stripe</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input v-model="createForm.description" type="text" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="Best for agencies…" />
            </div>

            <div class="grid grid-cols-3 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">LinkedIn Senders</label>
                <input v-model.number="createForm.max_linkedin_senders" type="number" min="1" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Max Campaigns</label>
                <input v-model.number="createForm.max_campaigns" type="number" min="-1" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                <p class="text-xs text-gray-400 mt-1">-1 = unlimited</p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Price (cents/mo)</label>
                <input v-model.number="createForm.price_monthly" type="number" min="0" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="4900" />
              </div>
            </div>

            <div v-if="createForm.type === 'stripe'" class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Stripe Price ID</label>
                <input v-model="createForm.stripe_price_id" type="text" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="price_xxx" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Stripe Product ID</label>
                <input v-model="createForm.stripe_product_id" type="text" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" placeholder="prod_xxx" />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Features (one per line)</label>
              <textarea
                v-model="createForm.features"
                rows="4"
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
                placeholder="Unlimited campaigns&#10;Priority support&#10;Custom integrations"
              />
            </div>
          </div>

          <div class="flex gap-3 mt-6">
            <button @click="createModal = false" class="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50">Cancel</button>
            <button @click="handleCreate" :disabled="createLoading" class="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium">
              {{ createLoading ? 'Creating…' : 'Create Plan' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Edit Modal -->
    <Teleport to="body">
      <div
        v-if="editModal"
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 py-8 overflow-y-auto"
        @click.self="editModal = false"
      >
        <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 my-auto">
          <h2 class="text-lg font-semibold text-gray-900 mb-1">Edit Plan</h2>
          <p class="text-sm text-gray-400 mb-5">{{ editingPlan?.name }}</p>

          <div v-if="editError" class="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-3 text-sm mb-4">
            {{ editError }}
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input v-model="editForm.name" type="text" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input v-model="editForm.description" type="text" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">LinkedIn Senders</label>
                <input v-model.number="editForm.max_linkedin_senders" type="number" min="1" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Max Campaigns (-1=∞)</label>
                <input v-model.number="editForm.max_campaigns" type="number" min="-1" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Features (one per line)</label>
              <textarea v-model="editForm.features" rows="4" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none" />
            </div>
            <div class="flex items-center gap-3">
              <button
                @click="editForm.is_active = !editForm.is_active"
                class="relative inline-flex items-center h-5 w-9 rounded-full transition-colors"
                :class="editForm.is_active ? 'bg-green-500' : 'bg-gray-300'"
              >
                <span class="inline-block w-3.5 h-3.5 bg-white rounded-full shadow transition-transform" :class="editForm.is_active ? 'translate-x-4' : 'translate-x-1'" />
              </button>
              <span class="text-sm text-gray-700">Plan Active</span>
            </div>
          </div>

          <div class="flex gap-3 mt-6">
            <button @click="editModal = false" class="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50">Cancel</button>
            <button @click="handleEdit" :disabled="editLoading" class="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium">
              {{ editLoading ? 'Saving…' : 'Save Changes' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
